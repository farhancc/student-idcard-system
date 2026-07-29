import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';

function getExt(url: string): string {
  try {
    const urlWithoutQuery = url.split('?')[0];
    const parts = urlWithoutQuery.split('.');
    if (parts.length > 1) {
      const ext = parts[parts.length - 1].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) {
        return ext;
      }
    }
  } catch {}
  return 'jpg';
}

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');

    if (!yearStr || !monthStr) {
      return NextResponse.json({ error: 'Missing year or month' }, { status: 400 });
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed, e.g. 4 for April

    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch all clients for this press
    const clients = await prisma.client.findMany({
      where: { pressId },
    });

    const backupClients = [];

    for (const client of clients) {
      // Find cardholders created in that range
      const cardholders = await prisma.cardholder.findMany({
        where: {
          clientId: client.id,
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      if (cardholders.length === 0) {
        continue;
      }

      // Generate Excel sheet
      const formattedData = cardholders.map((ch) => {
        const row: any = {
          'ID': ch.id,
          'Name': ch.name,
          'Designation': ch.designation || '',
          'Card Serial': ch.cardSerial || '',
          'Date Added': ch.createdAt.toISOString(),
          'Local Photo File': ch.photoUrl ? `photos/${ch.id}_${ch.name.replace(/[^a-zA-Z0-9]/g, '_')}.${getExt(ch.photoUrl)}` : 'None',
          'Cloudinary Photo URL': ch.photoUrl || '',
        };

        if (ch.customFields) {
          try {
            const parsed = JSON.parse(ch.customFields);
            if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([key, val]) => {
                row[`Field: ${key}`] = val;
              });
            }
          } catch {}
        }
        return row;
      });

      const zip = new JSZip();
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Cardholders');

      const sample = formattedData[0] || {};
      sheet.columns = Object.keys(sample).map(key => ({
        header: key,
        key: key,
        width: 20
      }));

      formattedData.forEach(row => sheet.addRow(row));
      
      const excelBuffer = await workbook.xlsx.writeBuffer();
      zip.file('cardholders.xlsx', excelBuffer);

      // Download and bundle photos in chunks of 10
      const chunks = [];
      const chunkSize = 10;
      for (let i = 0; i < cardholders.length; i += chunkSize) {
        chunks.push(cardholders.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (ch) => {
            if (ch.photoUrl) {
              try {
                let url = ch.photoUrl;
                if (url.startsWith('/')) {
                  url = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${url}`;
                }
                const imgRes = await fetch(url);
                if (imgRes.ok) {
                  const buffer = await imgRes.arrayBuffer();
                  const ext = getExt(ch.photoUrl);
                  const photoName = `photos/${ch.id}_${ch.name.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
                  zip.file(photoName, buffer);
                }
              } catch (err) {
                console.error(`Failed to download photo for cardholder ${ch.id}:`, err);
              }
            }
          })
        );
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const base64 = zipBuffer.toString('base64');

      backupClients.push({
        id: client.id,
        name: client.name,
        zipBase64: base64,
        count: cardholders.length,
      });
    }

    return NextResponse.json({
      success: true,
      clients: backupClients,
    });
  } catch (error: any) {
    console.error('Backup prepare route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
