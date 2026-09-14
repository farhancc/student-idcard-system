'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Hash, 
  Printer, 
  Download, 
  RefreshCw, 
  Type, 
  CheckCircle, 
  AlertCircle,
  Grid,
  Sparkles,
  Move,
  FileText,
  FileCheck
} from 'lucide-react';
import { autoDownloadJobFile } from '@/lib/downloadHelper';

export default function SerialPrinterPage() {
  // Step State: 1 = Upload PDF, 2 = Position & Style, 3 = Print Settings, 4 = Print / Export
  const [activeStep, setActiveStep] = useState<number>(1);

  // ── PDF & Rendering State ──
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPdfPages, setTotalPdfPages] = useState<number>(1);
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string>('');

  const [imageSrc, setImageSrc] = useState<string>('');
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({ width: 856, height: 540 });
  const [unscaledDimensions, setUnscaledDimensions] = useState<{ width: number; height: number }>({ width: 242.6, height: 153.1 });

  // ── Field Position & Style State ──
  const [posX, setPosX] = useState<number>(50); // percentage (0-100)
  const [posY, setPosY] = useState<number>(85); // percentage (0-100)
  const [fontFamily, setFontFamily] = useState<string>('Inter, sans-serif');
  const [fontSize, setFontSize] = useState<number>(18); // pt (points)
  const [fontWeight, setFontWeight] = useState<string>('700');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [badgeBg, setBadgeBg] = useState<string>('rgba(0, 0, 0, 0.6)');
  const [useBadge, setUseBadge] = useState<boolean>(true);
  const [badgePadding, setBadgePadding] = useState<number>(6);
  const [badgeRadius, setBadgeRadius] = useState<number>(4);

  // ── Serial Sequence Rules State ──
  const [prefix, setPrefix] = useState<string>('NO. ');
  const [suffix, setSuffix] = useState<string>('');
  const [startSeq, setStartSeq] = useState<number>(1);
  const [stepSeq, setStepSeq] = useState<number>(1);
  const [padLength, setPadLength] = useState<number>(4);

  // ── Quantity & Print Sheet Layout State ──
  const [quantity, setQuantity] = useState<number>(20);
  const [paperSize, setPaperSize] = useState<'A4' | 'LETTER' | 'SINGLE'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [cols, setCols] = useState<number>(2);
  const [rows, setRows] = useState<number>(5);
  const [showCropMarks, setShowCropMarks] = useState<boolean>(true);
  const [marginMm, setMarginMm] = useState<number>(10);

  // ── Generation & Export State ──
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [previewSampleSerial, setPreviewSampleSerial] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Helper to format sequence number
  const formatSerial = (num: number) => {
    const padded = String(num).padStart(padLength, '0');
    return `${prefix}${padded}${suffix}`;
  };

  useEffect(() => {
    setPreviewSampleSerial(formatSerial(startSeq));
  }, [prefix, suffix, startSeq, padLength]);

  // Load PDF page into canvas data URL using pdfjs-dist
  const loadPdfTemplate = async (buffer: ArrayBuffer, pageNum: number = 1) => {
    setIsLoadingPdf(true);
    setPdfError('');
    try {
      const pdfjsLib = await import('pdfjs-dist');
      if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.mjs`;
      }
      
      let pdfDoc;
      try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) });
        pdfDoc = await loadingTask.promise;
      } catch (workerError) {
        console.warn('Worker load failed, falling back to main-thread PDF rendering:', workerError);
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        const fallbackTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) });
        pdfDoc = await fallbackTask.promise;
      }
      
      setTotalPdfPages(pdfDoc.numPages);
      
      const page = await pdfDoc.getPage(pageNum);
      
      // Track natural unscaled PDF viewport in points (pt)
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      setUnscaledDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

      // High-res preview scale for sharp template viewing
      const viewport = page.getViewport({ scale: 3.0 });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');
      
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      
      const dataUrl = canvas.toDataURL('image/png');
      setImageSrc(dataUrl);
      setImgDimensions({ width: viewport.width, height: viewport.height });
      setActiveStep(2);
    } catch (err: any) {
      console.error('Error parsing PDF:', err);
      setPdfError(err.message || 'Failed to load PDF file. Please ensure it is a valid PDF document.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Process uploaded PDF file
  const processPdfFile = async (file: File) => {
    // STRICT PDF TYPE CHECKING: Reject JPG, PNG, WEBP, SVG, etc.
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setPdfError(`Invalid file "${file.name}". Serial printing strictly accepts PDF files (.pdf) only. Images (JPG, PNG, SVG) are not allowed.`);
      return;
    }

    setPdfError('');
    setPdfFile(file);
    try {
      const buffer = await file.arrayBuffer();
      setPdfBuffer(buffer.slice(0));
      setSelectedPageNum(1);
      await loadPdfTemplate(buffer.slice(0), 1);
    } catch (err: any) {
      setPdfError('Failed to read PDF file content. Please try again.');
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPdfFile(file);
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processPdfFile(file);
  };

  // Generate Sample PDF Template in Memory
  const loadSamplePdfTemplate = async () => {
    setIsLoadingPdf(true);
    setPdfError('');
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([856, 540]);

      // Draw stylish gradient background
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 856,
        height: 540,
        color: rgb(0.12, 0.11, 0.29),
      });

      // Top Gold Accent Line
      page.drawRectangle({
        x: 0,
        y: 528,
        width: 856,
        height: 12,
        color: rgb(0.96, 0.62, 0.04),
      });

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText('VIP EVENT PASS / TOKEN PDF TEMPLATE', {
        x: 40,
        y: 450,
        size: 26,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText('OFFICIAL SERIALIZED ACCESS & TRACKING DOCUMENT', {
        x: 40,
        y: 415,
        size: 14,
        font: fontReg,
        color: rgb(0.75, 0.8, 0.88),
      });

      // Border line
      page.drawRectangle({
        x: 30,
        y: 30,
        width: 796,
        height: 480,
        borderColor: rgb(0.3, 0.35, 0.75),
        borderWidth: 2,
      });

      const bytes = await pdfDoc.save();
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      setPdfFile(new File([buffer.slice(0)], 'sample_ticket_template.pdf', { type: 'application/pdf' }));
      setPdfBuffer(buffer.slice(0));
      setSelectedPageNum(1);
      await loadPdfTemplate(buffer.slice(0), 1);
    } catch (err: any) {
      console.error('Failed to generate sample PDF:', err);
      setPdfError('Failed to generate sample PDF template.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Change PDF Page
  const handlePageChange = async (newPage: number) => {
    if (!pdfBuffer || pdfBuffer.byteLength === 0 || newPage < 1 || newPage > totalPdfPages) return;
    setSelectedPageNum(newPage);
    await loadPdfTemplate(pdfBuffer.slice(0), newPage);
  };

  // Render live preview on canvas
  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Draw background PDF page image
      ctx.drawImage(img, 0, 0);

      // Format current preview serial
      const serialText = formatSerial(startSeq);

      // Calculate position
      const x = (posX / 100) * canvas.width;
      const y = (posY / 100) * canvas.height;

      // Scale font size proportionally to canvas rendering resolution
      const scaleFactor = canvas.width / (unscaledDimensions.width || 856);
      const currentFontSize = fontSize * scaleFactor;

      // Set text styles
      ctx.font = `${fontStyle} ${fontWeight} ${currentFontSize}px ${fontFamily}`;
      ctx.textAlign = textAlign;
      ctx.textBaseline = 'middle';

      const textMetrics = ctx.measureText(serialText);
      const textWidth = textMetrics.width;
      const textHeight = currentFontSize * 1.2;

      const padding = badgePadding * scaleFactor;
      const radius = badgeRadius * scaleFactor;

      // Draw background badge if enabled
      if (useBadge && badgeBg) {
        let badgeX = x - textWidth / 2 - padding;
        if (textAlign === 'left') badgeX = x - padding;
        if (textAlign === 'right') badgeX = x - textWidth - padding;

        const badgeY = y - textHeight / 2 - padding / 2;
        const badgeW = textWidth + padding * 2;
        const badgeH = textHeight + padding;

        ctx.fillStyle = badgeBg;
        if (radius > 0) {
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
          ctx.fill();
        } else {
          ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        }
      }

      // Draw serial text
      ctx.fillStyle = textColor;
      ctx.fillText(serialText, x, y);
    };
  }, [
    imageSrc,
    posX,
    posY,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    textColor,
    textAlign,
    badgeBg,
    useBadge,
    badgePadding,
    badgeRadius,
    prefix,
    suffix,
    startSeq,
    padLength,
    unscaledDimensions,
  ]);

  // Click on preview canvas to set position
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const pctX = Math.round((clickX / rect.width) * 100);
    const pctY = Math.round((clickY / rect.height) * 100);

    setPosX(pctX);
    setPosY(pctY);
  };

  const [downloadFallbackUrl, setDownloadFallbackUrl] = useState<string>('');
  const [downloadFileName, setDownloadFileName] = useState<string>('');
  const [savedFilePath, setSavedFilePath] = useState<string>('');

  // Helper to sanitize text for pdf-lib WinAnsi font encoding
  const sanitizeWinAnsiText = (text: string) => {
    return text
      .replace(/№/g, 'No.')
      .replace(/[—–]/g, '-')
      .replace(/[“”"]/g, '"')
      .replace(/[‘’']/g, "'")
      .replace(/[•·]/g, '.')
      .replace(/[^\x20-\x7E]/g, '');
  };

  // Helper to parse hex/rgba colors for pdf-lib vector elements
  const parseColorToRgbAndOpacity = (colorStr: string, rgbFn: (r: number, g: number, b: number) => any) => {
    let r = 0, g = 0, b = 0, opacity = 1.0;
    if (!colorStr) return { color: rgbFn(0, 0, 0), opacity: 1.0 };

    if (colorStr.startsWith('#')) {
      const hex = colorStr.replace('#', '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) / 255;
        g = parseInt(hex[1] + hex[1], 16) / 255;
        b = parseInt(hex[2] + hex[2], 16) / 255;
      } else if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16) / 255;
        g = parseInt(hex.substring(2, 4), 16) / 255;
        b = parseInt(hex.substring(4, 6), 16) / 255;
      }
    } else if (colorStr.startsWith('rgba')) {
      const parts = colorStr.match(/[\d.]+/g);
      if (parts && parts.length >= 3) {
        r = parseFloat(parts[0]) / 255;
        g = parseFloat(parts[1]) / 255;
        b = parseFloat(parts[2]) / 255;
        if (parts.length >= 4) opacity = parseFloat(parts[3]);
      }
    } else if (colorStr.startsWith('rgb')) {
      const parts = colorStr.match(/[\d.]+/g);
      if (parts && parts.length >= 3) {
        r = parseFloat(parts[0]) / 255;
        g = parseFloat(parts[1]) / 255;
        b = parseFloat(parts[2]) / 255;
      }
    }

    return { color: rgbFn(r, g, b), opacity };
  };

  // Helper to select pdf-lib StandardFonts for vector text
  const selectPdfFont = async (pdfDoc: any, family: string, weight: string, style: string, StandardFonts: any) => {
    const isBold = weight === '700' || weight === '900' || weight === '600' || weight === 'bold';
    const isItalic = style === 'italic';

    if (family.includes('Courier') || family.includes('monospace')) {
      if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
      if (isBold) return await pdfDoc.embedFont(StandardFonts.CourierBold);
      if (isItalic) return await pdfDoc.embedFont(StandardFonts.CourierOblique);
      return await pdfDoc.embedFont(StandardFonts.Courier);
    }

    if (family.includes('Georgia') || family.includes('serif') || family.includes('Times')) {
      if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
      if (isBold) return await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      if (isItalic) return await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      return await pdfDoc.embedFont(StandardFonts.TimesRoman);
    }

    if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    if (isBold) return await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    if (isItalic) return await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    return await pdfDoc.embedFont(StandardFonts.Helvetica);
  };

  // Generate 100% Pure Vector PDF Batch
  const handleGenerateAndPrint = async (action: 'print' | 'download') => {
    if (!pdfBuffer || pdfBuffer.byteLength === 0) {
      alert('PDF template buffer is empty or missing. Please re-upload your PDF template file.');
      return;
    }

    setIsGenerating(true);
    setRenderProgress(5);
    setDownloadFallbackUrl('');

    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      
      // Load source PDF vector document using a fresh slice to avoid detachment issues
      const sourcePdfDoc = await PDFDocument.load(pdfBuffer.slice(0));
      const targetPdfDoc = await PDFDocument.create();

      // Embed vector font
      const font = await selectPdfFont(targetPdfDoc, fontFamily, fontWeight, fontStyle, StandardFonts);

      // mm to pt conversion (1 mm = 2.83465 pt)
      const mmToPt = 2.83465;

      let pageW = 210 * mmToPt; // A4 width
      let pageH = 297 * mmToPt; // A4 height

      if (paperSize === 'LETTER') {
        pageW = 215.9 * mmToPt;
        pageH = 279.4 * mmToPt;
      }

      if (orientation === 'landscape' && paperSize !== 'SINGLE') {
        const tmp = pageW;
        pageW = pageH;
        pageH = tmp;
      }

      const itemsPerPage = paperSize === 'SINGLE' ? 1 : cols * rows;

      // Grid dimensions in pt
      const margin = marginMm * mmToPt;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;

      const cellW = paperSize === 'SINGLE' ? pageW : availW / cols;
      const cellH = paperSize === 'SINGLE' ? pageH : availH / rows;

      const sourcePageObj = sourcePdfDoc.getPages()[selectedPageNum - 1];
      const sourceSize = sourcePageObj.getSize();
      const cardW = sourceSize.width;
      const cardH = sourceSize.height;

      const imgAspect = cardW / cardH;
      let drawW = cellW * 0.95;
      let drawH = drawW / imgAspect;

      if (drawH > cellH * 0.95) {
        drawH = cellH * 0.95;
        drawW = drawH * imgAspect;
      }

      let currentPage: any = null;
      let embeddedVectorPage: any = null;

      if (paperSize !== 'SINGLE') {
        // Embed source PDF page as a pure vector XObject
        embeddedVectorPage = await targetPdfDoc.embedPage(sourcePageObj);
      }

      const textRgb = parseColorToRgbAndOpacity(textColor, rgb);
      const badgeRgb = parseColorToRgbAndOpacity(badgeBg, rgb);

      for (let i = 0; i < quantity; i++) {
        const currentSeq = startSeq + i * stepSeq;
        const rawSerialText = formatSerial(currentSeq);
        const serialText = sanitizeWinAnsiText(rawSerialText) || String(currentSeq);

        if (paperSize === 'SINGLE') {
          // ── SINGLE MODE: 100% PURE VECTOR PAGE COPY ──
          const [copiedPage] = await targetPdfDoc.copyPages(sourcePdfDoc, [selectedPageNum - 1]);
          const newPage = targetPdfDoc.addPage(copiedPage);
          const pSize = newPage.getSize();

          const textPt = fontSize;
          const textWidth = font.widthOfTextAtSize(serialText, textPt);

          const rawX = (posX / 100) * pSize.width;
          const rawY = pSize.height - (posY / 100) * pSize.height;

          let alignX = rawX - textWidth / 2;
          if (textAlign === 'left') alignX = rawX;
          if (textAlign === 'right') alignX = rawX - textWidth;

          if (useBadge && badgeBg) {
            const pad = badgePadding;
            const bW = textWidth + pad * 2;
            const bH = textPt * 1.2 + pad;
            let bX = alignX - pad;
            let bY = rawY - textPt * 0.3 - pad / 2;

            newPage.drawRectangle({
              x: bX,
              y: bY,
              width: bW,
              height: bH,
              color: badgeRgb.color,
              opacity: badgeRgb.opacity,
            });
          }

          newPage.drawText(serialText, {
            x: alignX,
            y: rawY - textPt * 0.3,
            size: textPt,
            font: font,
            color: textRgb.color,
            opacity: textRgb.opacity,
          });

        } else {
          // ── GRID MODE (A4 / LETTER): EMBEDDED PURE VECTOR XOBJECT ──
          const itemInPage = i % itemsPerPage;
          if (itemInPage === 0) {
            currentPage = targetPdfDoc.addPage([pageW, pageH]);
          }

          const colIdx = itemInPage % cols;
          const rowIdx = Math.floor(itemInPage / cols);

          const cellX = margin + colIdx * cellW;
          const cellY = pageH - margin - (rowIdx + 1) * cellH;

          const drawX = cellX + (cellW - drawW) / 2;
          const drawY = cellY + (cellH - drawH) / 2;

          // Draw vector embedded page object
          currentPage.drawPage(embeddedVectorPage, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });

          // Draw vector crop marks / cut border
          if (showCropMarks) {
            currentPage.drawRectangle({
              x: drawX,
              y: drawY,
              width: drawW,
              height: drawH,
              borderWidth: 0.5,
              borderColor: rgb(0.7, 0.7, 0.7),
            });
          }

          // Scale vector text & positioning to embedded cell
          const scaleRatio = drawW / cardW;
          const textPt = fontSize * scaleRatio;
          const textWidth = font.widthOfTextAtSize(serialText, textPt);

          const targetX = drawX + (posX / 100) * drawW;
          const targetY = drawY + drawH - (posY / 100) * drawH;

          let alignX = targetX - textWidth / 2;
          if (textAlign === 'left') alignX = targetX;
          if (textAlign === 'right') alignX = targetX - textWidth;

          if (useBadge && badgeBg) {
            const pad = badgePadding * scaleRatio;
            const bW = textWidth + pad * 2;
            const bH = textPt * 1.2 + pad;
            let bX = alignX - pad;
            let bY = targetY - textPt * 0.3 - pad / 2;

            currentPage.drawRectangle({
              x: bX,
              y: bY,
              width: bW,
              height: bH,
              color: badgeRgb.color,
              opacity: badgeRgb.opacity,
            });
          }

          currentPage.drawText(serialText, {
            x: alignX,
            y: targetY - textPt * 0.3,
            size: textPt,
            font: font,
            color: textRgb.color,
            opacity: textRgb.opacity,
          });
        }

        setRenderProgress(Math.round(((i + 1) / quantity) * 100));
      }

      const pdfBytes = await targetPdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      setDownloadFallbackUrl(blobUrl);

      const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'Serial';
      const fileName = `Vector_${cleanPrefix}_${startSeq}_to_${startSeq + (quantity - 1) * stepSeq}.pdf`;
      setDownloadFileName(fileName);

      if (action === 'download') {
        const localSavedPath = await autoDownloadJobFile(blobUrl, fileName, 'SerialPrint');
        if (localSavedPath) {
          setSavedFilePath(localSavedPath);
        }
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 10000);
        };
      }
    } catch (err: any) {
      console.error('Vector PDF generation error:', err);
      alert(`Failed to generate Vector PDF: ${err?.message || err}`);
    } finally {
      setIsGenerating(false);
      setRenderProgress(0);
    }
  };

  const resetAll = () => {
    setImageSrc('');
    setPdfFile(null);
    setPdfBuffer(null);
    setPdfError('');
    setActiveStep(1);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ marginBottom: '24px', padding: '24px', background: 'linear-gradient(135deg, rgba(49,46,129,0.4), rgba(15,23,42,0.6))', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Hash color="var(--primary)" size={26} /> Serial PDF Printer
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Upload a PDF template, position sequence numbers, and generate print sheets.
            </p>
          </div>
          {imageSrc && (
            <button className="btn btn-secondary" onClick={resetAll}>
              <RefreshCw size={14} /> New Batch
            </button>
          )}
        </div>
      </div>

      {/* Wizard Steps Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[
          { num: 1, label: '1. Upload PDF', icon: <FileText size={14} /> },
          { num: 2, label: '2. Position & Style', icon: <Type size={14} /> },
          { num: 3, label: '3. Print Settings', icon: <Grid size={14} /> },
          { num: 4, label: '4. Export', icon: <Printer size={14} /> },
        ].map((s) => {
          const isActive = activeStep === s.num;
          const isDone = activeStep > s.num;
          return (
            <React.Fragment key={s.num}>
              <button
                type="button"
                disabled={!imageSrc && s.num > 1}
                onClick={() => setActiveStep(s.num)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: imageSrc || s.num === 1 ? 'pointer' : 'not-allowed',
                  background: isActive ? '#6366f1' : isDone ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                  color: isActive ? '#ffffff' : isDone ? '#818cf8' : 'var(--muted)',
                  transition: 'all 0.2s',
                }}
              >
                {isDone ? <CheckCircle size={14} /> : s.icon}
                {s.label}
              </button>
              {s.num < 4 && <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)', minWidth: '16px' }} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── STEP 1: Upload PDF Template ── */}
      {activeStep === 1 && (
        <div className="glass-panel" style={{ padding: '36px', maxWidth: '780px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FileText size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '6px' }}>Upload PDF Template</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', maxWidth: '500px', margin: '0 auto 20px' }}>
            Select a PDF document or card template file (.pdf).
          </p>

          {pdfError && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{pdfError}</div>
            </div>
          )}

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? '#6366f1' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '12px',
              padding: '32px 20px',
              background: isDragging ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
              cursor: 'pointer',
              marginBottom: '20px'
            }}
          >
            <FileCheck size={36} color={isDragging ? '#818cf8' : 'var(--muted)'} style={{ marginBottom: '10px' }} />
            <div style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '4px' }}>
              Drag & Drop PDF Here
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '14px' }}>
              PDF files only (*.pdf)
            </div>

            <label className="btn btn-primary" style={{ display: 'inline-flex', padding: '10px 20px', fontSize: '0.9rem', cursor: 'pointer', gap: '8px' }}>
              <Upload size={16} /> Select PDF File
              <input type="file" accept="application/pdf,.pdf" onChange={handleFileInputChange} style={{ display: 'none' }} />
            </label>
          </div>

          {isLoadingPdf && (
            <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '12px' }}>
              Loading PDF...
            </div>
          )}

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn btn-secondary" disabled={isLoadingPdf} onClick={loadSamplePdfTemplate} style={{ fontSize: '0.85rem' }}>
              <Sparkles size={14} color="#f59e0b" /> Use Sample Template
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Position & Style Serial Field ── */}
      {activeStep === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px' }}>
          {/* Visual Canvas Positioning Area */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Move size={16} /> Field Position
              </h3>
              {totalPdfPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Page:</label>
                  <select 
                    className="form-select" 
                    value={selectedPageNum} 
                    onChange={e => handlePageChange(Number(e.target.value))}
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                  >
                    {Array.from({ length: totalPdfPages }, (_, i) => i + 1).map(p => (
                      <option key={p} value={p}>Page {p} of {totalPdfPages}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div 
              ref={containerRef}
              style={{ 
                position: 'relative', 
                background: '#090d16', 
                borderRadius: '8px', 
                overflow: 'hidden', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '12px'
              }}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                style={{
                  maxWidth: '100%',
                  maxHeight: '480px',
                  height: 'auto',
                  cursor: 'crosshair',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', fontSize: '0.8rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Horizontal X: {posX}%</label>
                <input type="range" min="0" max="100" value={posX} onChange={e => setPosX(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Vertical Y: {posY}%</label>
                <input type="range" min="0" max="100" value={posY} onChange={e => setPosY(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Controls: Sequence Rules & Text Decorators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Sequence Rules Card */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '0.92rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                Serial Number Format
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Prefix</label>
                  <input type="text" className="form-input" placeholder="e.g. NO. " value={prefix} onChange={e => setPrefix(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Suffix</label>
                  <input type="text" className="form-input" placeholder="e.g. -2026" value={suffix} onChange={e => setSuffix(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Number</label>
                  <input type="number" min="1" className="form-input" value={startSeq} onChange={e => setStartSeq(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Zero Padding</label>
                  <select className="form-select" value={padLength} onChange={e => setPadLength(Number(e.target.value))}>
                    <option value={0}>No padding (1, 2, 3)</option>
                    <option value={3}>3 digits (001)</option>
                    <option value={4}>4 digits (0001)</option>
                    <option value={5}>5 digits (00001)</option>
                    <option value={6}>6 digits (000001)</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '10px', background: 'rgba(99,102,241,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--primary)' }}>
                Preview: <strong>{previewSampleSerial}</strong>
              </div>
            </div>

            {/* Typography & Styling Card */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '0.92rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                Text Styling
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Font Family</label>
                  <select className="form-select" value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
                    <option value="Inter, sans-serif">Inter (Sans-Serif)</option>
                    <option value="'Courier Prime', monospace">Monospace</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="Impact, sans-serif">Impact</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Font Size: {fontSize}pt</label>
                  <input type="range" min="8" max="72" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                <div className="form-group">
                  <label className="form-label">Text Color</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} style={{ width: '36px', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }} />
                    <input type="text" className="form-input" value={textColor} onChange={e => setTextColor(e.target.value)} style={{ flex: 1, fontSize: '0.8rem' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Font Weight</label>
                  <select className="form-select" value={fontWeight} onChange={e => setFontWeight(e.target.value)}>
                    <option value="400">Normal</option>
                    <option value="600">Semi-Bold</option>
                    <option value="700">Bold</option>
                    <option value="900">Extra Bold</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Alignment</label>
                  <select className="form-select" value={textAlign} onChange={e => setTextAlign(e.target.value as any)}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                {/* Contrast Badge Overlay */}
                <div style={{ gridColumn: 'span 2', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={useBadge} onChange={e => setUseBadge(e.target.checked)} />
                    Add background box behind text
                  </label>
                  {useBadge && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
                      <input type="color" value={badgeBg.startsWith('#') ? badgeBg : '#000000'} onChange={e => setBadgeBg(e.target.value)} style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer', background: 'none' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Box Color</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-primary" onClick={() => setActiveStep(3)}>
                  Next: Print Settings →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Quantity & Print Layout Wizard ── */}
      {activeStep === 3 && (
        <div className="glass-panel" style={{ padding: '28px', maxWidth: '780px', margin: '0 auto' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
            Print Settings
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                Total Quantity
              </label>
              <input 
                type="number" 
                min="1" 
                max="2000" 
                className="form-input" 
                value={quantity} 
                onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} 
                style={{ fontSize: '1.1rem', fontWeight: 700 }}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', margin: 0 }}>
                Serials: <strong>{formatSerial(startSeq)}</strong> to <strong>{formatSerial(startSeq + (quantity - 1) * stepSeq)}</strong>
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Paper Size</label>
              <select className="form-select" value={paperSize} onChange={e => setPaperSize(e.target.value as any)}>
                <option value="A4">A4 Sheet (210 x 297 mm)</option>
                <option value="LETTER">US Letter Sheet (8.5 x 11 in)</option>
                <option value="SINGLE">Single PDF per Page</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Orientation</label>
              <select className="form-select" value={orientation} onChange={e => setOrientation(e.target.value as any)} disabled={paperSize === 'SINGLE'}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            {paperSize !== 'SINGLE' && (
              <>
                <div className="form-group">
                  <label className="form-label">Columns</label>
                  <input type="number" min="1" max="10" className="form-input" value={cols} onChange={e => setCols(Number(e.target.value))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Rows</label>
                  <input type="number" min="1" max="15" className="form-input" value={rows} onChange={e => setRows(Number(e.target.value))} />
                </div>
              </>
            )}

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={showCropMarks} onChange={e => setShowCropMarks(e.target.checked)} />
                Include crop marks around cards
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(2)}>← Back</button>
            <button type="button" className="btn btn-primary" onClick={() => setActiveStep(4)}>
              Next: Export →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Print & Export PDF ── */}
      {activeStep === 4 && (
        <div className="glass-panel" style={{ padding: '32px', maxWidth: '780px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Printer size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '6px' }}>Generate & Export</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Printing <strong>{quantity} documents</strong> ({formatSerial(startSeq)} to {formatSerial(startSeq + (quantity - 1) * stepSeq)})
          </p>

          {isGenerating && (
            <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--primary)' }}>
                <span>Generating PDF...</span>
                <span>{renderProgress}%</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--primary)', width: `${renderProgress}%`, transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isGenerating}
              onClick={() => handleGenerateAndPrint('print')}
              style={{ padding: '10px 22px', fontSize: '0.9rem', gap: '8px' }}
            >
              <Printer size={16} /> Print Batch
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={isGenerating}
              onClick={() => handleGenerateAndPrint('download')}
              style={{ padding: '10px 22px', fontSize: '0.9rem', gap: '8px' }}
            >
              <Download size={16} /> Download PDF
            </button>
          </div>

          {downloadFallbackUrl && (
            <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#10b981', fontWeight: 600, fontSize: '0.95rem', marginBottom: '6px' }}>
                <CheckCircle size={18} /> PDF Ready
              </div>
              {savedFilePath && (
                <div style={{ fontSize: '0.8rem', color: '#a7f3d0', marginBottom: '10px', wordBreak: 'break-all' }}>
                  Saved to: <code>{savedFilePath}</code>
                </div>
              )}
              <a
                href={downloadFallbackUrl}
                download={downloadFileName || 'Vector_Serial_Batch.pdf'}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.88rem', textDecoration: 'none' }}
              >
                <Download size={16} /> Download File ({downloadFileName || 'Download.pdf'})
              </a>
            </div>
          )}

          <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(3)}>← Print Settings</button>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(2)}>Edit Styling</button>
          </div>
        </div>
      )}
    </div>
  );
}
