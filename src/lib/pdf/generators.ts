import { PDFDocument, rgb, StandardFonts, PDFName, PDFString, PDFDict, degrees } from 'pdf-lib';
import { getOrRenderCard } from './cache-manager';
import { prisma } from '../prisma';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';


export interface PdfGeneratorOptions {
  paperSize?: 'A3' | 'A4' | 'CR80' | 'CUSTOM';
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  customWidth?: number;  // in pt
  customHeight?: number; // in pt
  bleed?: number;        // in pt (default 0)
  cropMarks?: boolean;
  registrationMarks?: boolean;
  foldLine?: boolean;
  // Layout spacing (all in points, applied to production grid)
  marginLeft?: number;   // default 40
  marginTop?: number;    // default 40
  marginRight?: number;  // default 40
  marginBottom?: number; // default 40
  colGap?: number;       // gap between card columns (default 15)
  rowGap?: number;       // gap between card rows (default 15)
}

export interface IPdfGenerator {
  generate(
    pressId: number,
    orderId: number,
    cardholderIds: number[],
    options: PdfGeneratorOptions,
    onProgress?: (percent: number) => Promise<void>
  ): Promise<Buffer>;
}

// ── 1. INDIVIDUAL PDF GENERATOR ───────────────────────────
// Generates standard CR-80 card size pages. Page 1: Front, Page 2: Back for each student.
export class IndividualPdfGenerator implements IPdfGenerator {
  async generate(
    pressId: number,
    orderId: number,
    cardholderIds: number[],
    options: PdfGeneratorOptions,
    onProgress?: (percent: number) => Promise<void>
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();

    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      include: { template: true },
    });
    if (!order) throw new Error('Order not found');

    const pressFonts = await prisma.pressFont.findMany({
      where: {
        OR: [
          { pressId },
          { pressId: null }
        ]
      }
    });

    // CR-80 Standard Dimensions: 85.6mm x 53.98mm -> 242.6 pt x 153 pt
    const isPortraitTemplate = (order.template?.cardWidth || 1011) < (order.template?.cardHeight || 638);
    const cardWidth = isPortraitTemplate ? 153 : 242.6;
    const cardHeight = isPortraitTemplate ? 242.6 : 153;


    const total = cardholderIds.length;
    for (let i = 0; i < total; i++) {
      const chId = cardholderIds[i];
      const cardholder = await prisma.cardholder.findFirst({ where: { id: chId, pressId } });
      if (!cardholder) continue;

      // Get rendered front and back card images (utilizes caching layer)
      const { frontBuffer, backBuffer, frontPdfBuffer, backPdfBuffer } = await getOrRenderCard(pressId, cardholder.id, order.templateId, order.validTill);
      
      if (frontPdfBuffer && backPdfBuffer) {
        const frontPages = await pdfDoc.embedPdf(frontPdfBuffer);
        const backPages = await pdfDoc.embedPdf(backPdfBuffer);
        
        const page1 = pdfDoc.addPage([cardWidth, cardHeight]);
        page1.drawPage(frontPages[0], { x: 0, y: 0, width: cardWidth, height: cardHeight });
        
        const page2 = pdfDoc.addPage([cardWidth, cardHeight]);
        page2.drawPage(backPages[0], { x: 0, y: 0, width: cardWidth, height: cardHeight });
      } else {
        const frontImg = await pdfDoc.embedPng(frontBuffer);
        const page1 = pdfDoc.addPage([cardWidth, cardHeight]);
        page1.drawImage(frontImg, { x: 0, y: 0, width: cardWidth, height: cardHeight });

        const backImg = await pdfDoc.embedPng(backBuffer);
        const page2 = pdfDoc.addPage([cardWidth, cardHeight]);
        page2.drawImage(backImg, { x: 0, y: 0, width: cardWidth, height: cardHeight });
      }

      if (onProgress) {
        await onProgress(Math.round(((i + 1) / total) * 100));
      }
    }

    return Buffer.from(await pdfDoc.save());
  }
}

