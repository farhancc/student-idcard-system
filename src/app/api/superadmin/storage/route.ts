import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { requireSuperAdmin } from '@/lib/authz';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'idexo-card-photos';

const isR2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

let _s3Client: S3Client | null = null;
function getR2Client(): S3Client | null {
  if (!isR2Configured) return null;
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3Client;
}

// GET /api/superadmin/storage?prefix=&cursor=&limit= — browse R2 objects one page at a time
export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

  const client = getR2Client();
  if (!client) {
    return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || undefined;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50));

  try {
    const result = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: cursor,
      MaxKeys: limit,
    }));

    const objects = (result.Contents || []).map(obj => ({
      key: obj.Key || '',
      size: obj.Size ?? 0,
      lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      objects,
      isTruncated: !!result.IsTruncated,
      nextCursor: result.NextContinuationToken || null,
      // KeyCount is what R2 actually scanned this page, not a bucket-wide total —
      // there's no cheap way to get a true total without paging the whole bucket.
      pageKeyCount: result.KeyCount ?? objects.length,
    });
  } catch (err: any) {
    console.error('GET /api/superadmin/storage error:', err);
    return NextResponse.json({ error: 'Failed to list storage objects' }, { status: 500 });
  }
}

// DELETE /api/superadmin/storage — body: { key: string }
export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

  const client = getR2Client();
  if (!client) {
    return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const key = (body as { key?: unknown })?.key;
  if (typeof key !== 'string' || !key) {
    return NextResponse.json({ error: 'A storage key is required' }, { status: 400 });
  }

  try {
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/superadmin/storage error:', err);
    return NextResponse.json({ error: 'Failed to delete object' }, { status: 500 });
  }
}
