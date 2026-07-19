import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { renderCardSideToPdfBytesClient, FieldCoordinate } from './card-renderer-client';
import { getResolvedFieldValue } from './field-resolver';

async function safeDrawText(
  page: any,
  pdfDoc: any,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: any;
    color?: any;
    opacity?: number;
    rotate?: any;
  }
) {
  try {
    options.font.encodeText(text);
    page.drawText(text, options);
  } catch (err) {
    try {
      const scaleFactor = 4;
      const fontSize = options.size;
      const fontName = 'sans-serif';
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not get 2d context');
      tempCtx.font = `${fontSize}px "${fontName}"`;
      const textWidth = tempCtx.measureText(text).width;
      const textHeight = fontSize * 1.5;
      
      const textCanvas = document.createElement('canvas');
      textCanvas.width = Math.ceil(textWidth * scaleFactor) || 1;
      textCanvas.height = Math.ceil(textHeight * scaleFactor) || 1;
      const ctx = textCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2d context');
      ctx.scale(scaleFactor, scaleFactor);
      
      ctx.font = `${fontSize}px "${fontName}"`;
      ctx.fillStyle = '#000000';
      if (options.color) {
        const rgbArr = options.color.asArray();
        const r = Math.round((rgbArr[0] || 0) * 255);
        const g = Math.round((rgbArr[1] || 0) * 255);
        const b = Math.round((rgbArr[2] || 0) * 255);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      }
      ctx.textBaseline = 'top';
      ctx.fillText(text, 0, 0);
      
      const dataUrl = textCanvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const embeddedPng = await pdfDoc.embedPng(pngBytes);
      
      page.drawImage(embeddedPng, {
        x: options.x,
        y: options.y - fontSize * 0.2,
        width: textWidth,
        height: textHeight,
        opacity: options.opacity,
        rotate: options.rotate,
      });
    } catch (fallbackErr) {
      console.error('safeDrawText fallback failed:', fallbackErr);
      const sanitized = text.replace(/[^\x00-\x7F]/g, '?');
      try {
        page.drawText(sanitized, options);
      } catch (finalErr) {
        // ignore
      }
    }
  }
}

