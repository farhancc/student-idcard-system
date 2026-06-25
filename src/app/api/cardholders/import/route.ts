import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const formData = await request.formData();
    const clientIdStr = formData.get('clientId');
    const importMode = formData.get('mode') || 'check'; // check | skip | update | overwrite
    const columnMappingJson = formData.get('columnMapping'); // JSON string mapping source cols to {name, designation, uniqueKey, ...}
    const file = formData.get('file') as File | null;
    const googleSheetsUrl = formData.get('googleSheetsUrl') as string | null;

    if (!clientIdStr) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }
    const clientId = Number(clientIdStr);

    // Verify client belongs to press
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    let rawData: any[] = [];

    // 1. Fetch Google Sheets or parse Uploaded File
    if (googleSheetsUrl) {
      // Convert standard edit link to export CSV link
      const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
      const match = googleSheetsUrl.match(regex);
      if (!match) {
        return NextResponse.json({ error: 'Invalid Google Sheets URL format' }, { status: 400 });
      }
      const spreadsheetId = match[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

      const res = await fetch(exportUrl);
      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch Google Sheet. Make sure link sharing is on (Anyone with the link can view).' }, { status: 400 });
      }
      const csvText = await res.text();
      const parseResult = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      rawData = parseResult.data;
    } else if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        const csvText = buffer.toString('utf-8');
        const parseResult = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        rawData = parseResult.data;
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet);
      } else {
        return NextResponse.json({ error: 'Unsupported file format. Please upload CSV or XLSX.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Please provide either a file or a Google Sheets URL.' }, { status: 400 });
    }

    if (rawData.length === 0) {
      return NextResponse.json({ error: 'No data rows found in the source.' }, { status: 400 });
    }

    // 2. Parse and map columns
    // Column mapping defaults if not provided
    const mapping: Record<string, string> = columnMappingJson 
      ? JSON.parse(columnMappingJson as string) 
      : {};

    // Helper: auto-detect matching headers if no mapping provided
    const getHeaderKey = (headers: string[], possibleNames: string[]): string | null => {
      for (const h of headers) {
        if (possibleNames.some(p => h.toLowerCase().trim() === p.toLowerCase())) {
          return h;
        }
      }
      return null;
    };

    const firstRowHeaders = Object.keys(rawData[0]);
    const nameCol = mapping.name || getHeaderKey(firstRowHeaders, ['name', 'full name', 'student name', 'employee name', 'cardholder name']) || 'name';
    const designationCol = mapping.designation || getHeaderKey(firstRowHeaders, ['designation', 'role', 'class', 'grade', 'job title']) || 'designation';
    const uniqueKeyCol = mapping.uniqueKey || getHeaderKey(firstRowHeaders, ['id', 'empid', 'rollnumber', 'roll no', 'employee id', 'unique key']) || 'uniqueKey';
    const photoUrlCol = mapping.photoUrl || getHeaderKey(firstRowHeaders, ['photo', 'photourl', 'image', 'picture']) || 'photoUrl';

    // 3. Process and analyze import
    const duplicates: any[] = [];
    const newItems: any[] = [];
    const updatedItems: any[] = [];
    const skippedCount = { val: 0 };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const name = String(row[nameCol] || '').trim();
      if (!name) continue; // skip blank name rows

      const designation = row[designationCol] ? String(row[designationCol]).trim() : null;
      const uniqueKey = row[uniqueKeyCol] ? String(row[uniqueKeyCol]).trim() : null;
      const photoUrl = row[photoUrlCol] ? String(row[photoUrlCol]).trim() : null;

      // Extract custom fields (all columns not mapped to core fields)
      const custom: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        if (key !== nameCol && key !== designationCol && key !== uniqueKeyCol && key !== photoUrlCol) {
          custom[key] = row[key];
        }
      });

      // Find duplicate in DB
      let duplicate = null;
      if (uniqueKey) {
        duplicate = await prisma.cardholder.findFirst({
          where: { clientId, uniqueKey },
        });
      } else {
        duplicate = await prisma.cardholder.findFirst({
          where: { clientId, name, designation: designation ?? null },
        });
      }

      const cardholderPayload = {
        pressId,
        clientId,
        name,
        designation,
        photoUrl,
        customFields: Object.keys(custom).length > 0 ? JSON.stringify(custom) : null,
        uniqueKey,
      };

      if (duplicate) {
        duplicates.push({ rowNumber: i + 1, source: row, existing: duplicate });

        if (importMode === 'skip') {
          skippedCount.val += 1;
        } else if (importMode === 'update') {
          const updated = await prisma.cardholder.update({
            where: { id: duplicate.id },
            data: {
              ...cardholderPayload,
              // Keep original photo if new one not provided
              photoUrl: photoUrl || duplicate.photoUrl,
            },
          });
          // Mark cached asset stale if name/designation/custom changed
          if (
            name !== duplicate.name ||
            designation !== duplicate.designation ||
            JSON.stringify(custom) !== duplicate.customFields
          ) {
            await prisma.cardAsset.updateMany({
              where: { cardholderId: duplicate.id },
              data: { isStale: true },
            });
          }
          updatedItems.push(updated);
        } else if (importMode === 'overwrite') {
          // Delete and recreate
          await prisma.cardholder.delete({ where: { id: duplicate.id } });
          const created = await prisma.cardholder.create({ data: cardholderPayload });
          newItems.push(created);
        }
      } else {
        // Not a duplicate
        if (importMode !== 'check') {
          const created = await prisma.cardholder.create({ data: cardholderPayload });
          newItems.push(created);
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode: importMode,
      totalRows: rawData.length,
      newAdded: newItems.length,
      updated: updatedItems.length,
      skipped: skippedCount.val,
      duplicateCount: duplicates.length,
      duplicates: importMode === 'check' ? duplicates : [], // Only return duplicate details on check mode
    });
  } catch (error) {
    console.error('Import cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error during import' }, { status: 500 });
  }
}
