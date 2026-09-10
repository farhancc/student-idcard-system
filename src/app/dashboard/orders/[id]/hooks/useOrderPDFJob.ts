import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import type { OrderDetail, PrintJobDetail } from '../types';

export function useOrderPDFJob(orderId: number, order: OrderDetail | null, fetchData: () => void) {
  const { toast } = useToast();
  
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<PrintJobDetail | null>(null);
  const [pendingCompileType, setPendingCompileType] = useState<string | null>(null);

  useEffect(() => {
    if (!order || !order.pdfJobs) return;
    const hasActiveJobs = order.pdfJobs.some((j: any) => j.status === 'PROCESSING' || j.status === 'PENDING');
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(interval);
  }, [order, fetchData]);

  const getLatestJob = (type: string) => {
    if (!order || !order.pdfJobs) return null;
    return order.pdfJobs.find((j: any) => j.pdfType === type);
  };

  const proceedWithCompile = async (
    type: string,
    skipValidation = false,
    selectedStrategy: 'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM' = 'LEAVE_BLANK',
    layoutConfig?: any,
    selectedCustomCardId?: string
  ) => {
    setPdfLoading(type);
    try {
      const targetPaperSize = layoutConfig?.paperSize || 'A3';
      const targetOrientation = layoutConfig?.orientation || 'PORTRAIT';

      const body: any = {
        orderId,
        pdfType: type,
        paperSize: type === 'INVOICE' ? 'A4' : (targetPaperSize === 'SRA3' || targetPaperSize === '13x19' ? 'CUSTOM' : targetPaperSize),
        orientation: type === 'INVOICE' ? 'PORTRAIT' : targetOrientation,
        emptySlotStrategy: selectedStrategy,
        bypassValidation: skipValidation,
      };

      if (selectedStrategy === 'FILL_CUSTOM') {
        body.emptySlotCustomCardId = selectedCustomCardId;
      }

      if (type !== 'INVOICE') {
        if (targetPaperSize === 'SRA3') {
          body.customWidth = targetOrientation === 'PORTRAIT' ? 907.09 : 1275.59;
          body.customHeight = targetOrientation === 'PORTRAIT' ? 1275.59 : 907.09;
        } else if (targetPaperSize === '13x19') {
          body.customWidth = targetOrientation === 'PORTRAIT' ? 936 : 1368;
          body.customHeight = targetOrientation === 'PORTRAIT' ? 1368 : 936;
        }
      }

      if (type === 'PRODUCTION' || type === 'APPROVAL' || type === 'INDIVIDUAL') {
        if (layoutConfig) {
          body.marginLeft   = layoutConfig.marginLeft;
          body.marginTop    = layoutConfig.marginTop;
          body.marginRight  = layoutConfig.marginRight;
          body.marginBottom = layoutConfig.marginBottom;
          body.colGap       = layoutConfig.colGap;
          body.rowGap       = layoutConfig.rowGap;
          body.bleed        = layoutConfig.bleed;
          body.cropMarks    = layoutConfig.cropMarks;
          body.foldLine     = layoutConfig.foldLine;
        }
      }

      const res = await fetch('/api/jobs/production-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error compiling PDF');
      
      window.dispatchEvent(new Event('refresh-profile'));

      const cardCount = order?._count?.cardholders ?? order?.cardholders?.length ?? 0;
      if (type === 'PRODUCTION') {
        toast(`Production job #${data.jobId} queued! Locked ${cardCount} credits.`, 'success');
      } else if (type === 'INVOICE') {
        toast(`Invoice job #${data.jobId} queued!`, 'success');
      } else {
        toast(`Approval draft job #${data.jobId} queued!`, 'success');
      }
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Error compiling PDF', 'error');
    } finally {
      setPdfLoading(null);
    }
  };

  return {
    pdfLoading, setPdfLoading,
    previewJob, setPreviewJob,
    pendingCompileType, setPendingCompileType,
    getLatestJob,
    proceedWithCompile
  };
}
