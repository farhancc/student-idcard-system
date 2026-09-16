import { useState, useEffect } from 'react';
import type { OrderDetail, PrintJobDetail } from '../types';
import { autoDownloadJobFile } from '@/lib/downloadHelper';

export function useOrderPDFJob(order: OrderDetail | null, fetchData: () => void) {
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<PrintJobDetail | null>(null);
  const [pendingCompileType, setPendingCompileType] = useState<string | null>(null);

  const [downloadedJobIds, setDownloadedJobIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!order || !order.pdfJobs) return;

    // Auto-download any newly completed PDF job
    order.pdfJobs.forEach((j: any) => {
      if (j.status === 'COMPLETED' && j.downloadUrl && !downloadedJobIds[j.id]) {
        autoDownloadJobFile(j.downloadUrl, j.fileName, order?.client?.name || (order as any)?.clientName);
        setDownloadedJobIds(prev => ({ ...prev, [j.id]: true }));
      }
    });

    const hasActiveJobs = order.pdfJobs.some((j: any) => j.status === 'PROCESSING' || j.status === 'PENDING');
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(interval);
  }, [order, fetchData, downloadedJobIds]);

  const getLatestJob = (type: string) => {
    if (!order || !order.pdfJobs) return null;
    return order.pdfJobs.find((j: any) => j.pdfType === type);
  };

  return {
    pdfLoading, setPdfLoading,
    previewJob, setPreviewJob,
    pendingCompileType, setPendingCompileType,
    getLatestJob,
  };
}