// ── 2. APPROVAL PDF GENERATOR ────────────────────────────
// Layout: A4 pages, 4 cardholders per page. Displays Front + Back side-by-side with watermarks.
export class ApprovalPdfGenerator implements IPdfGenerator {
  async generate(
    pressId: number,
    orderId: number,
    cardholderIds: number[],
    options: PdfGeneratorOptions,
    onProgress?: (percent: number) => Promise<void>
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      include: { template: true, client: true },
    });
    if (!order) throw new Error('Order not found');

    const pressFonts = await prisma.pressFont.findMany({
      where: {
        OR: [
          { pressId },
          { pressId: null }
        ]
      }
    });

    // A4 Portrait Size: 595.27 pt x 841.89 pt
    const pageWidth = 595.27;
    const pageHeight = 841.89;

    const cardsPerPage = 4;
    const total = cardholderIds.length;
    const totalPages = Math.ceil(total / cardsPerPage);

    // CR-80 size scaled on sheet for approval display (e.g. width = 200 pt, height = 126 pt)
    const isPortraitTemplate = (order.template?.cardWidth || 1011) < (order.template?.cardHeight || 638);
    const scaledWidth = isPortraitTemplate ? 100 : 200;
    const scaledHeight = isPortraitTemplate ? 158.6 : 126;


    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw Header on each page
      page.drawText('PROOF SHEET — FOR CLIENT APPROVAL ONLY', { x: 50, y: 800, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
      page.drawText(`Client: ${order.client.name} | Order ID: #${order.id} | Page: ${pageIdx + 1} of ${totalPages}`, { x: 50, y: 780, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

      // Draw diagonal watermark
      page.drawText('PROOF ONLY - DO NOT PRINT', {
        x: 80,
        y: 200,
        size: 36,
        font: fontBold,
        color: rgb(0.9, 0.3, 0.3),
        opacity: 0.15,
        rotate: degrees(45),
      });

      const startChIdx = pageIdx * cardsPerPage;
      const endChIdx = Math.min(startChIdx + cardsPerPage, total);

      for (let idx = startChIdx; idx < endChIdx; idx++) {
        const chId = cardholderIds[idx];
        const cardholder = await prisma.cardholder.findFirst({ where: { id: chId, pressId } });
        if (!cardholder) continue;

        const rowIdx = idx - startChIdx; // 0, 1, 2, 3
        const rowStep = isPortraitTemplate ? 180 : 160;
        const yOffset = (isPortraitTemplate ? 770 : 740) - rowIdx * rowStep; // vertical position


        // Render card sides (utilizes caching layer)
        const { frontBuffer, backBuffer, frontPdfBuffer, backPdfBuffer } = await getOrRenderCard(pressId, cardholder.id, order.templateId, order.validTill);
        
        if (frontPdfBuffer && backPdfBuffer) {
          const frontPages = await pdfDoc.embedPdf(frontPdfBuffer);
          const backPages = await pdfDoc.embedPdf(backPdfBuffer);
          page.drawPage(frontPages[0], { x: 50, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
          page.drawPage(backPages[0], { x: 270, y: yOffset - scaledHeight, width: scaledWidth, height: scaledHeight });
        } else {
          const frontImg = await pdfDoc.embedPng(frontBuffer);
          const backImg = await pdfDoc.embedPng(backBuffer);

          // Draw Front & Back side-by-side
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
        page.drawText(`Serial: ${cardholder.cardSerial || 'Pending'}`, {
          x: 480,
          y: yOffset - 60,
          size: 8,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        page.drawText(`Unique Key: ${cardholder.uniqueKey || 'N/A'}`, {
          x: 480,
          y: yOffset - 80,
          size: 8,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });

        // Separator line
        const separatorY = yOffset - scaledHeight - (isPortraitTemplate ? 10 : 15);
        page.drawLine({
          start: { x: 30, y: separatorY },
          end: { x: 565, y: separatorY },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });

      }

      // If it's the last page, draw the signature block at the bottom
      if (pageIdx === totalPages - 1) {
        const sigY = 80;
        page.drawText('I hereby approve these card layouts for final production print.', {
          x: 50,
          y: sigY + 40,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        page.drawText('Signature: __________________________', {
          x: 50,
          y: sigY,
          size: 10,
          font: fontBold,
        });
        page.drawText('Date: ______________', {
          x: 420,
          y: sigY,
          size: 10,
          font: fontBold,
        });
      }

      if (onProgress) {
        await onProgress(Math.round(((pageIdx + 1) / totalPages) * 100));
      }
    }

    return Buffer.from(await pdfDoc.save());
  }
}

// ── 3. PRODUCTION PDF GENERATOR ──────────────────────────
// Layout: Grid placement on A3 (Portrait/Landscape) with Crop Marks, Bleed, Fold-lines.
// Organizes Front cards in top rows, Fold line, then Back cards in matching reverse order so that
// when printed, folded along the fold line, and cut, front and back align perfectly.
export class ProductionPdfGenerator implements IPdfGenerator {
  async generate(
    pressId: number,
    orderId: number,
    cardholderIds: number[],
    options: PdfGeneratorOptions,
    onProgress?: (percent: number) => Promise<void>
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();

    // R7: PDF/X Compliance metadata setup
    pdfDoc.setTitle('Production Print File');
    pdfDoc.setCreator('ID Card Press Platform');

    // 1. Embed FOGRA39 ICC color profile for CMYK color space calibration
    let profileRef;
    try {
      const iccPath = path.join(process.cwd(), 'src', 'resources', 'color', 'CoatedFOGRA39.icc');
      if (fs.existsSync(iccPath)) {
        const iccBuffer = fs.readFileSync(iccPath);
        const profileStream = pdfDoc.context.stream(iccBuffer, {
          Type: 'ICCProfile',
          N: 4, // CMYK (4 color channels)
          Alternate: 'DeviceCMYK',
        });
        profileRef = pdfDoc.context.register(profileStream);
      }
    } catch (err) {
      console.error('Error loading FOGRA39 ICC profile:', err);
    }

    // 2. Define OutputIntent referencing the embedded profile
    const outputIntentDict: any = {
      Type: 'OutputIntent',
      S: 'GTS_PDFX',
      OutputConditionIdentifier: 'FOGRA39',
      RegistryName: 'http://www.color.org',
      Info: 'FOGRA39 (Coated FOGRA39)',
      OutputCondition: 'Offset printing according to ISO 12647-2:2004',
    };

    if (profileRef) {
      outputIntentDict.DestOutputProfile = profileRef;
    }

    const outputIntentObj = pdfDoc.context.obj(outputIntentDict);
    pdfDoc.catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([outputIntentObj]));

    // 3. Set PDF/X conformance in standard PDF Info Dictionary
    const info = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Info);
    if (info instanceof PDFDict) {
      info.set(PDFName.of('GTS_PDFXVersion'), PDFString.of('PDF/X-1a:2001'));
      info.set(PDFName.of('GTS_PDFXConformance'), PDFString.of('PDF/X-1a:2001'));
      info.set(PDFName.of('Trapped'), PDFName.of('False'));
    }

    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      include: { template: true },
    });
    if (!order) throw new Error('Order not found');

    const pressFonts = await prisma.pressFont.findMany({
      where: {
        OR: [
          { pressId },
          { pressId: null }
        ]
      }
    });

    // Page dimensions in points
    // A3 Portrait: 841.89 pt x 1190.55 pt
    // A3 Landscape: 1190.55 pt x 841.89 pt
    let pageWidth = 841.89;
    let pageHeight = 1190.55;

    if (options.paperSize === 'CUSTOM') {
      pageWidth = options.customWidth || pageWidth;
      pageHeight = options.customHeight || pageHeight;
    } else if (options.orientation === 'LANDSCAPE') {
      pageWidth = 1190.55;
      pageHeight = 841.89;
    }

    const bleed = options.bleed || 0; // standard bleed is 3mm = 8.5 pt

    // R7: Determine card dimensions based on template orientation
    const isPortraitTemplate = (order.template?.cardWidth || 1011) < (order.template?.cardHeight || 638);
    const cardBaseWidth = isPortraitTemplate ? 153 : 242.6;
    const cardBaseHeight = isPortraitTemplate ? 242.6 : 153;

    const cWidth = cardBaseWidth + bleed * 2;
    const cHeight = cardBaseHeight + bleed * 2;

    // Layout configuration — use caller-supplied values or defaults
    const marginX    = options.marginLeft  ?? 40;
    const marginXR   = options.marginRight ?? 40;
    const marginY    = options.marginTop   ?? 40;
    const marginYB   = options.marginBottom ?? 40;
    const colGap     = options.colGap      ?? 15;
    const rowGap     = options.rowGap      ?? 15;
    void marginXR; void marginYB; // used implicitly via remaining space

    const foldGap = 10;
    const isSingleSided = !order.template?.backImageUrl;

    const cols = Math.floor((pageWidth - marginX - marginXR + colGap) / (cWidth + colGap)) || 1;

    let cardsPerPage: number;
    let rowsPerPage: number;
    let centerY = pageHeight / 2;
    let rowsPerHalf: number;

    if (isSingleSided) {
      // Full page — no fold, no backs
      const fullHeight = pageHeight - marginY - marginYB;
      rowsPerPage = Math.floor((fullHeight + rowGap) / (cHeight + rowGap)) || 1;
      cardsPerPage = cols * rowsPerPage;
      rowsPerHalf = rowsPerPage; // unused in single-sided path but keep ref
    } else {
      // Page split into two halves (fronts top, backs bottom) for center-fold duplex
      const halfHeight = centerY - Math.max(marginY, marginYB);
      rowsPerHalf = Math.floor((halfHeight - foldGap + rowGap) / (cHeight + rowGap)) || 1;
      rowsPerPage = rowsPerHalf;
      cardsPerPage = cols * rowsPerHalf;
    }

    const total = cardholderIds.length;
    const totalPages = Math.ceil(total / cardsPerPage);

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Set explicit PDF/X boundary boxes
      page.setMediaBox(0, 0, pageWidth, pageHeight);
      page.setBleedBox(0, 0, pageWidth, pageHeight);
      page.setTrimBox(0, 0, pageWidth, pageHeight);

      const startIdx = pIdx * cardsPerPage;
      const endIdx = Math.min(startIdx + cardsPerPage, total);
      const batchIds = cardholderIds.slice(startIdx, endIdx);

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

      for (let gridIdx = 0; gridIdx < batchIds.length; gridIdx++) {
        const chId = batchIds[gridIdx];
        const cardholder = await prisma.cardholder.findFirst({ where: { id: chId, pressId } });
        if (!cardholder) continue;

        const colIdx = gridIdx % cols;
        const rowIdx = Math.floor(gridIdx / cols);

        const xPos = marginX + colIdx * (cWidth + colGap);

        let frontsY: number;
        let backsY: number | null = null;

        if (isSingleSided) {
          // Full-page grid — top to bottom, no fold, no backs
          frontsY = pageHeight - marginY - rowIdx * (cHeight + rowGap) - cHeight;
        } else {
          // Duplex: fronts top half, backs bottom half (center-fold aligned)
          frontsY = pageHeight - marginY - rowIdx * (cHeight + rowGap) - cHeight;
          backsY = 2 * centerY - frontsY - cHeight;
        }

        // Render card sides (utilizes caching layer)
        const { frontBuffer, backBuffer, frontPdfBuffer, backPdfBuffer } = await getOrRenderCard(pressId, cardholder.id, order.templateId, order.validTill);

        if (isSingleSided) {
          // ── Single-sided: front only ──
          if (frontPdfBuffer) {
            const frontPages = await pdfDoc.embedPdf(frontPdfBuffer);
            page.drawPage(frontPages[0], { x: xPos, y: frontsY, width: cWidth, height: cHeight });
          } else {
            const frontImg = await pdfDoc.embedPng(frontBuffer);
            page.drawImage(frontImg, { x: xPos, y: frontsY, width: cWidth, height: cHeight });
          }
        } else {
          // ── Duplex: front + back (rotated 180°) ──
          if (frontPdfBuffer && backPdfBuffer) {
            const frontPages = await pdfDoc.embedPdf(frontPdfBuffer);
            page.drawPage(frontPages[0], { x: xPos, y: frontsY, width: cWidth, height: cHeight });

            const backPages = await pdfDoc.embedPdf(backPdfBuffer);
            page.drawPage(backPages[0], {
              x: xPos + cWidth,
              y: backsY! + cHeight,
              width: cWidth,
              height: cHeight,
              rotate: degrees(180),
            });
          } else {
            const frontImg = await pdfDoc.embedPng(frontBuffer);
            page.drawImage(frontImg, { x: xPos, y: frontsY, width: cWidth, height: cHeight });

            const rotatedBackBuffer = await sharp(backBuffer).rotate(180).toBuffer();
            const backImg = await pdfDoc.embedPng(rotatedBackBuffer);
            page.drawImage(backImg, { x: xPos, y: backsY!, width: cWidth, height: cHeight });
          }
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
          if (!isSingleSided && backsY !== null) drawCardCropMarks(xPos, backsY);
        }
      }

      if (onProgress) {
        await onProgress(Math.round(((pIdx + 1) / totalPages) * 100));
      }
    }

    return Buffer.from(await pdfDoc.save());
  }
}

// ── 4. INVOICE PDF GENERATOR ─────────────────────────────
// Generates commercial invoice sheets for client print billing.
export class InvoicePdfGenerator implements IPdfGenerator {
  async generate(
    pressId: number,
    orderId: number,
    cardholderIds: number[], // not used for invoicing but matches signature
    options: PdfGeneratorOptions,
    onProgress?: (percent: number) => Promise<void>
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const press = await prisma.press.findUnique({ where: { id: pressId } });
    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      include: { client: true, invoice: true },
    });

    if (!press || !order || !order.invoice) {
      throw new Error('Invoice data not ready or order not found');
    }

    const page = pdfDoc.addPage([595.27, 841.89]); // A4 Page
    const inv = order.invoice;

    // Header / Branding
    page.drawText(press.name, { x: 50, y: 760, size: 20, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
    page.drawText(`Email: ${press.email} | City: ${press.city || 'N/A'}`, { x: 50, y: 740, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

    page.drawText('INVOICE', { x: 450, y: 760, size: 24, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`Invoice No: #INV-${inv.id}`, { x: 400, y: 740, size: 10, font });
    page.drawText(`Date: ${new Date(inv.createdAt).toLocaleDateString()}`, { x: 400, y: 725, size: 10, font });

    // Client Billing Details
    page.drawText('Billed To:', { x: 50, y: 670, size: 12, font: fontBold });
    page.drawText(order.client.name, { x: 50, y: 650, size: 11, font });
    page.drawText(`Phone: ${order.client.contactPhone || 'N/A'}`, { x: 50, y: 635, size: 10, font });
    page.drawText(`Address: ${order.client.address || 'N/A'}`, { x: 50, y: 620, size: 10, font });

    // Invoice Table Headers
    const tableY = 530;
    page.drawLine({ start: { x: 50, y: tableY }, end: { x: 545, y: tableY }, thickness: 1 });
    page.drawText('Item Description', { x: 60, y: tableY - 15, size: 10, font: fontBold });
    page.drawText('Qty', { x: 300, y: tableY - 15, size: 10, font: fontBold });
    page.drawText('Unit Price', { x: 370, y: tableY - 15, size: 10, font: fontBold });
    page.drawText('Amount', { x: 480, y: tableY - 15, size: 10, font: fontBold });
    page.drawLine({ start: { x: 50, y: tableY - 22 }, end: { x: 545, y: tableY - 22 }, thickness: 0.5 });

    // Table Row
    const rowY = tableY - 40;
    page.drawText(`ID Card Printing — ${order.status} batch`, { x: 60, y: rowY, size: 10, font });
    page.drawText(String(inv.cardCount), { x: 300, y: rowY, size: 10, font });
    page.drawText(`Rs. ${Number(inv.pricePerCard).toFixed(2)}`, { x: 370, y: rowY, size: 10, font });
    page.drawText(`Rs. ${Number(inv.subtotal).toFixed(2)}`, { x: 480, y: rowY, size: 10, font });

    // Totals section
    const totY = rowY - 100;
    page.drawLine({ start: { x: 350, y: totY }, end: { x: 545, y: totY }, thickness: 0.5 });
    page.drawText('Subtotal:', { x: 360, y: totY - 15, size: 10, font });
    page.drawText(`Rs. ${Number(inv.subtotal).toFixed(2)}`, { x: 485, y: totY - 15, size: 10, font });

    page.drawText(`GST (${inv.taxPercent}%):`, { x: 360, y: totY - 30, size: 10, font });
    page.drawText(`Rs. ${Number(inv.taxAmount).toFixed(2)}`, { x: 485, y: totY - 30, size: 10, font });

    page.drawText('Total Amount:', { x: 360, y: totY - 50, size: 11, font: fontBold });
    page.drawText(`Rs. ${Number(inv.totalAmount).toFixed(2)}`, { x: 485, y: totY - 50, size: 11, font: fontBold });

    // Payment Status Badge
    const badgeY = totY - 120;
    page.drawText('Payment Details:', { x: 50, y: badgeY + 20, size: 12, font: fontBold });
    page.drawText(`Status: ${inv.paymentStatus}`, { x: 50, y: badgeY, size: 10, font: fontBold, color: inv.paymentStatus === 'PAID' ? rgb(0.1, 0.6, 0.1) : rgb(0.8, 0.1, 0.1) });
    if (inv.paymentMethod) {
      page.drawText(`Method: ${inv.paymentMethod}`, { x: 50, y: badgeY - 15, size: 10, font });
    }

    if (onProgress) await onProgress(100);

    return Buffer.from(await pdfDoc.save());
  }
}

// ── 5. STRATEGY REGISTRY / FACTORY ────────────────────────
export class PDFGeneratorFactory {
  private static generators: Record<string, IPdfGenerator> = {
    PRODUCTION: new ProductionPdfGenerator(),
    APPROVAL: new ApprovalPdfGenerator(),
    INDIVIDUAL: new IndividualPdfGenerator(),
    INVOICE: new InvoicePdfGenerator(),
  };

  public static getGenerator(type: string): IPdfGenerator {
    const generator = this.generators[type.toUpperCase()];
    if (!generator) {
      throw new Error(`Unsupported PDF generation type: ${type}`);
    }
    return generator;
  }
}
