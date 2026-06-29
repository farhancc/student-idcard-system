import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { renderCardSideToPdfBytesClient } from './card-renderer-client';

export async function generateApprovalPdfClient(
  clientName: string,
  deptName: string,
  template: {
    cardWidth: number;
    cardHeight: number;
    frontImageUrl: string;
    backImageUrl: string | null;
    frontFields: string;
    backFields: string;
    validTill?: string | Date | null;
  },
  cardholders: Array<{
    id?: number;
    name: string;
    designation: string | null;
    photoUrl: string | null;
    cardSerial: string | null;
    customFields?: any;
  }>,
  pressFonts: Array<{ name: string; fileUrl: string }> = []
): Promise<Blob> {
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

  const canvas = document.createElement('canvas');
  void canvas; // retained only for potential fallback; not used in PDF path

  // Convert template fields to string if they are parsed objects
  const clientTemplate = {
    cardWidth: template.cardWidth,
    cardHeight: template.cardHeight,
    frontImageUrl: template.frontImageUrl,
    backImageUrl: template.backImageUrl,
    frontFields: typeof template.frontFields === 'string' ? template.frontFields : JSON.stringify(template.frontFields || []),
    backFields: typeof template.backFields === 'string' ? template.backFields : JSON.stringify(template.backFields || []),
  };

  const parsedValidTill = template.validTill
    ? typeof template.validTill === 'string'
      ? new Date(template.validTill)
      : template.validTill
    : null;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Draw Header
    page.drawText('PROOF SHEET — FOR CLIENT APPROVAL ONLY', { x: 50, y: 800, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
    page.drawText(`Client: ${clientName} | Dept: ${deptName} | Portal Proof | Page: ${pageIdx + 1} of ${totalPages}`, { x: 50, y: 780, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

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

      const clientCardholder = {
        id: cardholder.id,
        name: cardholder.name,
        designation: cardholder.designation,
        photoUrl: cardholder.photoUrl,
        cardSerial: cardholder.cardSerial,
        customFields: typeof cardholder.customFields === 'string' ? cardholder.customFields : JSON.stringify(cardholder.customFields || {}),
      };

      if (hasBackSide) {
        const rowIdx = pageItemIdx;
        const rowStep = isPortraitTemplate ? 180 : 160;
        const yOffset = (isPortraitTemplate ? 770 : 740) - rowIdx * rowStep;

        // Render Front Side
        const frontPdfBytes = await renderCardSideToPdfBytesClient(clientTemplate, clientCardholder, 'front', parsedValidTill, pressFonts);
        const frontDoc = await pdfDoc.embedPdf(await PDFDocument.load(frontPdfBytes), [0]);

        // Render Back Side
        const backPdfBytes = await renderCardSideToPdfBytesClient(clientTemplate, clientCardholder, 'back', parsedValidTill, pressFonts);
        const backDoc = await pdfDoc.embedPdf(await PDFDocument.load(backPdfBytes), [0]);

        // Draw Pages
        page.drawPage(frontDoc[0], { x: 50, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
        page.drawPage(backDoc[0], { x: 270, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });

        // Draw diagonal watermark "ONLY FOR VALIDATION"
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

        // Render Front Side
        const frontPdfBytes = await renderCardSideToPdfBytesClient(clientTemplate, clientCardholder, 'front', parsedValidTill, pressFonts);
        const [frontEmbedded] = await pdfDoc.embedPdf(await PDFDocument.load(frontPdfBytes), [0]);

        page.drawPage(frontEmbedded, { x: xOffset, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });

        // Draw diagonal watermark "ONLY FOR VALIDATION"
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
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
