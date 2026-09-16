'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { renderCardSideToPdfBytesClient, embedImageBuffer, clearTemplateBgCache, clearFontBytesCache } from '@/lib/pdf/card-renderer-client';
import { resolveCardholderPhotoUrl } from '@/lib/pdf/field-resolver';
import { getCustomCardById } from '@/lib/clientDb';

/**
 * Maximum number of PDF pages per chunk file.
 * When a compilation exceeds this, the output is split into multiple PDF files
 * to prevent browser/Electron memory exhaustion on large batches.
 */
const MAX_PAGES_PER_CHUNK = 15;

async function safeDrawTextClient(
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
      console.error('safeDrawTextClient fallback failed:', fallbackErr);
      const sanitized = text.replace(/[^\x00-\x7F]/g, '?');
      try {
        page.drawText(sanitized, options);
      } catch (finalErr) {
        // ignore
      }
    }
  }
}

/**
 * Base64 of the compiled PDF, for the Electron save bridge only.
 *
 * Nothing else needs it now that the server takes the raw bytes, and a base64
 * copy of a large sheet is a third again as much memory — so in the browser it
 * is never built.
 */
async function toBase64ForNativeSave(pdfBytes: Uint8Array): Promise<string> {
  if (typeof window === 'undefined' || !(window as any).electronAPI) return '';
  return new Promise<string>((resolve) => {
    const blob = new Blob([pdfBytes.buffer as any], { type: 'application/pdf' });
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

interface CompilerJob {
  id: number;
  pdfType: string;
  fileName?: string;
  metadata?: any;
}

export default function ProductionDaemon() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeJob, setActiveJob] = useState<CompilerJob | null>(null);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const isProcessingRef = useRef(false);
  const wasOfflineRef = useRef(false);

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

  /**
   * Hand the compiled bytes to the server as their own request.
   *
   * Best-effort on purpose: the file is already on this machine, and a server
   * copy that cannot be stored (too large to send, or the network blinked) must
   * not stop the job from settling — that is exactly how jobs used to sit at
   * 100% with their credits locked.
   */
  const storeCompiledPdf = async (jobId: number, pdfBytes: Uint8Array, chunkIndex?: number) => {
    const query = chunkIndex === undefined ? '' : `?chunk=${chunkIndex}`;
    try {
      const res = await fetch(`/api/jobs/${jobId}/pdf${query}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: new Blob([pdfBytes.buffer as any], { type: 'application/pdf' }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        addLog(`No server copy kept for job #${jobId} (HTTP ${res.status}). The saved file on this machine is the master copy.`);
        return false;
      }
      return true;
    } catch (err: any) {
      addLog(`Could not send job #${jobId} to server storage: ${err.message}. The saved file on this machine is the master copy.`);
      return false;
    }
  };

  const postCompletion = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/jobs/production-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const err: any = new Error(`Server returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res;
  };

  /**
   * Settle the job with the server.
   *
   * Until this call lands the job's credits stay locked, so a single failure is
   * never the end of it: transient errors are retried, and a request the server
   * refuses outright is turned into a reported failure so the credits are
   * refunded and the operator is told why, instead of the job sitting at 100%
   * for ever.
   */
  const reportJobComplete = async (jobId: number, success: boolean, errorMsg?: string, localPath?: string, chunkCount?: number) => {
    const payload = { jobId, success, errorMsg, localPath, chunkCount };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await postCompletion(payload);
        if (success) {
          addLog(`Successfully completed compilation for job #${jobId}`);
        } else {
          addLog(`Reported job #${jobId} compilation failure: ${errorMsg}`);
        }
        window.dispatchEvent(new Event('refresh-profile'));
        return;
      } catch (err: any) {
        const status = err?.status;
        const isPermanent = typeof status === 'number' && status >= 400 && status < 500;

        if (isPermanent) {
          addLog(`Server rejected the completion of job #${jobId} (HTTP ${status}).`);
          if (success) {
            // Release the locked credits rather than leave them held against a
            // job the server will never accept as done.
            await reportJobComplete(jobId, false, errorMsg || `Completion rejected by server (HTTP ${status})`, localPath, chunkCount);
          }
          return;
        }

        if (attempt < 3) {
          addLog(`Completion of job #${jobId} failed (${err.message}). Retrying (${attempt}/3)...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }

        addLog(`Network error reporting job #${jobId}. Queuing for offline sync...`);
        try {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI?.queuePrintLog) {
            const result = await electronAPI.queuePrintLog({ payload });
            setOfflineQueueCount(result?.queueLength ?? 0);
            addLog(`Queued offline. Total pending: ${result?.queueLength ?? '?'}`);
            wasOfflineRef.current = true;
          } else {
            addLog(`Job #${jobId} could not be settled — its credits stay locked until it is retried or cancelled.`);
          }
        } catch (queueErr: any) {
          addLog(`Failed to queue offline: ${queueErr.message}`);
        }
      }
    }
  };

  const saveAndCompleteJob = async (
    job: any,
    order: any,
    pdfBytes: Uint8Array,
    base64Data: string
  ) => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      addLog('Saving file using native bridge...');
      const saveResult = await electronAPI.savePdfLocally(job.fileName, base64Data, order?.clientName || 'Client');
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save file');
      }
      addLog(`Saved successfully to: ${saveResult.path}`);
      await updateProgress(job.id, 100, 'PROCESSING');
      await storeCompiledPdf(job.id, pdfBytes);
      await reportJobComplete(job.id, true, undefined, saveResult.path);
    } else {
      addLog('Web client detected. Triggering browser file download and uploading to server...');
      
      const blob = new Blob([pdfBytes.buffer as any], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = job.fileName || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      await updateProgress(job.id, 100, 'PROCESSING');
      await storeCompiledPdf(job.id, pdfBytes);
      await reportJobComplete(job.id, true, undefined, undefined);
      addLog('Job completed successfully. Download started.');
    }
  };

  /**
   * Save and upload a single chunk of a multi-part PDF job.
   * Each chunk is uploaded independently to free memory before the next chunk.
   */
  const saveAndCompleteChunk = async (
    job: any,
    order: any,
    pdfBytes: Uint8Array,
    base64Data: string,
    chunkIndex: number,
    totalChunks: number,
    chunkFileName: string
  ) => {
    const electronAPI = (window as any).electronAPI;
    let localPath: string | undefined;

    if (electronAPI) {
      addLog(`Saving chunk ${chunkIndex + 1}/${totalChunks} using native bridge...`);
      const saveResult = await electronAPI.savePdfLocally(chunkFileName, base64Data, order?.clientName || 'Client');
      if (!saveResult.success) {
        throw new Error(saveResult.error || `Failed to save chunk ${chunkIndex + 1}`);
      }
      localPath = saveResult.path;
      addLog(`Chunk ${chunkIndex + 1} saved to: ${saveResult.path}`);
    } else {
      // Browser: trigger download for each chunk
      const blob = new Blob([pdfBytes.buffer as any], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = chunkFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      addLog(`Chunk ${chunkIndex + 1} download triggered.`);
    }

    // Record the chunk first — its bytes are sent separately, against the row
    // this call creates.
    try {
      const res = await fetch('/api/jobs/production-chunk-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          chunkIndex,
          totalChunks,
          localPath,
          fileName: chunkFileName,
        }),
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await storeCompiledPdf(job.id, pdfBytes, chunkIndex);
    } catch (err: any) {
      addLog(`Warning: Failed to report chunk ${chunkIndex + 1} to server: ${err.message}`);
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

  const cachePhotosForJob = async (cardholdersList: any[]) => {
    addLog(`Pre-caching ${cardholdersList.length} photo(s) locally...`);
    for (let i = 0; i < cardholdersList.length; i++) {
      const ch = cardholdersList[i];
      const effectivePhoto = resolveCardholderPhotoUrl(ch);
      if (effectivePhoto) {
        ch.photoUrl = effectivePhoto;
      }
      const electronAPI = typeof window !== 'undefined' && (window as any).electronAPI;
      if (electronAPI) {
        if (
          ch.photoUrl &&
          !ch.photoUrl.startsWith('blob:') &&
          !ch.photoUrl.startsWith('data:') &&
          !ch.photoUrl.startsWith('local://') &&
          !ch.photoUrl.startsWith('file://')
        ) {
          try {
            let fetchUrl = ch.photoUrl;
            if (ch.photoUrl.startsWith('/uploads/') || ch.photoUrl.startsWith('/api/uploads/') || ch.photoUrl.startsWith('uploads/')) {
              const portalUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
                ? window.location.origin
                : ((typeof process !== 'undefined' && process.env && process.env.PORTAL_URL) || 'https://idexocards.vercel.app');
              const cleanPath = ch.photoUrl.startsWith('/') ? ch.photoUrl : '/' + ch.photoUrl;
              fetchUrl = `${portalUrl}${cleanPath}`;
            }
            const res = await electronAPI.cachePhoto(ch.id, fetchUrl);
            if (res && res.success && res.localUrl) {
              ch.photoUrl = res.localUrl;
            }
          } catch (err: any) {
            console.warn(`Failed to cache photo locally for cardholder ${ch.id}:`, err);
          }
        }
        if (ch.customFields) {
          try {
            const fieldsObj = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
            if (fieldsObj && typeof fieldsObj === 'object') {
              let updated = false;
              for (const key of Object.keys(fieldsObj)) {
                const val = fieldsObj[key];
                if (
                  typeof val === 'string' &&
                  !val.startsWith('blob:') &&
                  !val.startsWith('data:') &&
                  !val.startsWith('local://') &&
                  !val.startsWith('file://') &&
                  (val.startsWith('http://') ||
                    val.startsWith('https://') ||
                    val.startsWith('/uploads/') ||
                    val.startsWith('uploads/') ||
                    val.startsWith('/api/uploads/'))
                ) {
                  let fetchUrl = val;
                  if (val.startsWith('/uploads/') || val.startsWith('/api/uploads/') || val.startsWith('uploads/')) {
                    const portalUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
                      ? window.location.origin
                      : ((typeof process !== 'undefined' && process.env && process.env.PORTAL_URL) || 'https://idexocards.vercel.app');
                    const cleanPath = val.startsWith('/') ? val : '/' + val;
                    fetchUrl = `${portalUrl}${cleanPath}`;
                  }
                  try {
                    const res = await electronAPI.cachePhoto(`${ch.id}_${key}`, fetchUrl);
                    if (res && res.success && res.localUrl) {
                      fieldsObj[key] = res.localUrl;
                      updated = true;
                    }
                  } catch (cErr) {
                    console.warn(`Failed to cache custom field photo ${key} for cardholder ${ch.id}:`, cErr);
                  }
                }
              }
              if (updated) {
                ch.customFields = typeof ch.customFields === 'string' ? JSON.stringify(fieldsObj) : fieldsObj;
              }
            }
          } catch (pErr) {
            // Ignore parse errors
          }
        }
      }
    }
    addLog('Photo caching phase complete.');
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
    await safeDrawTextClient(page, pdfDoc, press.name, { x: 50, y: 760, size: 20, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
    await safeDrawTextClient(page, pdfDoc, `Email: ${press.email} | City: ${press.city || 'N/A'}`, { x: 50, y: 740, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

    await safeDrawTextClient(page, pdfDoc, 'INVOICE', { x: 450, y: 760, size: 24, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    await safeDrawTextClient(page, pdfDoc, `Invoice No: #INV-${inv.id}`, { x: 400, y: 740, size: 10, font });
    await safeDrawTextClient(page, pdfDoc, `Date: ${new Date(inv.createdAt).toLocaleDateString()}`, { x: 400, y: 725, size: 10, font });

    // Client Billing Details
    await safeDrawTextClient(page, pdfDoc, 'Billed To:', { x: 50, y: 670, size: 12, font: fontBold });
    await safeDrawTextClient(page, pdfDoc, order.clientName, { x: 50, y: 650, size: 11, font });
    await safeDrawTextClient(page, pdfDoc, `Phone: ${order.clientPhone || 'N/A'}`, { x: 50, y: 635, size: 10, font });
    await safeDrawTextClient(page, pdfDoc, `Address: ${order.clientAddress || 'N/A'}`, { x: 50, y: 620, size: 10, font });

    // Invoice Table Headers
    const tableY = 530;
    page.drawLine({ start: { x: 50, y: tableY }, end: { x: 545, y: tableY }, thickness: 1 });
    await safeDrawTextClient(page, pdfDoc, 'Item Description', { x: 60, y: tableY - 15, size: 10, font: fontBold });
    await safeDrawTextClient(page, pdfDoc, 'Qty', { x: 300, y: tableY - 15, size: 10, font: fontBold });
    await safeDrawTextClient(page, pdfDoc, 'Unit Price', { x: 370, y: tableY - 15, size: 10, font: fontBold });
    await safeDrawTextClient(page, pdfDoc, 'Amount', { x: 480, y: tableY - 15, size: 10, font: fontBold });
    page.drawLine({ start: { x: 50, y: tableY - 22 }, end: { x: 545, y: tableY - 22 }, thickness: 0.5 });

    // Table Row
    const rowY = tableY - 40;
    await safeDrawTextClient(page, pdfDoc, `ID Card Printing — ${order.status} batch`, { x: 60, y: rowY, size: 10, font });
    await safeDrawTextClient(page, pdfDoc, String(inv.cardCount), { x: 300, y: rowY, size: 10, font });
    await safeDrawTextClient(page, pdfDoc, `Rs. ${Number(inv.pricePerCard).toFixed(2)}`, { x: 370, y: rowY, size: 10, font });
    await safeDrawTextClient(page, pdfDoc, `Rs. ${Number(inv.subtotal).toFixed(2)}`, { x: 480, y: rowY, size: 10, font });

    // Totals section
    const totY = rowY - 100;
    page.drawLine({ start: { x: 350, y: totY }, end: { x: 545, y: totY }, thickness: 0.5 });
    await safeDrawTextClient(page, pdfDoc, 'Subtotal:', { x: 360, y: totY - 15, size: 10, font });
    await safeDrawTextClient(page, pdfDoc, `Rs. ${Number(inv.subtotal).toFixed(2)}`, { x: 485, y: totY - 15, size: 10, font });

    await safeDrawTextClient(page, pdfDoc, `GST (${inv.taxPercent}%):`, { x: 360, y: totY - 30, size: 10, font });
    await safeDrawTextClient(page, pdfDoc, `Rs. ${Number(inv.taxAmount).toFixed(2)}`, { x: 485, y: totY - 30, size: 10, font });

    await safeDrawTextClient(page, pdfDoc, 'Total Amount:', { x: 360, y: totY - 50, size: 11, font: fontBold });
    await safeDrawTextClient(page, pdfDoc, `Rs. ${Number(inv.totalAmount).toFixed(2)}`, { x: 485, y: totY - 50, size: 11, font: fontBold });

    // Payment Status Badge
    const badgeY = totY - 120;
    await safeDrawTextClient(page, pdfDoc, 'Payment Details:', { x: 50, y: badgeY + 20, size: 12, font: fontBold });
    await safeDrawTextClient(page, pdfDoc, `Status: ${inv.paymentStatus}`, { x: 50, y: badgeY, size: 10, font: fontBold, color: inv.paymentStatus === 'PAID' ? rgb(0.1, 0.6, 0.1) : rgb(0.8, 0.1, 0.1) });
    if (inv.paymentMethod) {
      await safeDrawTextClient(page, pdfDoc, `Method: ${inv.paymentMethod}`, { x: 50, y: badgeY - 15, size: 10, font });
    }

    addLog('Finalizing Invoice PDF generation...');
    await updateProgress(job.id, 90);

    const pdfBytes = await pdfDoc.save();
    await updateProgress(job.id, 95);

    const base64Data = await toBase64ForNativeSave(pdfBytes);

    await saveAndCompleteJob(job, order, pdfBytes, base64Data);
  };

  const compileApprovalLocally = async (jobPayload: any) => {
    const { job, template, cardholders, order, pressFonts = [] } = jobPayload;
    await updateProgress(job.id, 10, 'PROCESSING');
    addLog(`Preparing Approval Proof Sheet PDF (#Job-${job.id})`);

    const clientTemplate = {
      id: template.id,
      cardWidth: template.width || 1011,
      cardHeight: template.height || 638,
      frontImageUrl: template.frontImageUrl,
      backImageUrl: template.backImageUrl,
      frontOriginalUrl: template.frontOriginalUrl || null,
      backOriginalUrl: template.backOriginalUrl || null,
      frontFields: typeof template.frontFields === 'string' ? template.frontFields : JSON.stringify(template.frontFields || []),
      backFields: typeof template.backFields === 'string' ? template.backFields : JSON.stringify(template.backFields || []),
      version: template.version,
      validTill: template.validTillDate || null,
    };

    const clientCardholders = cardholders.map((ch: any) => {
      const customData = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields || {};
      return {
        id: ch.id,
        name: ch.name,
        designation: ch.designation || null,
        photoUrl: ch.photoUrl || null,
        cardSerial: ch.cardSerial || null,
        uniqueKey: customData.uniqueKey || customData.id || customData.unique_key || null,
        customFields: customData,
      };
    });

    // Pre-cache photos locally in desktop client to enable robust offline rendering
    await cachePhotosForJob(clientCardholders);

    const { generateApprovalPdfClient } = await import('@/lib/pdf/approval-pdf-generator');

    // Calculate total pages for the approval PDF to determine chunking
    const hasBackSide = !!template.backImageUrl || (template.backFields && template.backFields !== '[]');
    const approvalCardsPerPage = hasBackSide ? 4 : 8;
    const totalApprovalPages = Math.ceil(clientCardholders.length / approvalCardsPerPage);
    const totalChunks = Math.ceil(totalApprovalPages / MAX_PAGES_PER_CHUNK);

    if (totalChunks <= 1) {
      // Single chunk — keep existing behavior
      const pdfBlob = await generateApprovalPdfClient(
        order.clientName || 'Client',
        order.clientName || 'Batch',
        clientTemplate,
        clientCardholders,
        pressFonts
      );

      await updateProgress(job.id, 80);

      const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

      const base64Data = await toBase64ForNativeSave(pdfBytes);

      await saveAndCompleteJob(job, order, pdfBytes, base64Data);
    } else {
      // Multi-chunk: split cardholders into groups and compile each chunk separately
      addLog(`Large approval job: ${totalApprovalPages} pages → ${totalChunks} chunks (max ${MAX_PAGES_PER_CHUNK} pages each)`);
      const cardsPerChunk = MAX_PAGES_PER_CHUNK * approvalCardsPerPage;

      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const chunkStart = chunkIdx * cardsPerChunk;
        const chunkEnd = Math.min(chunkStart + cardsPerChunk, clientCardholders.length);
        const chunkCardholders = clientCardholders.slice(chunkStart, chunkEnd);

        addLog(`Compiling approval chunk ${chunkIdx + 1}/${totalChunks} (${chunkCardholders.length} cards)...`);

        const pdfBlob = await generateApprovalPdfClient(
          order.clientName || 'Client',
          order.clientName || 'Batch',
          clientTemplate,
          chunkCardholders,
          pressFonts
        );

        const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
        const base64Data = await toBase64ForNativeSave(pdfBytes);

        const baseName = (job.fileName || 'approval.pdf').replace(/\.pdf$/i, '');
        const chunkFileName = `${baseName}_part${chunkIdx + 1}.pdf`;

        await saveAndCompleteChunk(job, order, pdfBytes, base64Data, chunkIdx, totalChunks, chunkFileName);

        // Update progress proportionally
        const progressPercent = Math.min(95, Math.round(10 + ((chunkIdx + 1) / totalChunks) * 85));
        await updateProgress(job.id, progressPercent);
      }

      // Final completion — no base64 payload since chunks uploaded individually
      await updateProgress(job.id, 100, 'PROCESSING');
      await reportJobComplete(job.id, true, undefined, undefined, totalChunks);
      addLog(`Approval job completed: ${totalChunks} chunks generated.`);
    }
  };

  async function processJob(jobPayload: any) {
    const { job, cardholders, order, pressFonts = [] } = jobPayload;
    let template = jobPayload.template; // mutable reference so the fresh re-fetch below can update it

    addLog(`Processing Job #${job.id} using Template #${template.id} (v${template.version || 1})`);

    // ── Cache invalidation ─────────────────────────────────────────────────
    // Clear in-memory background bytes so the latest template image is fetched,
    // not a version that was cached from a prior compile in this session.
    clearTemplateBgCache(
      template.frontImageUrl,
      template.backImageUrl,
      template.frontOriginalUrl,
      template.backOriginalUrl,
    );
    // Clear the font bytes cache so updated press fonts are re-fetched.
    clearFontBytesCache();
    // Delete stale on-disk original files so they are re-downloaded from the server.
    const electronAPI = typeof window !== 'undefined' && (window as any).electronAPI;
    if (electronAPI?.deleteLocalTemplate) {
      try {
        const delRes = await electronAPI.deleteLocalTemplate({ templateId: template.id });
        addLog(`[Daemon] Local cache purge for Template #${template.id}: ${delRes?.deleted?.length || 0} file(s) removed`);
      } catch (e: any) {
        console.warn('[Daemon] Failed to purge stale local template files:', e);
      }
    }

    // ── Fresh template re-fetch (belt-and-suspenders) ──────────────────────
    // Re-fetch the template directly from the server RIGHT BEFORE rendering
    // so that any edits made to frontFields/backFields between the poll and
    // the compilation start are always reflected in the output PDF.
    try {
      const freshRes = await fetch(`/api/templates/${template.id}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      if (freshRes.ok) {
        const freshJson = await freshRes.json();
        if (freshJson.template) {
          const ft = freshJson.template;
          // Update both the local variable and the shared payload reference
          const refreshed = {
            ...template,
            ...ft,
            frontFields: typeof ft.frontFields === 'string' ? ft.frontFields : (ft.frontFields ? JSON.stringify(ft.frontFields) : template.frontFields),
            backFields: typeof ft.backFields === 'string' ? ft.backFields : (ft.backFields ? JSON.stringify(ft.backFields) : template.backFields),
            frontImageUrl: ft.frontImageUrl ?? template.frontImageUrl,
            backImageUrl: ft.backImageUrl ?? template.backImageUrl,
            frontOriginalUrl: ft.frontOriginalUrl ?? template.frontOriginalUrl,
            backOriginalUrl: ft.backOriginalUrl ?? template.backOriginalUrl,
            cardWidth: ft.cardWidth ? Number(ft.cardWidth) : template.cardWidth,
            cardHeight: ft.cardHeight ? Number(ft.cardHeight) : template.cardHeight,
            version: ft.version ?? template.version,
          };
          template = refreshed;
          jobPayload.template = refreshed;
          addLog(`[Daemon] Template #${template.id} fields refreshed from server (v${ft.version ?? template.version})`);
        }
      } else {
        addLog(`[Daemon] Warning: Could not refresh template from server (${freshRes.status}) — using poll data`);
      }
    } catch (refreshErr: any) {
      // Non-fatal: fall back to the poll payload data
      addLog(`[Daemon] Warning: Fresh template fetch failed (${refreshErr.message}) — using poll data`);
    }
    // ──────────────────────────────────────────────────────────────────────
    if (job.pdfType === 'INVOICE') {
      await compileInvoiceLocally(jobPayload);
      return;
    }
    if (job.pdfType === 'APPROVAL') {
      await compileApprovalLocally(jobPayload);
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

    let customCardsList: Array<{ name: string; pdfBytes: string; backPdfBytes?: string }> = [];
    if (metadata.emptySlotStrategy === 'FILL_CUSTOM' && metadata.emptySlotCustomCardId) {
      try {
        let cardIds: Array<string | null> = [];
        try {
          const parsed = JSON.parse(metadata.emptySlotCustomCardId);
          if (Array.isArray(parsed)) cardIds = parsed;
          else cardIds = [metadata.emptySlotCustomCardId];
        } catch {
          cardIds = [metadata.emptySlotCustomCardId];
        }

        for (const cid of cardIds) {
          if (cid) {
            const card = await getCustomCardById(cid);
            if (card && card.pdfBytes) {
              customCardsList.push({
                name: card.name,
                pdfBytes: card.pdfBytes,
                backPdfBytes: card.backPdfBytes || undefined,
              });
            } else {
              customCardsList.push(null as any);
            }
          } else {
            customCardsList.push(null as any);
          }
        }

        if (customCardsList.some(c => c !== null)) {
          addLog(`Loaded custom PDF cards for assigned slots.`);
        }
      } catch (err: any) {
        addLog(`Error loading custom PDF cards from client DB: ${err.message}`);
      }
    }

    await updateProgress(job.id, 5, 'PROCESSING');
    addLog(`Preparing PDF Document (${paperSize} ${orientation}). Total cardholders: ${cardholders.length}`);

    // Pre-cache photos locally in desktop client to enable robust offline rendering
    const localCardholders = cardholders.map((ch: any) => ({ ...ch }));
    await cachePhotosForJob(localCardholders);

    // Page dimensions in points
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

    const total = localCardholders.length;
    const totalPages = Math.ceil(total / cardsPerPage);

    // Apply Empty Slot Strategy padding
    let finalCardholders = [...localCardholders];
    const totalSlotsNeeded = totalPages * cardsPerPage;
    if (finalCardholders.length < totalSlotsNeeded && totalSlotsNeeded > 0) {
      const strategy = metadata.emptySlotStrategy || 'LEAVE_BLANK';
      const diff = totalSlotsNeeded - finalCardholders.length;
      if (strategy === 'REPEAT_LAST' && finalCardholders.length > 0) {
        const lastCard = finalCardholders[finalCardholders.length - 1];
        for (let i = 0; i < diff; i++) {
          finalCardholders.push({ ...lastCard });
        }
      } else if (strategy === 'REPEAT_FIRST' && finalCardholders.length > 0) {
        const firstCard = finalCardholders[0];
        for (let i = 0; i < diff; i++) {
          finalCardholders.push({ ...firstCard });
        }
      } else if (strategy === 'FILL_CUSTOM' && customCardsList.length > 0) {
        for (let i = 0; i < diff; i++) {
          const cardToUse = customCardsList[i];
          if (cardToUse && cardToUse.pdfBytes) {
            finalCardholders.push({
              id: -999 - i,
              name: cardToUse.name || `Custom Card Slot ${i + 1}`,
              isCustomPdf: true,
              pdfBytes: cardToUse.pdfBytes,
              backPdfBytes: cardToUse.backPdfBytes || undefined,
            });
          } else {
            finalCardholders.push({});
          }
        }
      } else {
        for (let i = 0; i < diff; i++) {
          finalCardholders.push({});
        }
      }
    }

    // ── Chunked compilation logic ──────────────────────────────────────────
    const totalChunks = Math.ceil(totalPages / MAX_PAGES_PER_CHUNK);
    const isMultiChunk = totalChunks > 1;

    addLog(`Layout Grid: cols=${cols}, cardsPerPage=${cardsPerPage}, totalPages=${totalPages}${isMultiChunk ? `, chunks=${totalChunks} (max ${MAX_PAGES_PER_CHUNK} pages each)` : ''}`);

    /**
     * Renders a range of pages [startPage, endPage) into a single PDFDocument,
     * saves it, converts to base64, and returns the result.
     */
    const compilePageRange = async (startPage: number, endPage: number): Promise<{ pdfBytes: Uint8Array; base64Data: string }> => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.setTitle('Production Print File');
      pdfDoc.setCreator('ID Card Press Desktop Client');

      for (let pIdx = startPage; pIdx < endPage; pIdx++) {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.setMediaBox(0, 0, pageWidth, pageHeight);
        page.setBleedBox(0, 0, pageWidth, pageHeight);
        page.setTrimBox(0, 0, pageWidth, pageHeight);

        const startIdx = pIdx * cardsPerPage;
        const endIdx = startIdx + cardsPerPage;
        const batchCardholders = finalCardholders.slice(startIdx, endIdx);

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
          if (!ch || (!ch.id && !ch.name)) {
            continue;
          }
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

          // ── Render front side as vector PDF ──
          addLog(`Rendering card [${overallIndex + 1}/${total}]: ${ch.name} (Front)`);

          let frontEmbeddedPdf: any = null;
          let frontEmbeddedImg: any = null;
          let backEmbeddedPdf: any = null;
          let backEmbeddedImg: any = null;

          if (ch.isCustomPdf && ch.pdfBytes) {
            try {
              const rawBytes = Uint8Array.from(atob(ch.pdfBytes), c => c.charCodeAt(0));
              const isPdf = rawBytes[0] === 0x25 && rawBytes[1] === 0x50 && rawBytes[2] === 0x44 && rawBytes[3] === 0x46;

              if (isPdf) {
                const customDoc = await PDFDocument.load(rawBytes);
                const pageCount = customDoc.getPageCount();
                const [fPage] = await pdfDoc.embedPdf(customDoc, [0]);
                frontEmbeddedPdf = fPage;

                if (!isSingleSided && backsY !== null) {
                  if (ch.backPdfBytes) {
                    const backRawBytes = Uint8Array.from(atob(ch.backPdfBytes), c => c.charCodeAt(0));
                    const isBackPdf = backRawBytes[0] === 0x25 && backRawBytes[1] === 0x50 && backRawBytes[2] === 0x44 && backRawBytes[3] === 0x46;
                    if (isBackPdf) {
                      const backDoc = await PDFDocument.load(backRawBytes);
                      const [bPage] = await pdfDoc.embedPdf(backDoc, [0]);
                      backEmbeddedPdf = bPage;
                    } else {
                      backEmbeddedImg = await embedImageBuffer(pdfDoc, backRawBytes);
                    }
                  } else if (pageCount > 1) {
                    const [bPage] = await pdfDoc.embedPdf(customDoc, [1]);
                    backEmbeddedPdf = bPage;
                  }
                }
              } else {
                frontEmbeddedImg = await embedImageBuffer(pdfDoc, rawBytes);

                if (!isSingleSided && backsY !== null) {
                  if (ch.backPdfBytes) {
                    const backRawBytes = Uint8Array.from(atob(ch.backPdfBytes), c => c.charCodeAt(0));
                    const isBackPdf = backRawBytes[0] === 0x25 && backRawBytes[1] === 0x50 && backRawBytes[2] === 0x44 && backRawBytes[3] === 0x46;
                    if (isBackPdf) {
                      const backDoc = await PDFDocument.load(backRawBytes);
                      const [bPage] = await pdfDoc.embedPdf(backDoc, [0]);
                      backEmbeddedPdf = bPage;
                    } else {
                      backEmbeddedImg = await embedImageBuffer(pdfDoc, backRawBytes);
                    }
                  }
                }
              }
            } catch (loadErr: any) {
              addLog(`Error loading custom card asset: ${loadErr.message}`);
            }
          } else {
            const clientTemplate = {
              id: template.id,
              cardWidth: template.width || 1011,
              cardHeight: template.height || 638,
              frontImageUrl: template.frontImageUrl,
              backImageUrl: template.backImageUrl,
              frontOriginalUrl: template.frontOriginalUrl || null,
              backOriginalUrl: template.backOriginalUrl || null,
              frontFields: typeof template.frontFields === 'string' ? template.frontFields : JSON.stringify(template.frontFields || []),
              backFields: typeof template.backFields === 'string' ? template.backFields : JSON.stringify(template.backFields || []),
              version: template.version,
            };

            const clientCardholder = {
              ...ch,
              customFields: typeof ch.customFields === 'string' ? ch.customFields : JSON.stringify(ch.customFields || {}),
            };

            const frontPdfBytes = await renderCardSideToPdfBytesClient(
              clientTemplate,
              clientCardholder,
              'front',
              template.validTillDate ? new Date(template.validTillDate) : null,
              pressFonts
            );
            const frontCardDoc = await PDFDocument.load(frontPdfBytes);
            const [fPage] = await pdfDoc.embedPdf(frontCardDoc, [0]);
            frontEmbeddedPdf = fPage;
          }

          if (frontEmbeddedPdf) {
            page.drawPage(frontEmbeddedPdf, { x: xPos, y: frontsY, width: cWidth, height: cHeight });
          } else if (frontEmbeddedImg) {
            page.drawImage(frontEmbeddedImg, { x: xPos, y: frontsY, width: cWidth, height: cHeight });
          }

          // If double-sided, render back side
          if (!isSingleSided && backsY !== null) {
            addLog(`Rendering card [${overallIndex + 1}/${total}]: ${ch.name} (Back)`);

            if (!ch.isCustomPdf) {
              const clientTemplate = {
                id: template.id,
                cardWidth: template.width || 1011,
                cardHeight: template.height || 638,
                frontImageUrl: template.frontImageUrl,
                backImageUrl: template.backImageUrl,
                frontOriginalUrl: template.frontOriginalUrl || null,
                backOriginalUrl: template.backOriginalUrl || null,
                frontFields: typeof template.frontFields === 'string' ? template.frontFields : JSON.stringify(template.frontFields || []),
                backFields: typeof template.backFields === 'string' ? template.backFields : JSON.stringify(template.backFields || []),
                version: template.version,
              };

              const clientCardholder = {
                ...ch,
                customFields: typeof ch.customFields === 'string' ? ch.customFields : JSON.stringify(ch.customFields || {}),
              };

              const backPdfBytes = await renderCardSideToPdfBytesClient(
                clientTemplate,
                clientCardholder,
                'back',
                template.validTillDate ? new Date(template.validTillDate) : null,
                pressFonts
              );
              const backCardDoc = await PDFDocument.load(backPdfBytes);
              const [bPage] = await pdfDoc.embedPdf(backCardDoc, [0]);
              backEmbeddedPdf = bPage;
            }

            if (backEmbeddedPdf) {
              page.drawPage(backEmbeddedPdf, {
                x: xPos + cWidth,
                y: backsY + cHeight,
                width: cWidth,
                height: cHeight,
                rotate: degrees(180),
              });
            } else if (backEmbeddedImg) {
              page.drawImage(backEmbeddedImg, {
                x: xPos + cWidth,
                y: backsY + cHeight,
                width: cWidth,
                height: cHeight,
                rotate: degrees(180),
              });
            }
          }

          // Draw crop marks
          if (cropMarks) {
            drawCropMarks(page, xPos, frontsY, cWidth, cHeight);
            if (!isSingleSided && backsY !== null) {
              drawCropMarks(page, xPos, backsY, cWidth, cHeight);
            }
          }

          // Update progress dynamically
          const progressPercent = Math.min(90, Math.round(5 + ((overallIndex + 1) / total) * 85));
          await updateProgress(job.id, progressPercent);
        }
      }

      addLog(`Finalizing PDF (pages ${startPage + 1}–${endPage})...`);
      const pdfBytes = await pdfDoc.save();

      const base64Data = await toBase64ForNativeSave(pdfBytes);

      return { pdfBytes, base64Data };
    };

    // ── Execute compilation (single or multi-chunk) ─────────────────────
    if (!isMultiChunk) {
      // Single chunk — compile all pages in one PDFDocument (original behavior)
      const { pdfBytes, base64Data } = await compilePageRange(0, totalPages);
      await updateProgress(job.id, 95);
      await saveAndCompleteJob(job, order, pdfBytes, base64Data);
    } else {
      // Multi-chunk — compile each chunk separately, upload, free memory
      addLog(`Starting chunked compilation: ${totalChunks} parts...`);

      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const chunkStartPage = chunkIdx * MAX_PAGES_PER_CHUNK;
        const chunkEndPage = Math.min(chunkStartPage + MAX_PAGES_PER_CHUNK, totalPages);
        const pagesInChunk = chunkEndPage - chunkStartPage;

        addLog(`Compiling chunk ${chunkIdx + 1}/${totalChunks} (pages ${chunkStartPage + 1}–${chunkEndPage}, ${pagesInChunk} pages)...`);

        const { pdfBytes, base64Data } = await compilePageRange(chunkStartPage, chunkEndPage);

        const baseName = (job.fileName || 'production.pdf').replace(/\.pdf$/i, '');
        const chunkFileName = `${baseName}_part${chunkIdx + 1}.pdf`;

        await saveAndCompleteChunk(job, order, pdfBytes, base64Data, chunkIdx, totalChunks, chunkFileName);

        addLog(`Chunk ${chunkIdx + 1}/${totalChunks} complete. Memory released.`);
      }

      // Final job completion — chunks were uploaded individually
      await updateProgress(job.id, 100, 'PROCESSING');
      await reportJobComplete(job.id, true, undefined, undefined, totalChunks);
      addLog(`Production job completed: ${totalChunks} chunks generated successfully.`);
    }
  };

  // Background polling loop
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (isProcessingRef.current) return; // Busy compiling
      
      try {
        const res = await fetch('/api/jobs/production-poll', { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 401) {
            return;
          }
          throw new Error(`Polling request failed: ${res.statusText}`);
        }
        
        // ── Online: check and flush any queued print logs ───────────
        const electronAPI = (window as any).electronAPI;
        let currentQueueLength = offlineQueueCount;
        if (electronAPI?.getQueueStatus) {
          try {
            const status = await electronAPI.getQueueStatus();
            currentQueueLength = status?.queueLength ?? 0;
            if (currentQueueLength !== offlineQueueCount) {
              setOfflineQueueCount(currentQueueLength);
            }
          } catch (err) {
            console.error('Failed to get queue status:', err);
          }
        }

        if (currentQueueLength > 0) {
          addLog(`Found ${currentQueueLength} pending offline record(s). Flushing offline print queue...`);
          try {
            if (electronAPI?.flushPrintQueue) {
              const flushResult = await electronAPI.flushPrintQueue('');
              if (flushResult?.flushed > 0) {
                addLog(`Sync complete: ${flushResult.flushed} queued record(s) sent to server.`);
              }
              setOfflineQueueCount(flushResult?.remaining ?? 0);
              window.dispatchEvent(new Event('refresh-profile'));
            }
          } catch (flushErr: any) {
            addLog(`Offline queue flush error: ${flushErr.message}`);
          }
        }

        const data = await res.json();
        if (data.success && data.job) {
          addLog(`Found pending print job #${data.job.id} (${data.job.pdfType}). Starting compilation...`);
          isProcessingRef.current = true;
          setFinishedJobId(null);
          setActiveJob(data.job);
          setProgress(0);
          
          (async () => {
            try {
              await processJob(data);
              setFinishedJobId(data.job.id);
            } catch (err: any) {
              addLog(`Error compiling job #${data.job.id}: ${err.message}`);
              await reportJobComplete(data.job.id, false, err.message);
            } finally {
              isProcessingRef.current = false;
              // Display brief completion state before auto-closing daemon
              setTimeout(() => {
                setActiveJob(null);
                setFinishedJobId(null);
                setProgress(0);
              }, 3500);
            }
          })();
        }
      } catch (err: any) {
        // Mark as offline for next successful poll
        wasOfflineRef.current = true;
        console.error('Local poll error:', err);
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, []);

  // Periodically refresh the queue count display
  useEffect(() => {
    if (!isDesktop) return;
    const statusInterval = setInterval(async () => {
      try {
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.getQueueStatus) {
          const status = await electronAPI.getQueueStatus();
          setOfflineQueueCount(status?.queueLength ?? 0);
        }
      } catch (err) {
        // Silently ignore
      }
    }, 30000);
    return () => clearInterval(statusInterval);
  }, [isDesktop]);

  const [finishedJobId, setFinishedJobId] = useState<number | string | null>(null);

  // Close daemon completely when idle (only render when active job or finished job state exists)
  if (!activeJob && !finishedJobId) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      animation: 'slideUpFade 0.3s ease-out',
    }}>
      <div style={{
        background: 'rgba(13, 17, 30, 0.96)',
        border: finishedJobId ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(99, 102, 241, 0.45)',
        boxShadow: finishedJobId
          ? '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(16, 185, 129, 0.25)'
          : '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.35)',
        borderRadius: '14px',
        padding: '16px',
        width: '330px',
        color: '#fff',
        fontSize: '0.8rem',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}>
        {/* Active Job Glowing Top Ambient Bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: finishedJobId ? '#10b981' : 'transparent',
          backgroundImage: finishedJobId ? 'none' : 'linear-gradient(90deg, #4f46e5, #6366f1, #818cf8, #4f46e5)',
          backgroundSize: '200% 100%',
          animation: finishedJobId ? 'none' : 'gradientShimmer 2s linear infinite',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          {/* Pulsing Status Dot */}
          <div style={{ position: 'relative', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute',
              inset: '-2px',
              borderRadius: '50%',
              backgroundColor: finishedJobId ? '#10b981' : '#6366f1',
              opacity: 0.6,
              animation: finishedJobId ? 'none' : 'radarPulse 1.2s ease-out infinite',
            }} />
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: finishedJobId ? '#10b981' : '#818cf8',
              boxShadow: finishedJobId ? '0 0 10px #10b981' : '0 0 10px #818cf8',
            }} />
          </div>

          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Production Daemon
          </span>

          <span style={{
            fontSize: '0.68rem',
            color: finishedJobId ? '#34d399' : '#a5b4fc',
            background: finishedJobId ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
            border: finishedJobId ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '10px',
            padding: '1px 7px',
            fontWeight: 700,
            marginLeft: 'auto',
          }}>
            {finishedJobId ? 'COMPLETED' : 'PRINTING'}
          </span>
        </div>

        {/* Active Job Compile Progress or Finished Banner */}
        {finishedJobId ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', color: '#34d399', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center' }}>
            ✓ Print Job #{finishedJobId} Finished Successfully!
          </div>
        ) : activeJob ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem' }}>
                Job <strong style={{ color: '#a5b4fc' }}>#{activeJob.id}</strong> ({activeJob.pdfType})
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#818cf8', fontFamily: 'monospace' }}>
                {progress}%
              </span>
            </div>

            {/* Theme Glowing Progress Bar */}
            <div style={{
              position: 'relative',
              height: '8px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundImage: 'linear-gradient(90deg, #4f46e5, #6366f1, #818cf8, #4f46e5)',
                backgroundSize: '200% 100%',
                borderRadius: '4px',
                boxShadow: '0 0 10px rgba(99, 102, 241, 0.6)',
                animation: 'gradientShimmer 2s linear infinite',
                transition: 'width 0.3s ease',
              }} />
              <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '15px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
                animation: 'laserScanHorizontal 1.5s ease-in-out infinite',
              }} />
            </div>
          </div>
        ) : null}

        {/* Terminal Log Stream */}
        <div style={{
          paddingTop: '8px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          height: '60px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.66rem',
          color: 'rgba(255,255,255,0.65)',
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '3px',
          scrollbarWidth: 'none',
        }}>
          {log.map((entry, idx) => (
            <div key={idx} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: idx === 0 ? 1 : 0.7 }}>
              {entry}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUpFade {
          from { transform: translateY(15px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes radarPulse {
          0% { transform: scale(0.9); opacity: 0.9; }
          50% { transform: scale(1.6); opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes gradientShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes laserScanHorizontal {
          0% { left: 0%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

