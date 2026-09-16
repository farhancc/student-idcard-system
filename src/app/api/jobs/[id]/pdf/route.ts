import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { saveCompiledPdf } from '@/lib/storage';

/**
 * Store the bytes of a PDF the client has just compiled.
 *
 * The bytes used to ride along with the completion call as base64. They cannot:
 * a proxied request body is buffered to `proxyClientMaxBodySize` (10MB) and the
 * remainder is dropped *silently*, so any sheet past roughly three cards reached
 * the route as half a JSON document, 400'd, and left the job sitting at 100%
 * with its credits still locked.
 *
 * Carrying them on their own request makes the server copy best-effort — it can
 * fail, or be skipped for a sheet too large to send, without stopping the job
 * from settling. The operator's own saved file is the master copy either way.
 */

/** `proxyClientMaxBodySize` default — past this the proxy hands us a truncated body. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ['OWNER', 'OPERATOR']);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { id } = await params;
    const jobId = Number(id);
    if (!Number.isInteger(jobId)) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const chunkParam = new URL(request.url).searchParams.get('chunk');
    const chunkIndex = chunkParam === null ? null : Number(chunkParam);
    if (chunkIndex !== null && !Number.isInteger(chunkIndex)) {
      return NextResponse.json({ error: 'Invalid chunk index' }, { status: 400 });
    }

    const job = await prisma.pdfJob.findFirst({
      where: { id: jobId, pressId },
      select: { id: true, status: true, pdfType: true, orderId: true },
    });
    if (!job) {
      return NextResponse.json({ error: 'PDF Job not found' }, { status: 404 });
    }
    if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
      return NextResponse.json({ error: 'Job has already been settled' }, { status: 409 });
    }

    // The proxy truncates an oversized body without saying so, and a short read
    // is indistinguishable from a small PDF — so a declared length is the only
    // thing that makes storing these bytes safe, and it is required.
    const declaredLength = Number(request.headers.get('content-length'));
    if (!Number.isInteger(declaredLength) || declaredLength <= 0) {
      return NextResponse.json({ error: 'Content-Length is required' }, { status: 411 });
    }
    if (declaredLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'PDF is larger than the server copy limit', stored: false },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json({ error: 'Empty PDF body' }, { status: 400 });
    }
    // A truncated body still arrives looking like a valid request; storing it
    // would hand the operator a corrupt PDF and call the job done.
    if (bytes.length !== declaredLength) {
      return NextResponse.json(
        { error: 'PDF body was truncated in transit', stored: false },
        { status: 413 }
      );
    }
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json({ error: 'Body is not a PDF' }, { status: 400 });
    }

    const chunk = chunkIndex === null
      ? null
      : await prisma.pdfJobChunk.findFirst({ where: { pdfJobId: jobId, chunkIndex } });
    if (chunkIndex !== null && !chunk) {
      return NextResponse.json({ error: 'Chunk record not found' }, { status: 404 });
    }

    // Named after the job rather than after the job's own fileName, which only
    // counts versions per order and so can repeat across jobs; the name on the
    // operator's download still comes from the job row.
    const storedName = `${String(job.pdfType).toLowerCase()}_order_${job.orderId}_job_${jobId}`
      + (chunk ? `_part${chunk.chunkIndex + 1}` : '') + '.pdf';

    const downloadUrl = await saveCompiledPdf({ pressId, fileName: storedName, bytes });

    if (chunk) {
      await prisma.pdfJobChunk.update({
        where: { id: chunk.id },
        data: { downloadUrl, fileSize: bytes.length },
      });
    } else {
      await prisma.pdfJob.update({
        where: { id: jobId },
        data: { downloadUrl },
      });
    }

    return NextResponse.json({ success: true, stored: true });
  } catch (error) {
    console.error('Store compiled PDF error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
