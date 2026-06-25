'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

export default function ProductionDaemon() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const isProcessingRef = useRef(false);

  // Check if running inside Electron desktop client
  useEffect(() => {
    const checkDesktop = async () => {
      const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
      setIsDesktop(isElectron);
      if (isElectron) {
        addLog('Desktop environment detected. Initializing compiler engine...');
      }
    };
    checkDesktop();
  }, []);

  const addLog = (msg: string) => {
    console.log(`[CompilerEngine] ${msg}`);
    setLog(prev => [msg, ...prev.slice(0, 49)]); // keep last 50 logs
  };

  // Background polling loop
  useEffect(() => {
    if (!isDesktop) return;

    const pollInterval = setInterval(async () => {
      if (isProcessingRef.current) return; // Busy compiling
      
      try {
        const res = await fetch('/api/jobs/production-poll', { credentials: 'same-origin' });
        if (!res.ok) {
          if (res.status === 401) {
            // Unauthorized (e.g. user logged out or session expired)
            return;
          }
          throw new Error(`Polling request failed: ${res.statusText}`);
        }
        
        const data = await res.json();
        if (data.success && data.job) {
          addLog(`Found pending print job #${data.job.id} (${data.job.pdfType}). Starting compilation...`);
          isProcessingRef.current = true;
          setActiveJob(data.job);
          setProgress(0);
          
          // Run compilation inside async IIFE to not block polling interval
          (async () => {
            try {
              await processJob(data);
            } catch (err: any) {
              addLog(`Error compiling job #${data.job.id}: ${err.message}`);
              await reportJobComplete(data.job.id, false, err.message);
            } finally {
              isProcessingRef.current = false;
              setActiveJob(null);
              setProgress(0);
            }
          })();
        }
      } catch (err: any) {
        console.error('Local poll error:', err);
      }
    }, 4000); // Poll every 4 seconds

    return () => clearInterval(pollInterval);
  }, [isDesktop]);

  const updateProgress = async (jobId: number, currentProgress: number, status = 'PROCESSING') => {
    setProgress(currentProgress);
    try {
      await fetch('/api/jobs/production-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, progress: currentProgress, status }),
        credentials: 'same-origin'
      });
    } catch (err) {
      console.error('Failed to update remote job progress:', err);
    }
  };

  const reportJobComplete = async (jobId: number, success: boolean, errorMsg?: string) => {
    try {
      const res = await fetch('/api/jobs/production-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, success, errorMsg }),
        credentials: 'same-origin'
      });
      const result = await res.json();
      if (success) {
        addLog(`Successfully completed compilation for job #${jobId}`);
      } else {
        addLog(`Reported job #${jobId} compilation failure: ${errorMsg}`);
      }
      window.dispatchEvent(new Event('refresh-profile'));
    } catch (err: any) {
      addLog(`Failed to report job completion/failure for job #${jobId}: ${err.message}`);
    }
  };

  const drawCropMarks = (page: any, x: number, y: number, cw: number, ch: number) => {
    const markLen = 10;
    const strokeColor = rgb(0.5, 0.5, 0.5);
    const thickness = 0.5;

    // Top-Left
    page.drawLine({ start: { x: x - markLen, y: y + ch }, end: { x: x - 2, y: y + ch }, thickness, color: strokeColor });
    page.drawLine({ start: { x: x, y: y + ch + markLen }, end: { x: x, y: y + ch + 2 }, thickness, color: strokeColor });
    // Top-Right
    page.drawLine({ start: { x: x + cw + 2, y: y + ch }, end: { x: x + cw + markLen, y: y + ch }, thickness, color: strokeColor });
    page.drawLine({ start: { x: x + cw, y: y + ch + markLen }, end: { x: x + cw, y: y + ch + 2 }, thickness, color: strokeColor });
    // Bottom-Left
    page.drawLine({ start: { x: x - markLen, y: y }, end: { x: x - 2, y: y }, thickness, color: strokeColor });
    page.drawLine({ start: { x: x, y: y - markLen }, end: { x: x, y: y - 2 }, thickness, color: strokeColor });
    // Bottom-Right
    page.drawLine({ start: { x: x + cw + 2, y: y }, end: { x: x + cw + markLen, y: y }, thickness, color: strokeColor });
    page.drawLine({ start: { x: x + cw, y: y - markLen }, end: { x: x + cw, y: y - 2 }, thickness, color: strokeColor });
  };

  const compileInvoiceLocally = async (jobPayload: any) => {
    const { job, order, press } = jobPayload;
    if (!press || !order || !order.invoice) {
      throw new Error('Invoice data not ready or order not found');
    }

    await updateProgress(job.id, 10, 'PROCESSING');
    addLog(`Preparing Invoice PDF Document (#INV-${order.invoice.id})`);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`Commercial Invoice #INV-${order.invoice.id}`);
    pdfDoc.setCreator('ID Card Press Desktop Client');

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
    page.drawText(order.clientName, { x: 50, y: 650, size: 11, font });
    page.drawText(`Phone: ${order.clientPhone || 'N/A'}`, { x: 50, y: 635, size: 10, font });
    page.drawText(`Address: ${order.clientAddress || 'N/A'}`, { x: 50, y: 620, size: 10, font });

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

    addLog('Finalizing Invoice PDF generation...');
    await updateProgress(job.id, 90);

    const pdfBytes = await pdfDoc.save();
    await updateProgress(job.id, 95);

    addLog('Converting PDF buffer to base64...');
    const base64Data = await new Promise<string>((resolve) => {
      const blob = new Blob([pdfBytes.buffer as any], { type: 'application/pdf' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });

    addLog('Saving file using native bridge...');
    const saveResult = await (window as any).electronAPI.savePdfLocally(job.fileName, base64Data);
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save file');
    }

    addLog(`Saved successfully to: ${saveResult.path}`);
    await updateProgress(job.id, 100, 'COMPLETED');
    await reportJobComplete(job.id, true);
  };

  const processJob = async (jobPayload: any) => {
    const { job, template, cardholders, order } = jobPayload;
    if (job.pdfType === 'INVOICE') {
      await compileInvoiceLocally(jobPayload);
      return;
    }

    const metadata = job.metadata || {};
    
    // Parse metadata settings
    const paperSize = metadata.paperSize || 'A3';
    const orientation = metadata.orientation || 'PORTRAIT';
    const bleed = metadata.bleed !== undefined ? Number(metadata.bleed) : 0;
    const cropMarks = !!metadata.cropMarks;
    const foldLine = !!metadata.foldLine;
    const marginLeft = metadata.marginLeft !== undefined ? Number(metadata.marginLeft) : 40;
    const marginTop = metadata.marginTop !== undefined ? Number(metadata.marginTop) : 40;
    const marginRight = metadata.marginRight !== undefined ? Number(metadata.marginRight) : 40;
    const marginBottom = metadata.marginBottom !== undefined ? Number(metadata.marginBottom) : 40;
    const colGap = metadata.colGap !== undefined ? Number(metadata.colGap) : 15;
    const rowGap = metadata.rowGap !== undefined ? Number(metadata.rowGap) : 15;

    await updateProgress(job.id, 5, 'PROCESSING');
    addLog(`Preparing PDF Document (${paperSize} ${orientation}). Total cardholders: ${cardholders.length}`);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('Production Print File');
    pdfDoc.setCreator('ID Card Press Desktop Client');

    // Page dimensions in points
    // A3 Portrait: 841.89 pt x 1190.55 pt
    // A3 Landscape: 1190.55 pt x 841.89 pt
    // A4 Portrait: 595.28 pt x 841.89 pt
    // A4 Landscape: 841.89 pt x 595.28 pt
    let pageWidth = 841.89;
    let pageHeight = 1190.55;

    if (paperSize === 'A4') {
      if (orientation === 'LANDSCAPE') {
        pageWidth = 841.89;
        pageHeight = 595.28;
      } else {
        pageWidth = 595.28;
        pageHeight = 841.89;
      }
    } else if (paperSize === 'CUSTOM') {
      pageWidth = metadata.customWidth || pageWidth;
      pageHeight = metadata.customHeight || pageHeight;
    } else if (orientation === 'LANDSCAPE') {
      pageWidth = 1190.55;
      pageHeight = 841.89;
    }

    // Determine card dimensions (template px size * 0.24 factor to convert 300 DPI to PDF pt)
    const isPortraitTemplate = (template.width || 1011) < (template.height || 638);
    const cardBaseWidth = isPortraitTemplate ? 153 : 242.6;
    const cardBaseHeight = isPortraitTemplate ? 242.6 : 153;

    const cWidth = cardBaseWidth + bleed * 2;
    const cHeight = cardBaseHeight + bleed * 2;

    const foldGap = 10;
    const isSingleSided = !template.backImageUrl;
    const centerY = pageHeight / 2;

    const cols = Math.floor((pageWidth - marginLeft - marginRight + colGap) / (cWidth + colGap)) || 1;

    let cardsPerPage: number;
    let rowsPerHalf: number;

    if (isSingleSided) {
      const fullHeight = pageHeight - marginTop - marginBottom;
      const rowsPerPage = Math.floor((fullHeight + rowGap) / (cHeight + rowGap)) || 1;
      cardsPerPage = cols * rowsPerPage;
      rowsPerHalf = rowsPerPage;
    } else {
      const halfHeight = centerY - Math.max(marginTop, marginBottom);
      rowsPerHalf = Math.floor((halfHeight - foldGap + rowGap) / (cHeight + rowGap)) || 1;
      cardsPerPage = cols * rowsPerHalf;
    }

    const total = cardholders.length;
    const totalPages = Math.ceil(total / cardsPerPage);
    addLog(`Layout Grid: cols=${cols}, cardsPerPage=${cardsPerPage}, totalPages=${totalPages}`);

    // Loop pages and add grids
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.setMediaBox(0, 0, pageWidth, pageHeight);
      page.setBleedBox(0, 0, pageWidth, pageHeight);
      page.setTrimBox(0, 0, pageWidth, pageHeight);

      const startIdx = pIdx * cardsPerPage;
      const endIdx = Math.min(startIdx + cardsPerPage, total);
      const batchCardholders = cardholders.slice(startIdx, endIdx);

      // Draw fold line only for duplex templates
      if (!isSingleSided && foldLine) {
        page.drawLine({
          start: { x: marginLeft - 10, y: centerY },
          end: { x: pageWidth - marginRight + 10, y: centerY },
          thickness: 0.5,
          color: rgb(0.8, 0.1, 0.1),
          dashArray: [4, 4],
        });
      }

      for (let gridIdx = 0; gridIdx < batchCardholders.length; gridIdx++) {
        const ch = batchCardholders[gridIdx];
        const overallIndex = startIdx + gridIdx;

        const colIdx = gridIdx % cols;
        const rowIdx = Math.floor(gridIdx / cols);

        const xPos = marginLeft + colIdx * (cWidth + colGap);

        let frontsY: number;
        let backsY: number | null = null;

        if (isSingleSided) {
          frontsY = pageHeight - marginTop - rowIdx * (cHeight + rowGap) - cHeight;
        } else {
          frontsY = pageHeight - marginTop - rowIdx * (cHeight + rowGap) - cHeight;
          backsY = 2 * centerY - frontsY - cHeight;
        }

        // Fetch card front side PNG buffer from the server (using local preview api)
        addLog(`Rendering card [${overallIndex + 1}/${total}]: ${ch.name} (Front)`);
        const frontRes = await fetch(`/api/templates/${template.id}/preview?cardholderId=${ch.id}&side=front`, { credentials: 'same-origin' });
        if (!frontRes.ok) throw new Error(`Failed to render front side for ${ch.name}`);
        const frontBytes = await frontRes.arrayBuffer();
        const frontImg = await pdfDoc.embedPng(frontBytes);
        page.drawImage(frontImg, { x: xPos, y: frontsY, width: cWidth, height: cHeight });

        // If double-sided, fetch back side
        if (!isSingleSided && backsY !== null) {
          addLog(`Rendering card [${overallIndex + 1}/${total}]: ${ch.name} (Back)`);
          const backRes = await fetch(`/api/templates/${template.id}/preview?cardholderId=${ch.id}&side=back`, { credentials: 'same-origin' });
          if (!backRes.ok) throw new Error(`Failed to render back side for ${ch.name}`);
          const backBytes = await backRes.arrayBuffer();
          const backImg = await pdfDoc.embedPng(backBytes);
          
          // Draw back image rotated 180 degrees
          page.drawImage(backImg, {
            x: xPos + cWidth,
            y: backsY + cHeight,
            width: cWidth,
            height: cHeight,
            rotate: degrees(180),
          });
        }

        // Draw crop marks
        if (cropMarks) {
          drawCropMarks(page, xPos, frontsY, cWidth, cHeight);
          if (!isSingleSided && backsY !== null) {
            drawCropMarks(page, xPos, backsY, cWidth, cHeight);
          }
        }

        // Update progress dynamically (allocating 5% to 90% of the job progress bar)
        const progressPercent = Math.min(90, Math.round(5 + ((overallIndex + 1) / total) * 85));
        await updateProgress(job.id, progressPercent);
      }
    }

    addLog('Finalizing PDF generation...');
    await updateProgress(job.id, 92);
    
    const pdfBytes = await pdfDoc.save();
    await updateProgress(job.id, 95);

    // Convert PDF bytes to Base64 to send over IPC bridge
    addLog('Converting PDF buffer to base64...');
    const base64Data = await new Promise<string>((resolve) => {
      const blob = new Blob([pdfBytes.buffer as any], { type: 'application/pdf' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });

    addLog('Saving file using native bridge...');
    const saveResult = await (window as any).electronAPI.savePdfLocally(job.fileName, base64Data);
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save file');
    }

    addLog(`Saved successfully to: ${saveResult.path}`);
    await updateProgress(job.id, 100, 'COMPLETED');
    await reportJobComplete(job.id, true);
  };

  if (!isDesktop || !activeJob) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(99, 102, 241, 0.4)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(99, 102, 241, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      width: '320px',
      color: '#fff',
      fontSize: '0.8rem',
      fontFamily: 'system-ui, sans-serif',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: activeJob ? '#f59e0b' : '#10b981',
          boxShadow: activeJob ? '0 0 8px #f59e0b' : '0 0 8px #10b981',
          animation: activeJob ? 'pulse 1.5s infinite' : 'none'
        }} />
        <span style={{ fontWeight: '600' }}>Compiler Engine</span>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>Active</span>
      </div>

      {activeJob ? (
        <div>
          <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
            Compiling: <strong style={{ color: '#fbbf24' }}>#{activeJob.id}</strong> ({activeJob.pdfType})
          </div>
          <div style={{
            height: '6px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '6px'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#6366f1',
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>
            {progress}% Completed
          </div>
        </div>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.5)' }}>
          Idling. Polling for pending jobs...
        </div>
      )}

      {/* Tiny log stream */}
      <div style={{
        marginTop: '12px',
        paddingTop: '8px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        height: '60px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.65rem',
        color: 'rgba(255,255,255,0.6)',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '4px',
        scrollbarWidth: 'none',
      }}>
        {log.map((entry, idx) => (
          <div key={idx} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {entry}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
