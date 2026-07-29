import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { z } from 'zod';

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
    const templateIdStr = formData.get('templateId') as string | null;
    const templateId = templateIdStr ? Number(templateIdStr) : null;
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
        const workbook = new ExcelJS.Workbook();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.xlsx.load(Buffer.from(buffer) as any);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
          return NextResponse.json({ error: 'XLSX file contains no sheets.' }, { status: 400 });
        }
        // Build header map from first row
        const headerRow = sheet.getRow(1).values as (string | undefined)[];
        const headers = headerRow.slice(1); // ExcelJS rows are 1-indexed, values[0] is undefined
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // skip header
          const rowObj: Record<string, any> = {};
          (row.values as any[]).slice(1).forEach((cell, idx) => {
            const key = headers[idx];
            if (key && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
              rowObj[key] = cell?.text ?? cell ?? '';
            }
          });
          rawData.push(rowObj);
        });
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
    const nameCol = (mapping.name !== undefined && mapping.name !== null)
      ? mapping.name
      : (getHeaderKey(firstRowHeaders, ['name', 'full name', 'student name', 'employee name', 'cardholder name']) || 'name');
    const designationCol = (mapping.designation !== undefined && mapping.designation !== null)
      ? mapping.designation
      : (getHeaderKey(firstRowHeaders, ['designation', 'role', 'class', 'grade', 'job title']) || 'designation');
    const photoUrlCol = (mapping.photoUrl !== undefined && mapping.photoUrl !== null)
      ? mapping.photoUrl
      : (getHeaderKey(firstRowHeaders, ['photo', 'photourl', 'image', 'picture']) || 'photoUrl');

    // 3. Validate against template required fields (if templateId provided)
    const validationErrors: Array<{ row: number; name: string; missingFields: string[] }> = [];
    if (templateId) {
      const templateFields = await prisma.templateField.findMany({
        where: { templateId },
      });

      if (templateFields.length > 0) {
        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          const rowName = String(row[nameCol] || `Row ${i + 2}`).trim();
          const missing: string[] = [];

          for (const f of templateFields) {
            let strVal = '';
            if (f.field === 'name') {
              strVal = String(row[nameCol] || '').trim();
            } else if (f.field === 'designation') {
              strVal = String(row[designationCol] || '').trim();
            } else if (f.field === 'photo') {
              strVal = String(row[photoUrlCol] || '').trim();
            } else {
              const sourceCol = mapping[f.field] || f.field;
              const val = row[sourceCol];
              strVal = val !== null && val !== undefined ? String(val).trim() : '';
            }

            const isProvided = strVal.length > 0;
            if (f.isRequired || isProvided) {
              let schema = z.string();
              
              if (f.isRequired) {
                schema = schema.min(1, { message: `Required field '${f.field}' is missing` });
              }
              
              if (f.maxLength !== null && f.maxLength !== undefined) {
                schema = schema.max(f.maxLength, { message: `'${f.field}' exceeds maximum length of ${f.maxLength} characters` });
              }
              
              if (f.validationPattern) {
                try {
                  const regex = new RegExp(f.validationPattern);
                  schema = schema.regex(regex, { message: `'${f.field}' must match format /${f.validationPattern}/` });
                } catch (err) {
                  console.error(`Invalid regex pattern defined on template field ${f.field}:`, f.validationPattern);
                }
              }

              const result = schema.safeParse(strVal);
              if (!result.success) {
                for (const issue of result.error.issues) {
                  missing.push(issue.message);
                }
              }
            }
          }

          if (missing.length > 0) {
            validationErrors.push({ row: i + 2, name: rowName, missingFields: missing });
          }
        }
      }
    }

    if (validationErrors.length > 0 && importMode !== 'check') {
      return NextResponse.json({
        success: false,
        mode: importMode,
        totalRows: rawData.length,
        newAdded: 0,
        updated: 0,
        skipped: 0,
        duplicateCount: 0,
        duplicates: [],
        validationErrors,
        validationErrorCount: validationErrors.length,
        error: 'Validation failed. No records were imported.',
      });
    }

    const duplicates: any[] = [];
    const newItems: any[] = [];
    const updatedItems: any[] = [];
    const skippedCount = { val: 0 };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const name = String(row[nameCol] || '').trim();
      if (!name) continue; // skip blank name rows

      const designation = (designationCol && row[designationCol]) ? String(row[designationCol]).trim() : null;
      const photoUrl = (photoUrlCol && row[photoUrlCol]) ? String(row[photoUrlCol]).trim() : null;

      // Extract custom fields (all columns not mapped to core fields)
      const custom: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        if (key !== nameCol && key !== designationCol && key !== photoUrlCol) {
          if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
            custom[key] = row[key];
          }
        }
      });

      // Find duplicate in DB: name + designation (since uniqueKey concept is deprecated/removed)
      const duplicate = await prisma.cardholder.findFirst({
        where: { clientId, name, designation: designation ?? null },
      });

      const cardholderPayload: any = {
        pressId,
        clientId,
        name,
        designation,
        photoUrl,
        customFields: Object.keys(custom).length > 0 ? JSON.stringify(custom) : null,
        ...(templateId ? { templateId } : {}),
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
      validationErrors,          // Per-row required field violations
      validationErrorCount: validationErrors.length,
    });
  } catch (error) {
    console.error('Import cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error during import' }, { status: 500 });
  }
}
