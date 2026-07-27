'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { renderCardSideToPdfBytesClient, embedImageBuffer, clearTemplateBgCache, clearFontBytesCache } from '@/lib/pdf/card-renderer-client';
import { resolveCardholderPhotoUrl } from '@/lib/pdf/field-resolver';
import { getCustomCardById } from '@/lib/clientDb';

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
          setActiveJob(data.job);
          setProgress(0);
          
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

  const reportJobComplete = async (jobId: number, success: boolean, errorMsg?: string, pdfBase64?: string, localPath?: string) => {
    try {
      const res = await fetch('/api/jobs/production-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, success, errorMsg, pdfBase64, localPath }),
        credentials: 'same-origin'
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      if (success) {
        addLog(`Successfully completed compilation for job #${jobId}`);
      } else {
        addLog(`Reported job #${jobId} compilation failure: ${errorMsg}`);
      }
      window.dispatchEvent(new Event('refresh-profile'));
    } catch (err: any) {
      addLog(`Network error reporting job #${jobId}. Queuing for offline sync...`);
      // Fallback: queue the completion payload locally
      try {
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.queuePrintLog) {
          const result = await electronAPI.queuePrintLog({ jobId, success, errorMsg, pdfBase64: undefined, localPath });
          setOfflineQueueCount(result?.queueLength ?? 0);
          addLog(`Queued offline. Total pending: ${result?.queueLength ?? '?'}`);
          wasOfflineRef.current = true;
        }
      } catch (queueErr: any) {
        addLog(`Failed to queue offline: ${queueErr.message}`);
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
      await reportJobComplete(job.id, true, undefined, undefined, saveResult.path);
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
      await reportJobComplete(job.id, true, undefined, base64Data, undefined);
      addLog('Job completed successfully. Download started.');
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
        if (ch.photoUrl && !ch.photoUrl.startsWith('blob:') && !ch.photoUrl.startsWith('data:')) {
          try {
            let fetchUrl = ch.photoUrl;
            if (ch.photoUrl.startsWith('/uploads/') || ch.photoUrl.startsWith('/api/uploads/') || ch.photoUrl.startsWith('uploads/')) {
              const portalUrl = (typeof process !== 'undefined' && process.env && process.env.PORTAL_URL) || 'https://idexocards.vercel.app';
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
                  (val.startsWith('http://') ||
                    val.startsWith('https://') ||
                    val.startsWith('/uploads/') ||
                    val.startsWith('uploads/') ||
                    val.startsWith('/api/uploads/'))
                ) {
                  let fetchUrl = val;
                  if (val.startsWith('/uploads/') || val.startsWith('/api/uploads/') || val.startsWith('uploads/')) {
                    const portalUrl = (typeof process !== 'undefined' && process.env && process.env.PORTAL_URL) || 'https://idexocards.vercel.app';
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
      frontFields: typeof template.frontFields === 'string' ? template.frontFields : JSON.stringify(template.frontFields || []),
      backFields: typeof template.backFields === 'string' ? template.backFields : JSON.stringify(template.backFields || []),
      version: template.version,
      validTill: template.validTillDate || null,
    };

    const clientCardholders = cardholders.map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      designation: ch.designation || null,
      photoUrl: ch.photoUrl || null,
      cardSerial: ch.cardSerial || null,
      uniqueKey: ch.uniqueKey || null,
      customFields: typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields || {},
    }));

    // Pre-cache photos locally in desktop client to enable robust offline rendering
    await cachePhotosForJob(clientCardholders);

    const { generateApprovalPdfClient } = await import('@/lib/pdf/approval-pdf-generator');

    const pdfBlob = await generateApprovalPdfClient(
      order.clientName || 'Client',
      order.clientName || 'Batch',
      clientTemplate,
      clientCardholders,
      pressFonts
    );

    await updateProgress(job.id, 80);

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

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

    await saveAndCompleteJob(job, order, pdfBytes, base64Data);
  };

  const processJob = async (jobPayload: any) => {
    const { job, template, cardholders, order, pressFonts = [] } = jobPayload;

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
        await electronAPI.deleteLocalTemplate({ templateId: template.id });
      } catch (e) {
        console.warn('[Daemon] Failed to purge stale local template files:', e);
      }
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
            // Empty/Unassigned slot stays BLANK
            finalCardholders.push({});
          }
        }
      } else {
        // LEAVE_BLANK
        for (let i = 0; i < diff; i++) {
          finalCardholders.push({}); // Empty object representing blank slot
        }
      }
    }

    addLog(`Layout Grid: cols=${cols}, cardsPerPage=${cardsPerPage}, totalPages=${totalPages}`);

    // Loop pages and add grids
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
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
          // Leave slot blank
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
            const isPdf = rawBytes[0] === 0x25 && rawBytes[1] === 0x50 && rawBytes[2] === 0x44 && rawBytes[3] === 0x46; // %PDF-

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
                } else {
                  const pageIndexForBack = pageCount > 1 ? 1 : 0;
                  const [bPage] = await pdfDoc.embedPdf(customDoc, [pageIndexForBack]);
                  backEmbeddedPdf = bPage;
                }
              }
            } else {
              // It's an image file (PNG / JPG / WebP / BMP / GIF)
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
                } else {
                  backEmbeddedImg = frontEmbeddedImg;
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

          // ── DIAGNOSTIC LOG ── Remove after debugging ──────────────────────
          try {
            const parsedFront = JSON.parse(clientTemplate.frontFields || '[]');
            console.log('[Daemon] Template frontFields field count:', parsedFront.length);
            parsedFront.forEach((f: any, i: number) => {
              console.log(`[Daemon] Field[${i}] field=${f.field} type=${f.type} fontSize=${f.fontSize} fontWeight=${f.fontWeight} color=${f.color} align=${f.align} prefix="${f.prefix}" suffix="${f.suffix}" x=${f.x} y=${f.y}`);
            });
          } catch (diagErr) {
            console.warn('[Daemon] Could not parse frontFields for diagnostic:', diagErr);
          }
          // ─────────────────────────────────────────────────────────────────

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

    await saveAndCompleteJob(job, order, pdfBytes, base64Data);
  };

  if (!activeJob) return null;

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
        {offlineQueueCount > 0 && (
          <span title={`${offlineQueueCount} print log(s) pending sync`} style={{
            background: 'rgba(239,68,68,0.2)',
            border: '1px solid rgba(239,68,68,0.6)',
            color: '#f87171',
            borderRadius: '10px',
            padding: '1px 7px',
            fontSize: '0.65rem',
            fontWeight: 700,
          }}>
            {offlineQueueCount} queued
          </span>
        )}
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
