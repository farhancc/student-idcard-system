import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import AdmZip from 'adm-zip';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || 'DESIGNER';

    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    if (userRole === 'DESIGNER') {
      return NextResponse.json({ error: 'Forbidden: Designers cannot process batch orders' }, { status: 403 });
    }

    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);

    const formData = await request.formData();
    const clientIdStr = formData.get('clientId');
    const templateIdStr = formData.get('templateId');
    const pricePerCardStr = formData.get('pricePerCard');
    const taxPercentStr = formData.get('taxPercent');
    const validTill = formData.get('validTill') as string | null;

    const excelFile = formData.get('excel') as File | null;
    const zipFile = formData.get('zip') as File | null;

    if (!clientIdStr || !templateIdStr) {
      return NextResponse.json({ error: 'Client ID and Template ID are required' }, { status: 400 });
    }

    if (!excelFile || !zipFile) {
      return NextResponse.json({ error: 'Excel sheet and ZIP photos file are both required' }, { status: 400 });
    }

    const clientId = Number(clientIdStr);
    const templateId = Number(templateIdStr);
    const pricePerCard = pricePerCardStr ? Number(pricePerCardStr) : 50.0;
    const taxPercent = taxPercentStr ? Number(taxPercentStr) : 18.0;

    // Verify client and template belong to press
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });
    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId },
    });

    if (!client || !template) {
      return NextResponse.json({ error: 'Client or Template not found' }, { status: 404 });
    }

    // 1. Read and parse Excel / CSV
    let rawData: any[] = [];
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());
    const excelName = excelFile.name.toLowerCase();

    if (excelName.endsWith('.csv')) {
      const csvText = excelBuffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      rawData = parseResult.data;
    } else if (excelName.endsWith('.xlsx') || excelName.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(Buffer.from(excelBuffer) as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return NextResponse.json({ error: 'XLSX file contains no sheets.' }, { status: 400 });
      }
      const headerRow = sheet.getRow(1).values as (string | undefined)[];
      const headers = headerRow.slice(1);
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowObj: Record<string, any> = {};
        (row.values as any[]).slice(1).forEach((cell, idx) => {
          const key = headers[idx];
          if (key) rowObj[key] = cell?.text ?? cell ?? '';
        });
        rawData.push(rowObj);
      });
    } else {
      return NextResponse.json({ error: 'Unsupported spreadsheet format. Please upload CSV or XLSX.' }, { status: 400 });
    }

    if (rawData.length === 0) {
      return NextResponse.json({ error: 'No data rows found in the spreadsheet.' }, { status: 400 });
    }

    // Auto-detect columns
    const getHeaderKey = (headers: string[], possibleNames: string[]): string | null => {
      for (const h of headers) {
        if (possibleNames.some(p => h.toLowerCase().trim() === p.toLowerCase())) {
          return h;
        }
      }
      return null;
    };

    const firstRowHeaders = Object.keys(rawData[0]);
    const nameCol = getHeaderKey(firstRowHeaders, ['name', 'full name', 'student name', 'employee name', 'cardholder name', 'studentname']) || 'name';
    const designationCol = getHeaderKey(firstRowHeaders, ['designation', 'role', 'class', 'grade', 'job title', 'course']) || 'designation';
    const uniqueKeyCol = getHeaderKey(firstRowHeaders, ['id', 'empid', 'rollnumber', 'roll no', 'rollno', 'employee id', 'unique key', 'admission number', 'admissionno', 'student id', 'studentid']) || 'uniqueKey';
    const photoUrlCol = getHeaderKey(firstRowHeaders, ['photo', 'photourl', 'image', 'picture']) || 'photoUrl';

    // 2. Import Cardholders
    const cardholderIds: number[] = [];
    const uniqueKeyToCardholder = new Map<string, any>();

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

      let cardholder;
      if (duplicate) {
        cardholder = await prisma.cardholder.update({
          where: { id: duplicate.id },
          data: {
            ...cardholderPayload,
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
      } else {
        cardholder = await prisma.cardholder.create({ data: cardholderPayload });
      }

      cardholderIds.push(cardholder.id);
      if (uniqueKey) {
        uniqueKeyToCardholder.set(uniqueKey, cardholder);
      }
      // Also map by name as backup if uniqueKey doesn't match
      uniqueKeyToCardholder.set(name.toLowerCase(), cardholder);
    }

    if (cardholderIds.length === 0) {
      return NextResponse.json({ error: 'No valid cardholders imported from sheet' }, { status: 400 });
    }

    // 3. Process ZIP file photos and match with student IDs
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(pressId), String(clientId), 'photos');
    fs.mkdirSync(uploadDir, { recursive: true });

    let matchedPhotosCount = 0;

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const ext = path.extname(entry.entryName).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        continue;
      }

      const baseName = path.basename(entry.entryName, ext).trim();
      const imageBuffer = entry.getData();

      // Find matching cardholder
      // Match by student ID (uniqueKey) first, fallback to lowercase name
      let cardholder = uniqueKeyToCardholder.get(baseName);
      if (!cardholder) {
        cardholder = uniqueKeyToCardholder.get(baseName.toLowerCase());
      }

      if (cardholder) {
        // Simple verification that sharp can read the image
        try {
          await sharp(imageBuffer).metadata();
        } catch (e) {
          console.warn(`Corrupt image entry: ${entry.entryName}`);
          continue;
        }

        const isCloudinaryConfigured = 
          process.env.CLOUDINARY_CLOUD_NAME && 
          process.env.CLOUDINARY_API_KEY && 
          process.env.CLOUDINARY_API_SECRET;

        let publicUrl = '';

        if (isCloudinaryConfigured) {
          const { v2: cloudinary } = require('cloudinary');
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });

          const uploadResult = await new Promise<any>((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              {
                folder: `press_${pressId}/client_${clientId}/photos`,
                resource_type: 'image',
                public_id: String(cardholder.id),
                overwrite: true,
              },
              (error: any, result: any) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(imageBuffer);
          });

          publicUrl = uploadResult.secure_url;
        } else {
          // Save file locally in upload directory
          const destFileName = `${cardholder.id}${ext}`;
          const destPath = path.join(uploadDir, destFileName);
          fs.writeFileSync(destPath, imageBuffer);

          // Save URL path relative to public/
          publicUrl = `/uploads/${pressId}/${clientId}/photos/${destFileName}`;
        }

        // Update Cardholder DB
        await prisma.cardholder.update({
          where: { id: cardholder.id },
          data: { photoUrl: publicUrl },
        });

        // Mark cache stale
        await prisma.cardAsset.updateMany({
          where: { cardholderId: cardholder.id },
          data: { isStale: true },
        });

        matchedPhotosCount++;
      }
    }

    // 4. Create CardOrder & Invoice
    const validTillDate = validTill ? new Date(validTill) : null;
    const order = await prisma.cardOrder.create({
      data: {
        pressId,
        clientId,
        templateId,
        status: 'DRAFT',
        validTill: validTillDate,
        templateVersion: template.version,
      },
    });

    // Link cardholders via the join table
    await prisma.orderCardholder.createMany({
      data: cardholderIds.map((chId: number) => ({
        orderId: order.id,
        cardholderId: chId,
      })),
      skipDuplicates: true,
    });

    const cardCount = cardholderIds.length;
    const subtotal = cardCount * pricePerCard;
    const taxAmount = (subtotal * taxPercent) / 100.0;
    const totalAmount = subtotal + taxAmount;

    await prisma.orderInvoice.create({
      data: {
        orderId: order.id,
        pressId,
        pricePerCard,
        cardCount,
        subtotal,
        taxPercent,
        taxAmount,
        totalAmount,
        paymentStatus: 'UNPAID',
        paidAmount: 0.0,
      },
    });

    // Create Order Activity log
    await prisma.orderActivityLog.create({
      data: {
        orderId: order.id,
        pressId,
        actorId: userId,
        actorName: 'System Batch Process',
        action: 'ORDER_CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        note: `Batch upload processed. Created order with ${cardCount} cards. Price per card set to ₹${pricePerCard.toFixed(2)}. Matched ${matchedPhotosCount} photos.`,
      },
    });

    // 5. Trigger PDF Generation Jobs for both types: APPROVAL and PRODUCTION
    const jobOptions = {
      paperSize: 'A3' as const,
      orientation: 'PORTRAIT' as const,
      bleed: 0,
      cropMarks: true,
      foldLine: true,
    };

    // Credit Check & Lock for batch jobs
    const isDoubleSided = !!template.backImageUrl;
    const costPerCard = isDoubleSided ? 15 : 10;
    const productionCreditsNeeded = cardCount * costPerCard;
    const approvalCreditsNeeded = 20;
    const totalCreditsNeeded = productionCreditsNeeded + approvalCreditsNeeded;

    const press = await prisma.press.findUnique({ where: { id: pressId } });
    if (!press) {
      return NextResponse.json({ error: 'Press tenant not found' }, { status: 404 });
    }
    if (press.credits < totalCreditsNeeded) {
      return NextResponse.json({
        error: `Insufficient credits to queue production. Required: ${totalCreditsNeeded} (${productionCreditsNeeded} for production, ${approvalCreditsNeeded} for approval), Available: ${press.credits}`
      }, { status: 403 });
    }

    // Deduct credits for both jobs
    await prisma.press.update({
      where: { id: pressId },
      data: {
        credits: {
          decrement: totalCreditsNeeded,
        },
      },
    });

    // Create APPROVAL Job
    const approvalJobCount = await prisma.pdfJob.count({
      where: { orderId: order.id, pdfType: 'APPROVAL' },
    });
    const nextApprovalVersion = approvalJobCount + 1;
    const approvalJob = await prisma.pdfJob.create({
      data: {
        pressId,
        orderId: order.id,
        pdfType: 'APPROVAL',
        status: 'PENDING',
        fileName: `approval_order_${order.id}_v${nextApprovalVersion}.pdf`,
        generatedBy: userId,
        progress: 0,
        metadata: JSON.stringify(jobOptions),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        version: nextApprovalVersion,
        label: `Approval v${nextApprovalVersion} (Local)`,
        isLocalJob: true,
        creditsLocked: approvalCreditsNeeded,
      },
    });

    // Create PRODUCTION Job
    const prodJobCount = await prisma.pdfJob.count({
      where: { orderId: order.id, pdfType: 'PRODUCTION' },
    });
    const nextProdVersion = prodJobCount + 1;
    const prodJob = await prisma.pdfJob.create({
      data: {
        pressId,
        orderId: order.id,
        pdfType: 'PRODUCTION',
        status: 'PENDING',
        fileName: `production_order_${order.id}_v${nextProdVersion}.pdf`,
        generatedBy: userId,
        progress: 0,
        metadata: JSON.stringify(jobOptions),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        version: nextProdVersion,
        label: `Production v${nextProdVersion} (Local)`,
        isLocalJob: true,
        creditsLocked: productionCreditsNeeded,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Batch upload processed, order created, and PDF generation started.',
      orderId: order.id,
      cardholderCount: cardCount,
      matchedPhotosCount,
      jobs: {
        approvalJobId: approvalJob.id,
        productionJobId: prodJob.id,
      }
    });

  } catch (error) {
    console.error('Batch process error:', error);
    return NextResponse.json({ error: 'Internal server error during batch processing' }, { status: 500 });
  }
}
