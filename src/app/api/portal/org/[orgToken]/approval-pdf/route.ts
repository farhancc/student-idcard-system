import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { getOrRenderCard } from '@/lib/pdf/cache-manager';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgToken: string }> }
) {
  try {
    const { orgToken } = await params;

    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const client = await prisma.client.findUnique({
      where: { id: share.clientId },
    });
    const template = await prisma.cardTemplate.findUnique({
      where: { id: share.templateId },
    });

    if (!client || !template) {
      return NextResponse.json({ error: 'Client or Template not found' }, { status: 404 });
    }

    // Get all cardholders
    const cardholders = await prisma.cardholder.findMany({
      where: { clientId: share.clientId, pressId: share.pressId },
      orderBy: { name: 'asc' },
    });

    if (cardholders.length === 0) {
      return NextResponse.json({ error: 'No cardholders found' }, { status: 400 });
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.27;
    const pageHeight = 841.89;
    const hasBackSide = !!template.backImageUrl || (template.backFields && template.backFields !== '[]');
    const cardsPerPage = hasBackSide ? 4 : 8;
    const total = cardholders.length;
    const totalPages = Math.ceil(total / cardsPerPage);

    const isPortraitTemplate = template.cardWidth < template.cardHeight;
    const scaledWidth = isPortraitTemplate ? 100 : 200;
    const scaledHeight = isPortraitTemplate ? 158.6 : 126;

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw Header
      page.drawText('PROOF SHEET — FOR CLIENT APPROVAL ONLY', { x: 50, y: 800, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
      page.drawText(`Client: ${client.name} | Portal Proof | Page: ${pageIdx + 1} of ${totalPages}`, { x: 50, y: 780, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

      // Draw watermark
      page.drawText('PROOF ONLY - DO NOT PRINT', {
        x: 80,
        y: 200,
        size: 36,
        font: fontBold,
        color: rgb(0.95, 0.95, 0.95),
        rotate: degrees(45),
      });

      const startIdx = pageIdx * cardsPerPage;
      const endIdx = Math.min(startIdx + cardsPerPage, total);

      for (let idx = startIdx; idx < endIdx; idx++) {
        const cardholder = cardholders[idx];
        const pageItemIdx = idx - startIdx;

        if (hasBackSide) {
          const rowIdx = pageItemIdx;
          const rowStep = isPortraitTemplate ? 180 : 160;
          const yOffset = (isPortraitTemplate ? 770 : 740) - rowIdx * rowStep;

          // Render card sides (utilizes caching layer)
          const { frontBuffer, backBuffer, frontPdfBuffer, backPdfBuffer } = await getOrRenderCard(
            share.pressId,
            cardholder.id,
            share.templateId,
            null
          );

          if (frontPdfBuffer && backPdfBuffer) {
            const frontPages = await pdfDoc.embedPdf(frontPdfBuffer);
            const backPages = await pdfDoc.embedPdf(backPdfBuffer);
            page.drawPage(frontPages[0], { x: 50, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
            page.drawPage(backPages[0], { x: 270, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
          } else {
            const frontImg = await pdfDoc.embedPng(frontBuffer);
            const backImg = await pdfDoc.embedPng(backBuffer);
            page.drawImage(frontImg, { x: 50, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
            page.drawImage(backImg, { x: 270, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
          }

          // Draw diagonal watermark "ONLY FOR VALIDATION" on top of the cards (front and back)
          const wmText = 'ONLY FOR VALIDATION';
          const wmSize = isPortraitTemplate ? 12 : 16;
          const textWidth = wmText.length * wmSize * 0.55;
          const angleRad = (30 * Math.PI) / 180;
          const xOffsetWm = (textWidth / 2) * Math.cos(angleRad);
          const yOffsetWm = (textWidth / 2) * Math.sin(angleRad);

          // Front Card Watermark
          page.drawText(wmText, {
            x: 50 + scaledWidth / 2 - xOffsetWm,
            y: (yOffset - scaledHeight) + scaledHeight / 2 - yOffsetWm,
            size: wmSize,
            font: fontBold,
            color: rgb(0.85, 0.15, 0.15),
            opacity: 0.28,
            rotate: degrees(30),
          });

          // Back Card Watermark
          page.drawText(wmText, {
            x: 270 + scaledWidth / 2 - xOffsetWm,
            y: (yOffset - scaledHeight) + scaledHeight / 2 - yOffsetWm,
            size: wmSize,
            font: fontBold,
            color: rgb(0.85, 0.15, 0.15),
            opacity: 0.28,
            rotate: degrees(30),
          });

          // Draw cardholder details
          page.drawText(`${cardholder.name} (${cardholder.designation || 'N/A'})`, {
            x: 480,
            y: yOffset - 40,
            size: 9,
            font: fontBold,
            color: rgb(0, 0, 0),
          });
          page.drawText(`Serial: ${cardholder.cardSerial || 'N/A'}`, {
            x: 480,
            y: yOffset - 55,
            size: 8,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });
          page.drawText(`ID: #${cardholder.id}`, {
            x: 480,
            y: yOffset - 70,
            size: 8,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });

          // Draw bounding box outlines
          page.drawRectangle({
            x: 48,
            y: yOffset - scaledHeight - 2,
            width: scaledWidth + 4,
            height: scaledHeight + 4,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
          });
          page.drawRectangle({
            x: 268,
            y: yOffset - scaledHeight - 2,
            width: scaledWidth + 4,
            height: scaledHeight + 4,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
          });
        } else {
          const rowIdx = Math.floor(pageItemIdx / 2);
          const colIdx = pageItemIdx % 2;
          const rowStep = isPortraitTemplate ? 190 : 160;
          const yOffset = (isPortraitTemplate ? 770 : 750) - rowIdx * rowStep;
          const xOffset = colIdx === 0 ? 50 : 270;

          // Render front side only (utilizes caching layer)
          const { frontBuffer, frontPdfBuffer } = await getOrRenderCard(
            share.pressId,
            cardholder.id,
            share.templateId,
            null
          );

          if (frontPdfBuffer) {
            const frontPages = await pdfDoc.embedPdf(frontPdfBuffer);
            page.drawPage(frontPages[0], { x: xOffset, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
          } else {
            const frontImg = await pdfDoc.embedPng(frontBuffer);
            page.drawImage(frontImg, { x: xOffset, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
          }

          // Draw diagonal watermark "ONLY FOR VALIDATION" on top of the front card
          const wmText = 'ONLY FOR VALIDATION';
          const wmSize = isPortraitTemplate ? 12 : 16;
          const textWidth = wmText.length * wmSize * 0.55;
          const angleRad = (30 * Math.PI) / 180;
          const xOffsetWm = (textWidth / 2) * Math.cos(angleRad);
          const yOffsetWm = (textWidth / 2) * Math.sin(angleRad);

          page.drawText(wmText, {
            x: xOffset + scaledWidth / 2 - xOffsetWm,
            y: (yOffset - scaledHeight) + scaledHeight / 2 - yOffsetWm,
            size: wmSize,
            font: fontBold,
            color: rgb(0.85, 0.15, 0.15),
            opacity: 0.28,
            rotate: degrees(30),
          });

          // Draw details below the card
          page.drawText(`${cardholder.name} (${cardholder.designation || 'N/A'})`, {
            x: xOffset,
            y: yOffset - scaledHeight - 12,
            size: 8,
            font: fontBold,
            color: rgb(0, 0, 0),
          });
          page.drawText(`Serial: ${cardholder.cardSerial || 'N/A'} | ID: #${cardholder.id}`, {
            x: xOffset,
            y: yOffset - scaledHeight - 22,
            size: 7.5,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });

          // Draw bounding box outline
          page.drawRectangle({
            x: xOffset - 2,
            y: yOffset - scaledHeight - 2,
            width: scaledWidth + 4,
            height: scaledHeight + 4,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
          });
        }
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Approval_Proof_${client.name.replace(/\s+/g, '_')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Portal download approval PDF error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
