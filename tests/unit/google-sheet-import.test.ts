import { describe, it, expect, vi, beforeEach } from 'vitest';

// The route is only reachable to an authenticated press actor; the behaviour
// under test is URL handling and parsing, so the guard is stubbed open.
vi.mock('@/lib/authz', () => ({
  requireActor: () => ({ actor: { pressId: 1, role: 'OWNER' } }),
}));

const fetchPublicAsset = vi.fn();
vi.mock('@/lib/safe-fetch', async () => {
  const actual = await vi.importActual<typeof import('@/lib/safe-fetch')>('@/lib/safe-fetch');
  return { ...actual, fetchPublicAsset: (...args: unknown[]) => fetchPublicAsset(...args) };
});

const { POST } = await import('@/app/api/import/google-sheet/route');

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/import/google-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));

beforeEach(() => fetchPublicAsset.mockReset());

describe('POST /api/import/google-sheet', () => {
  it('explains the setup instead of failing blankly on a Form link', async () => {
    const res = await post({ url: 'https://docs.google.com/forms/d/e/1FAIpQLSc/viewform' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.kind).toBe('form-link');
    // Must name the actual fix, not just report an error.
    expect(json.error).toMatch(/Link to Sheets/i);
    expect(fetchPublicAsset).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a Sheets URL without fetching it', async () => {
    for (const url of ['https://evil.example.com/x.csv', 'not a url', 'https://docs.google.com/document/d/abc']) {
      const res = await post({ url });
      expect(res.status, url).toBe(400);
    }
    expect(fetchPublicAsset).not.toHaveBeenCalled();
  });

  it('requests the CSV export built from the sheet id, not the pasted string', async () => {
    fetchPublicAsset.mockResolvedValue({
      body: Buffer.from('Name,Phone\nAsha,900\nRavi,901\n'),
      contentType: 'text/csv',
    });

    const res = await post({
      url: 'https://docs.google.com/spreadsheets/d/1AbC-_dEF/edit?resourcekey=x#gid=0',
    });

    expect(res.status).toBe(200);
    expect(fetchPublicAsset).toHaveBeenCalledOnce();
    // The pasted query/fragment must not survive into the outbound request.
    expect(fetchPublicAsset.mock.calls[0][0]).toBe(
      'https://docs.google.com/spreadsheets/d/1AbC-_dEF/export?format=csv'
    );

    const json = await res.json();
    expect(json.rowCount).toBe(2);
    expect(json.headers).toEqual(['Name', 'Phone']);
    expect(json.rows[0]).toMatchObject({ Name: 'Asha', Phone: '900' });
  });

  it('treats the sign-in HTML an unshared sheet returns as a sharing error', async () => {
    // Google answers 200 with its login page rather than a 403, so a naive
    // parse would hand the operator a sheet of HTML fragments.
    fetchPublicAsset.mockResolvedValue({
      body: Buffer.from('<!DOCTYPE html><html><head><title>Sign in</title></head></html>'),
      contentType: 'text/html',
    });

    const res = await post({ url: 'https://docs.google.com/spreadsheets/d/1AbC/edit' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not publicly readable/i);
  });
});