export async function generateApprovalPdfClient(
  clientName: string,
  deptName: string,
  template: {
    id?: number;
    cardWidth: number;
    cardHeight: number;
    frontImageUrl: string;
    backImageUrl: string | null;
    frontOriginalUrl?: string | null;
    backOriginalUrl?: string | null;
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
    uniqueKey?: string | null;
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
    id: template.id,
    cardWidth: template.cardWidth,
    cardHeight: template.cardHeight,
    frontImageUrl: template.frontImageUrl,
    backImageUrl: template.backImageUrl,
    frontOriginalUrl: template.frontOriginalUrl ?? null,
    backOriginalUrl: template.backOriginalUrl ?? null,
    frontFields: typeof template.frontFields === 'string' ? template.frontFields : JSON.stringify(template.frontFields || []),
    backFields: typeof template.backFields === 'string' ? template.backFields : JSON.stringify(template.backFields || []),
  };

  const frontFieldsList: FieldCoordinate[] = JSON.parse(clientTemplate.frontFields || '[]');
  const backFieldsList: FieldCoordinate[] = JSON.parse(clientTemplate.backFields || '[]');
  const allFields = [...frontFieldsList, ...backFieldsList];

  const uniqueFieldsMap = new Map<string, FieldCoordinate>();
  for (const f of allFields) {
    const isImageField = f.type === 'image' || 
      ['photo', 'logo', 'sig', 'avatar', 'image'].some(kw => f.field.toLowerCase().includes(kw));

    if (f.field && f.field !== 'photo' && f.field !== 'cardSerial' && !isImageField) {
      const existing = uniqueFieldsMap.get(f.field);
      if (!existing || (!existing.prefix && f.prefix)) {
        uniqueFieldsMap.set(f.field, f);
      }
    }
  }

  const parsedValidTill = template.validTill
    ? typeof template.validTill === 'string'
      ? new Date(template.validTill)
      : template.validTill
    : null;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Draw Header
    page.drawText('PROOF SHEET — FOR CLIENT APPROVAL ONLY', { x: 50, y: 800, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
    await safeDrawText(page, pdfDoc, `Client: ${clientName} | Dept: ${deptName} | Portal Proof | Page: ${pageIdx + 1} of ${totalPages}`, { x: 50, y: 780, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

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
        uniqueKey: cardholder.uniqueKey || null,
        customFields: typeof cardholder.customFields === 'string' ? cardholder.customFields : JSON.stringify(cardholder.customFields || {}),
      };

      const customData = typeof cardholder.customFields === 'string'
        ? JSON.parse(cardholder.customFields || '{}')
        : (cardholder.customFields || {});

      let formattedValidTill = '';
      if (parsedValidTill) {
        const date = new Date(parsedValidTill);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        formattedValidTill = `${months[date.getMonth()]} ${date.getFullYear()}`;
      }

      const cardholderData: Record<string, any> = {
        name: cardholder.name,
        designation: cardholder.designation || '',
        id: cardholder.uniqueKey || '',
        uniqueKey: cardholder.uniqueKey || '',
        validTill: formattedValidTill,
        ...customData,
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
          opacity: 0.08,
          rotate: degrees(30),
        });

        // Back Card Watermark
        page.drawText(wmText, {
          x: 270 + scaledWidth / 2 - xOffsetWm,
          y: (yOffset - scaledHeight) + scaledHeight / 2 - yOffsetWm,
          size: wmSize,
          font: fontBold,
          color: rgb(0.85, 0.15, 0.15),
          opacity: 0.08,
          rotate: degrees(30),
        });

        // Draw cardholder details
        await safeDrawText(page, pdfDoc, cardholder.name, {
          x: 480,
          y: yOffset - 40,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        let currentY = yOffset - 53;
        // Always draw ID if not already in uniqueFieldsMap and present
        const hasIdField = uniqueFieldsMap.has('uniqueKey') || uniqueFieldsMap.has('id');
        if (!hasIdField && cardholder.uniqueKey) {
          await safeDrawText(page, pdfDoc, `ID: ${cardholder.uniqueKey}`, {
            x: 480,
            y: currentY,
            size: 8,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });
          currentY -= 12;
        }

        for (const [fieldKey, fieldConfig] of uniqueFieldsMap.entries()) {
          const kClean = fieldKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (kClean === 'name' || kClean.includes('name')) continue;
          const val = getResolvedFieldValue(fieldKey, cardholderData, cardholder);
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            let label = fieldConfig.prefix ? fieldConfig.prefix.trim().replace(/:$/, '') : '';
            if (!label) {
              label = fieldKey
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();
            }
            const textToDraw = `${label}: ${val}`;
            await safeDrawText(page, pdfDoc, textToDraw, {
              x: 480,
              y: currentY,
              size: 8,
              font,
              color: rgb(0.4, 0.4, 0.4),
            });
            currentY -= 12;
          }
        }

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
          opacity: 0.08,
          rotate: degrees(30),
        });

        // Draw details below the card
        await safeDrawText(page, pdfDoc, cardholder.name, {
          x: xOffset,
          y: yOffset - scaledHeight - 12,
          size: 8,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        const detailsList: string[] = [];
        const hasIdField = uniqueFieldsMap.has('uniqueKey') || uniqueFieldsMap.has('id');
        if (!hasIdField && cardholder.uniqueKey) {
          detailsList.push(`ID: ${cardholder.uniqueKey}`);
        }
        for (const [fieldKey, fieldConfig] of uniqueFieldsMap.entries()) {
          const kClean = fieldKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (kClean === 'name' || kClean.includes('name')) continue;
          const val = getResolvedFieldValue(fieldKey, cardholderData, cardholder);
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            let label = fieldConfig.prefix ? fieldConfig.prefix.trim().replace(/:$/, '') : '';
            if (!label) {
              label = fieldKey
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();
            }
            detailsList.push(`${label}: ${val}`);
          }
        }
        const detailsLine = detailsList.join(' | ');
        await safeDrawText(page, pdfDoc, detailsLine, {
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
