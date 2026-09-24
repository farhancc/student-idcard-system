/**
 * Queues one "print this card by itself" job per cardholder.
 *
 * There is no "subset of an order" concept in the job model — one PdfJob
 * always compiles its order's full cardholder set — so N separate PDFs means
 * N separate 1-cardholder orders, each with its own INDIVIDUAL job. Both the
 * Cardholders tab and the Batch Import CSV wizard queue individual prints
 * through this one loop rather than duplicating it.
 */
export interface QueueIndividualJobsParams {
  clientId: number;
  templateId: number;
  cardholderIds: number[];
  paperSize: 'A4' | 'A3';
  orgToken?: string;
  onProgress?: (done: number, total: number) => void;
}

export interface QueueIndividualJobsResult {
  queued: number;
  failed: number;
  jobIds: number[];
}

export async function queueIndividualPrintJobs({
  clientId,
  templateId,
  cardholderIds,
  paperSize,
  orgToken,
  onProgress,
}: QueueIndividualJobsParams): Promise<QueueIndividualJobsResult> {
  let queued = 0;
  let failed = 0;
  const jobIds: number[] = [];

  for (let i = 0; i < cardholderIds.length; i++) {
    const cardholderId = cardholderIds[i];
    try {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          templateId,
          cardholderIds: [cardholderId],
          status: 'APPROVED',
          ...(orgToken ? { orgToken } : {}),
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

      const jobRes = await fetch('/api/jobs/production-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.order.id,
          pdfType: 'INDIVIDUAL',
          paperSize,
          orientation: 'PORTRAIT',
          ...(orgToken ? { orgToken } : {}),
        }),
      });
      const jobData = await jobRes.json();
      if (!jobRes.ok) throw new Error(jobData.error || 'Failed to queue individual print job');

      jobIds.push(jobData.jobId);
      queued++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, cardholderIds.length);
  }

  return { queued, failed, jobIds };
}
