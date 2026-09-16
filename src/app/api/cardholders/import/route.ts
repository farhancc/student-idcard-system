import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { normalizeGoogleDriveUrl } from '@/lib/pdf/field-resolver';
import { deleteManyFromR2 } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const orgToken = formData.get('orgToken') as string | null;
    let pressId: number;
    let clientId: number;

    if (orgToken) {
      const share = await prisma.clientPortalShare.findUnique({
        where: { orgToken },
      });
      if (!share || !share.active) {
        return NextResponse.json({ error: 'Unauthorized or invalid portal link' }, { status: 403 });
      }
      pressId = share.pressId;
      clientId = share.clientId;
    } else {
      const auth = requireActor(request);
      if ('response' in auth) return auth.response;
      pressId = auth.actor.pressId;
      const clientIdStr = formData.get('clientId');
      if (!clientIdStr) {
        return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
      }
      clientId = Number(clientIdStr);
    }

    const importMode = formData.get('mode') || 'check'; // check | skip | update | overwrite
    const columnMappingJson = formData.get('columnMapping'); // JSON string mapping source cols to {name, designation, uniqueKey, ...}
    const templateIdStr = formData.get('templateId') as string | null;
    const templateId = templateIdStr ? Number(templateIdStr) : null;
    const file = formData.get('file') as File | null;
    const googleSheetsUrl = formData.get('googleSheetsUrl') as string | null;

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

    const MAX_IMPORT_ROWS = 5000;
    if (rawData.length > MAX_IMPORT_ROWS) {
      return NextResponse.json({
        error: `Import row limit exceeded. Maximum ${MAX_IMPORT_ROWS} rows allowed per import (found ${rawData.length} rows).`
      }, { status: 400 });
    }

    // 2. Parse and map columns
    // Column mapping defaults if not provided
    const mapping: Record<string, string> = columnMappingJson 
      ? JSON.parse(columnMappingJson as string) 
      : {};

    const getMappingValue = (mapping: Record<string, string>, field: string): string | null => {
      const fieldLower = field.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [k, v] of Object.entries(mapping)) {
        const kLower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (kLower === fieldLower) return v;
      }
      return null;
    };

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
    const nameMap = getMappingValue(mapping, 'name');
    const nameCol = (nameMap !== undefined && nameMap !== null)
      ? nameMap
      : (getHeaderKey(firstRowHeaders, ['name', 'full name', 'student name', 'employee name', 'cardholder name']) || 'name');
    
    const designationMap = getMappingValue(mapping, 'designation');
    const designationCol = (designationMap !== undefined && designationMap !== null)
      ? designationMap
      : (getHeaderKey(firstRowHeaders, ['designation', 'role', 'class', 'grade', 'job title']) || 'designation');

    const photoUrlMap = getMappingValue(mapping, 'photo') || getMappingValue(mapping, 'photourl');
    const photoUrlCol = (photoUrlMap !== undefined && photoUrlMap !== null)
      ? photoUrlMap
      : (getHeaderKey(firstRowHeaders, ['photo', 'photourl', 'photo url', 'image', 'picture']) || 'photoUrl');

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
            const userMappedCol = mapping[f.field];
            if (userMappedCol !== undefined && userMappedCol !== null && userMappedCol !== '') {
              const val = row[userMappedCol];
              strVal = val !== null && val !== undefined ? String(val).trim() : '';
            } else {
              const fFieldClean = f.field.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (fFieldClean === 'name' || fFieldClean === 'fullname' || fFieldClean === 'studentname') {
                strVal = String(row[nameCol] || '').trim();
              } else if (fFieldClean === 'designation' || fFieldClean === 'role') {
                strVal = String(row[designationCol] || '').trim();
              } else if (fFieldClean === 'photo' || fFieldClean === 'photourl') {
                strVal = String(row[photoUrlCol] || '').trim();
              } else {
                const val = row[f.field];
                strVal = val !== null && val !== undefined ? String(val).trim() : '';
              }
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

    // 4. Batch optimization: Pre-fetch all existing cardholders for this client in 1 query (prevents N+1 queries)
    const existingCardholders = await prisma.cardholder.findMany({
      where: { clientId, pressId },
    });

    const existingMap = new Map<string, typeof existingCardholders[0]>();
    for (const ch of existingCardholders) {
      const key = `${ch.name.trim().toLowerCase()}:${(ch.designation || '').trim().toLowerCase()}`;
      if (!existingMap.has(key)) {
        existingMap.set(key, ch);
      }
    }

    const duplicates: any[] = [];
    const newItems: any[] = [];
    const updatedItems: any[] = [];
    let skippedCountVal = 0;

    const itemsToCreate: any[] = [];
    const txOps: Array<(tx: any) => Promise<{ type: 'update' | 'create'; data: any }>> = [];
    // Files belonging to cardholders this import overwrites — collected as
    // rows are processed, reclaimed from R2 once the transaction commits.
    const overwriteR2Keys: string[] = [];
    const overwriteDuplicateIds: number[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const name = String(row[nameCol] || '').trim();
      if (!name) continue; // skip blank name rows

      const designation = (designationCol && row[designationCol]) ? String(row[designationCol]).trim() : null;
      const rawPhotoUrl = (photoUrlCol && row[photoUrlCol]) ? String(row[photoUrlCol]).trim() : null;
      const photoUrl = rawPhotoUrl ? (normalizeGoogleDriveUrl(rawPhotoUrl) || rawPhotoUrl) : null;

      // Extract custom fields (all columns not mapped to core fields)
      const custom: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        if (key !== nameCol && key !== designationCol && key !== photoUrlCol) {
          if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
            const rawVal = row[key];
            if (typeof rawVal === 'string' && (rawVal.includes('drive.google.com') || rawVal.includes('docs.google.com'))) {
              custom[key] = normalizeGoogleDriveUrl(rawVal) || rawVal;
            } else {
              custom[key] = rawVal;
            }
          }
        }
      });

      const lookupKey = `${name.toLowerCase()}:${(designation || '').toLowerCase()}`;
      const duplicate = existingMap.get(lookupKey);

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
          skippedCountVal += 1;
        } else if (importMode === 'update') {
          txOps.push(async (tx) => {
            const updated = await tx.cardholder.update({
              where: { id: duplicate.id },
              data: {
                ...cardholderPayload,
                photoUrl: photoUrl || duplicate.photoUrl,
              },
            });
            if (
              name !== duplicate.name ||
              designation !== duplicate.designation ||
              JSON.stringify(custom) !== duplicate.customFields
            ) {
              await tx.cardAsset.updateMany({
                where: { cardholderId: duplicate.id },
                data: { isStale: true },
              });
            }
            return { type: 'update', data: updated };
          });
        } else if (importMode === 'overwrite') {
          if (duplicate.photoUrl) overwriteR2Keys.push(duplicate.photoUrl);
          overwriteDuplicateIds.push(duplicate.id);
          txOps.push(async (tx) => {
            // Clear the RESTRICT-protected order-membership rows first —
            // without this the delete below throws for any cardholder that
            // has already been added to a print order (see
            // src/lib/cardholder-delete.ts for the same pattern elsewhere).
            await tx.orderCardholder.deleteMany({ where: { cardholderId: duplicate.id } });
            await tx.cardholder.delete({ where: { id: duplicate.id } });
            const created = await tx.cardholder.create({ data: cardholderPayload });
            return { type: 'create', data: created };
          });
        }
      } else {
        // Not a duplicate
        if (importMode !== 'check') {
          itemsToCreate.push(cardholderPayload);
        }
      }
    }

    if (importMode !== 'check') {
      if (itemsToCreate.length > 0) {
        // Run in batches of 100 so post-write syncCardholderValues hook triggers for each record
        const BATCH_SIZE = 100;
        for (let i = 0; i < itemsToCreate.length; i += BATCH_SIZE) {
          const batch = itemsToCreate.slice(i, i + BATCH_SIZE);
          const createdBatch = await prisma.$transaction(async (tx) => {
            return await (tx.cardholder as any).createManyAndReturn({ data: batch });
          });
          newItems.push(...createdBatch);
        }
      }

      if (txOps.length > 0) {
        // Rendered card faces are cascade-deleted with the cardholder row —
        // read their URLs before that happens, or there is nothing left to
        // reclaim from R2 afterward.
        if (overwriteDuplicateIds.length > 0) {
          const overwrittenAssets = await prisma.cardAsset.findMany({
            where: { cardholderId: { in: overwriteDuplicateIds } },
            select: { frontUrl: true, backUrl: true },
          });
          for (const asset of overwrittenAssets) {
            if (asset.frontUrl) overwriteR2Keys.push(asset.frontUrl);
            if (asset.backUrl) overwriteR2Keys.push(asset.backUrl);
          }
        }

        const txResults = await prisma.$transaction(async (tx) => {
          return Promise.all(txOps.map(op => op(tx)));
        });

        for (const res of txResults) {
          if (res.type === 'update') updatedItems.push(res.data);
          else if (res.type === 'create') newItems.push(res.data);
        }

        if (overwriteR2Keys.length > 0) {
          await deleteManyFromR2(overwriteR2Keys);
        }
      }
    }


    // Collect all affected cardholder IDs for downstream workflows (e.g. print wizard)
    const insertedIds = [
      ...newItems.map((item: any) => item.id),
      ...updatedItems.map((item: any) => item.id),
    ];

    return NextResponse.json({
      success: true,
      mode: importMode,
      totalRows: rawData.length,
      newAdded: newItems.length,
      updated: updatedItems.length,
      skipped: skippedCountVal,
      duplicateCount: duplicates.length,
      duplicates: importMode === 'check' ? duplicates : [], // Only return duplicate details on check mode
      validationErrors,          // Per-row required field violations
      validationErrorCount: validationErrors.length,
      insertedIds,               // IDs of all created/updated cardholders
    });
  } catch (error) {
    console.error('Import cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error during import' }, { status: 500 });
  }
}
