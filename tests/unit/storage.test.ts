import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseR2KeyFromUrl, isR2Configured, toDeletableR2Keys } from '@/lib/storage';

describe('Cloudflare R2 Storage Module', () => {
  describe('parseR2KeyFromUrl', () => {
    it('parses local /uploads/ URLs correctly', () => {
      const key = parseR2KeyFromUrl('/uploads/press_1/photos/student.png');
      expect(key).toBe('press_1/photos/student.png');
    });

    it('parses Cloudflare R2 / S3 public URLs correctly', () => {
      const key = parseR2KeyFromUrl('https://pub-r2.idexo.app/cardholders/photos/1700000000-abc123.jpg');
      expect(key).toBe('cardholders/photos/1700000000-abc123.jpg');
    });

    it('parses legacy Cloudinary URLs correctly as fallback', () => {
      const key = parseR2KeyFromUrl('https://res.cloudinary.com/demo/image/upload/v1612345/press_1/photos/student.jpg');
      expect(key).toBe('press_1/photos/student.jpg');
    });

    it('handles relative path or plain key strings', () => {
      const key = parseR2KeyFromUrl('press_2/templates/layout.pdf');
      expect(key).toBe('press_2/templates/layout.pdf');
    });

    it('returns null for empty input', () => {
      expect(parseR2KeyFromUrl('')).toBeNull();
    });
  });

  describe('isR2Configured', () => {
    it('evaluates boolean based on R2 env variables', () => {
      expect(typeof isR2Configured).toBe('boolean');
    });
  });
});

describe('toDeletableR2Keys', () => {
  it('drops objects that do not live in our bucket', () => {
    // Asking R2 to delete a Cloudinary path or a desktop-only file burns a
    // billed operation that can never match anything.
    expect(
      toDeletableR2Keys([
        'https://res.cloudinary.com/demo/image/upload/v1/press_1/photos/a.jpg',
        'local://press_1/pdfs/job.pdf',
        '',
      ])
    ).toEqual([]);
  });

  it('de-duplicates keys so a shared object is deleted once', () => {
    expect(
      toDeletableR2Keys([
        'https://pub-r2.idexo.app/press_1/photos/a.jpg',
        '/uploads/press_1/photos/a.jpg',
        'press_1/photos/a.jpg',
      ])
    ).toEqual(['press_1/photos/a.jpg']);
  });
});

describe('deleteManyFromR2 batching', () => {
  const sent: any[] = [];

  beforeEach(() => {
    sent.length = 0;
    vi.resetModules();
    vi.stubEnv('R2_ACCOUNT_ID', 'acct');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('R2_BUCKET_NAME', 'test-bucket');
  });

  afterEach(() => vi.unstubAllEnvs());

  async function loadStorage() {
    vi.doMock('@aws-sdk/client-s3', () => ({
      S3Client: class {
        async send(command: any) {
          sent.push(command);
          return { Errors: [] };
        }
      },
      PutObjectCommand: class {},
      DeleteObjectCommand: class {},
      DeleteObjectsCommand: class {
        input: any;
        constructor(input: any) { this.input = input; }
      },
    }));
    return import('@/lib/storage');
  }

  it('deletes thousands of objects in a handful of requests', async () => {
    const { deleteManyFromR2, R2_DELETE_BATCH_SIZE } = await loadStorage();
    const keys = Array.from({ length: 2500 }, (_, i) => `https://pub-r2.idexo.app/press_1/photos/${i}.jpg`);

    const result = await deleteManyFromR2(keys);

    // One billed op per object would be 2500 calls; batching makes it 3.
    expect(sent).toHaveLength(Math.ceil(2500 / R2_DELETE_BATCH_SIZE));
    expect(sent[0].input.Bucket).toBe('test-bucket');
    expect(sent[0].input.Delete.Objects).toHaveLength(R2_DELETE_BATCH_SIZE);
    expect(sent[2].input.Delete.Objects).toHaveLength(500);
    expect(result.deleted).toBe(2500);
    expect(result.failed).toEqual([]);
  });

  it('makes no request at all when nothing is deletable', async () => {
    const { deleteManyFromR2 } = await loadStorage();
    const result = await deleteManyFromR2(['local://a.pdf', '']);

    expect(sent).toHaveLength(0);
    expect(result).toEqual({ deleted: 0, failed: [] });
  });

  it('reports the keys R2 refused instead of claiming success', async () => {
    vi.doMock('@aws-sdk/client-s3', () => ({
      S3Client: class {
        async send() {
          return { Errors: [{ Key: 'press_1/photos/1.jpg', Code: 'AccessDenied' }] };
        }
      },
      PutObjectCommand: class {},
      DeleteObjectCommand: class {},
      DeleteObjectsCommand: class { constructor(public input: any) {} },
    }));
    const { deleteManyFromR2 } = await import('@/lib/storage');

    const result = await deleteManyFromR2([
      'https://pub-r2.idexo.app/press_1/photos/1.jpg',
      'https://pub-r2.idexo.app/press_1/photos/2.jpg',
    ]);

    expect(result.deleted).toBe(1);
    expect(result.failed).toEqual(['press_1/photos/1.jpg']);
  });
});
