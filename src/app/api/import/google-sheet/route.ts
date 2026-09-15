import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { z } from 'zod';
import { requireActor } from '@/lib/authz';
import { fetchPublicAsset, UnsafeAssetError } from '@/lib/safe-fetch';

/**
 * Pulls the rows of a link-shared Google Sheet — in practice the sheet a Google
 * Form writes its responses to.
 *
 * Server-side by necessity: Google's /export endpoint sends no CORS headers, so
 * fetching it from the browser is unreliable.
 *
 * Reading responses straight from a Form link is not possible — the Forms API
 * requires OAuth as the form owner — so the caller pastes the linked Sheet and
 * we detect a Form URL to explain the one-time setup instead of failing blankly.
 */

const SHEET_ID = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

export const FORM_LINK_HELP =
  'That is a Google Form link, which only holds the blank form — responses live in its linked sheet. ' +
  "Open the form → Responses → Link to Sheets, then share that sheet (Anyone with the link can view) and paste its link here. " +
  'If the form collects photo uploads, share the response folder in Google Drive the same way, or the photos will print blank.';

const schema = z.object({ url: z.string().trim().min(1, 'Paste a Google Sheet link.') });

export async function POST(request: Request) {
  const auth = requireActor(request);
  if ('response' in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { url } = parsed.data;

  if (url.includes('/forms/d/')) {
    return NextResponse.json({ error: FORM_LINK_HELP, kind: 'form-link' }, { status: 400 });
  }

  const match = url.match(SHEET_ID);
  if (!match) {
    return NextResponse.json(
      { error: 'That does not look like a Google Sheet link. Example: https://docs.google.com/spreadsheets/d/...' },
      { status: 400 }
    );
  }

  // Built from a validated id, never from the pasted string — the only host we
  // request is docs.google.com. Redirects are deliberately not host-restricted:
  // Google serves the export body from googleusercontent.com, and every hop is
  // still re-checked for scheme and non-private address by fetchPublicAsset.
  const exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;

  let csvText: string;
  try {
    const asset = await fetchPublicAsset(exportUrl, {
      allowedContentTypePrefixes: ['text/', 'application/octet-stream'],
    });
    csvText = asset.body.toString('utf8');
  } catch (err) {
    // A sheet that is missing or not link-shared both surface as FETCH_FAILED,
    // and "not shared" is overwhelmingly the likelier cause — lead with the fix
    // and keep the code for diagnosis. TOO_LARGE/TIMEOUT need their own wording.
    const code = err instanceof UnsafeAssetError ? err.code : 'FETCH_FAILED';
    const message =
      code === 'TOO_LARGE'
        ? 'That sheet is too large to import in one go. Split the responses across sheets and try again.'
        : code === 'TIMEOUT'
          ? 'Google did not respond in time. Try again in a moment.'
          : `Could not read that sheet (${code}). Check the link is correct and sharing is on — Share → General access → Anyone with the link → Viewer.`;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // A sheet that is not shared returns Google's HTML sign-in page with a 200.
  if (/^\s*<(!doctype|html)/i.test(csvText)) {
    return NextResponse.json(
      {
        error:
          'That sheet is not publicly readable. Share → General access → Anyone with the link → Viewer, then try again.',
      },
      { status: 400 }
    );
  }

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = (result.data || []).filter(r => r && Object.keys(r).length > 0);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'That sheet has no response rows yet.' }, { status: 400 });
  }

  return NextResponse.json({
    headers: (result.meta?.fields || []).filter(Boolean),
    rows,
    rowCount: rows.length,
  });
}
