import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { renderCardSideToPdfBytesClient, FieldCoordinate } from './card-renderer-client';

export interface PdfGeneratorOptions {
  paperSize?: 'A3' | 'A4' | 'CR80' | 'CUSTOM';
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  customWidth?: number;  // in pt
  customHeight?: number; // in pt
  bleed?: number;        // in pt (default 0)
  cropMarks?: boolean;
  registrationMarks?: boolean;
  foldLine?: boolean;
  marginLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  colGap?: number;
  rowGap?: number;
}

export async function generateProductionPdfClient(
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
    uniqueKey?: string | null;
    customFields?: any;
  }>,
  options: PdfGeneratorOptions,
  pressFonts: Array<{ name: string; fileUrl: string }> = [],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  // R7: PDF/X Compliance metadata setup
  pdfDoc.setTitle('Production Print File');
  pdfDoc.setCreator('ID Card Press Platform');

  // A3 dimensions (in points)
  let pageWidth = 841.89;
  let pageHeight = 1190.55;

  if (options.paperSize === 'A4') {
    pageWidth = 595.27;
    pageHeight = 841.89;
  }

  if (options.paperSize === 'CUSTOM') {
    pageWidth = options.customWidth || pageWidth;
    pageHeight = options.customHeight || pageHeight;
  } else if (options.orientation === 'LANDSCAPE') {
    const temp = pageWidth;
    pageWidth = pageHeight;
    pageHeight = temp;
  }

  const bleed = options.bleed || 0; // standard bleed is 3mm = 8.5 pt

  // Determine card dimensions based on template orientation
  const isPortraitTemplate = template.cardWidth < template.cardHeight;
  const cardBaseWidth = isPortraitTemplate ? 153 : 242.6;
  const cardBaseHeight = isPortraitTemplate ? 242.6 : 153;

  const cWidth = cardBaseWidth + bleed * 2;
  const cHeight = cardBaseHeight + bleed * 2;

  // Layout configuration
  const marginX    = options.marginLeft  ?? 40;
  const marginXR   = options.marginRight ?? 40;
  const marginY    = options.marginTop   ?? 40;
  const marginYB   = options.marginBottom ?? 40;
  const colGap     = options.colGap      ?? 15;
  const rowGap     = options.rowGap      ?? 15;

  const foldGap = 10;
  const isSingleSided = !template.backImageUrl || (template.backFields === '[]' || !template.backFields);

  const cols = Math.floor((pageWidth - marginX - marginXR + colGap) / (cWidth + colGap)) || 1;

  let cardsPerPage: number;
  let rowsPerPage: number;
  let centerY = pageHeight / 2;
  let rowsPerHalf: number;

  if (isSingleSided) {
    const fullHeight = pageHeight - marginY - marginYB;
    rowsPerPage = Math.floor((fullHeight + rowGap) / (cHeight + rowGap)) || 1;
    cardsPerPage = cols * rowsPerPage;
    rowsPerHalf = rowsPerPage;
  } else {
    const halfHeight = centerY - Math.max(marginY, marginYB);
    rowsPerHalf = Math.floor((halfHeight - foldGap + rowGap) / (cHeight + rowGap)) || 1;
    rowsPerPage = rowsPerHalf;
    cardsPerPage = cols * rowsPerHalf;
  }

  const total = cardholders.length;
  const totalPages = Math.ceil(total / cardsPerPage);

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

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Set explicit PDF/X boundary boxes
    page.setMediaBox(0, 0, pageWidth, pageHeight);
    page.setBleedBox(0, 0, pageWidth, pageHeight);
    page.setTrimBox(0, 0, pageWidth, pageHeight);

    const startIdx = pIdx * cardsPerPage;
    const endIdx = Math.min(startIdx + cardsPerPage, total);
    const batchCards = cardholders.slice(startIdx, endIdx);

    // Draw fold line only for duplex templates
    if (!isSingleSided && options.foldLine) {
      page.drawLine({
        start: { x: marginX - 10, y: centerY },
        end: { x: pageWidth - marginX + 10, y: centerY },
        thickness: 0.5,
        color: rgb(0.8, 0.1, 0.1),
        dashArray: [4, 4],
      });

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText('FOLD LINE', {
        x: marginX,
        y: centerY + 2,
        size: 6,
        font,
        color: rgb(0.8, 0.1, 0.1),
      });
    }

    for (let gridIdx = 0; gridIdx < batchCards.length; gridIdx++) {
      const cardholder = batchCards[gridIdx];
      const colIdx = gridIdx % cols;
      const rowIdx = Math.floor(gridIdx / cols);

      const xPos = marginX + colIdx * (cWidth + colGap);

      let frontsY: number;
      let backsY: number | null = null;

      if (isSingleSided) {
        frontsY = pageHeight - marginY - rowIdx * (cHeight + rowGap) - cHeight;
      } else {
        frontsY = pageHeight - marginY - rowIdx * (cHeight + rowGap) - cHeight;
        backsY = 2 * centerY - frontsY - cHeight;
      }

      const clientCardholder = {
        id: cardholder.id,
        name: cardholder.name,
        designation: cardholder.designation,
        photoUrl: cardholder.photoUrl,
        cardSerial: cardholder.cardSerial,
        uniqueKey: cardholder.uniqueKey || null,
        customFields: typeof cardholder.customFields === 'string' ? cardholder.customFields : JSON.stringify(cardholder.customFields || {}),
      };

      // Render front side
      const frontPdfBytes = await renderCardSideToPdfBytesClient(clientTemplate, clientCardholder, 'front', parsedValidTill, pressFonts);
      const [frontEmbedded] = await pdfDoc.embedPdf(await PDFDocument.load(frontPdfBytes), [0]);

      if (isSingleSided) {
        page.drawPage(frontEmbedded, { x: xPos, y: frontsY, width: cWidth, height: cHeight });
      } else {
        // Draw front
        page.drawPage(frontEmbedded, { x: xPos, y: frontsY, width: cWidth, height: cHeight });

        // Render and draw back (rotated 180 degrees)
        const backPdfBytes = await renderCardSideToPdfBytesClient(clientTemplate, clientCardholder, 'back', parsedValidTill, pressFonts);
        const [backEmbedded] = await pdfDoc.embedPdf(await PDFDocument.load(backPdfBytes), [0]);

        page.drawPage(backEmbedded, {
          x: xPos + cWidth,
          y: backsY! + cHeight,
          width: cWidth,
          height: cHeight,
          rotate: degrees(180),
        });
      }

      // Draw crop marks
      if (options.cropMarks) {
        const markLen = 10;
        const strokeColor = rgb(0.5, 0.5, 0.5);
        const thickness = 0.5;

        const drawCardCropMarks = (x: number, y: number) => {
          // Top-Left
          page.drawLine({ start: { x: x - markLen, y: y + cHeight }, end: { x: x - 2, y: y + cHeight }, thickness, color: strokeColor });
          page.drawLine({ start: { x: x, y: y + cHeight + markLen }, end: { x: x, y: y + cHeight + 2 }, thickness, color: strokeColor });
          // Top-Right
          page.drawLine({ start: { x: x + cWidth + 2, y: y + cHeight }, end: { x: x + cWidth + markLen, y: y + cHeight }, thickness, color: strokeColor });
          page.drawLine({ start: { x: x + cWidth, y: y + cHeight + markLen }, end: { x: x + cWidth, y: y + cHeight + 2 }, thickness, color: strokeColor });
          // Bottom-Left
          page.drawLine({ start: { x: x - markLen, y: y }, end: { x: x - 2, y: y }, thickness, color: strokeColor });
          page.drawLine({ start: { x: x, y: y - markLen }, end: { x: x, y: y - 2 }, thickness, color: strokeColor });
          // Bottom-Right
          page.drawLine({ start: { x: x + cWidth + 2, y: y }, end: { x: x + cWidth + markLen, y: y }, thickness, color: strokeColor });
          page.drawLine({ start: { x: x + cWidth, y: y - markLen }, end: { x: x + cWidth, y: y - 2 }, thickness, color: strokeColor });
        };

        drawCardCropMarks(xPos, frontsY);
        if (!isSingleSided && backsY !== null) {
          drawCardCropMarks(xPos, backsY);
        }
      }
    }

    if (onProgress) {
      onProgress(Math.round(((pIdx + 1) / totalPages) * 100));
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
