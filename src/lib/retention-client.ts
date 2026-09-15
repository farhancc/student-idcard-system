import { downloadBackupArchive, type BackupManifest, type SavedBackup } from '@/lib/downloadHelper';

/**
 * Browser-side counterpart to `@/lib/retention`.
 *
 * Both entry points — the manual purge in Settings and the automatic 6-month
 * archive on the dashboard — run the same three steps, so they live here rather
 * than being written twice: export the batch, let the operator confirm what was
 * saved, then purge exactly what the manifest authorises.
 */

export interface RetentionCandidate {
  clientId: number;
  clientName: string;
  records: number;
  photos: number;
  estimatedBytes: number;
}

export interface PurgeOutcome {
  cardholdersDeleted: number;
  ordersArchived: number;
  pdfJobsDeleted: number;
  filesDeleted: number;
  filesFailed: string[];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export async function fetchRetentionCandidates(params: {
  from?: Date;
  to?: Date;
  olderThanMonths?: number;
}): Promise<{ clients: RetentionCandidate[]; from: string; to: string }> {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from.toISOString());
  if (params.to) query.set('to', params.to.toISOString());
  if (params.olderThanMonths) query.set('olderThanMonths', String(params.olderThanMonths));

  const res = await fetch(`/api/retention/candidates?${query}`);
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error || 'Could not load retention candidates.');
  }
  const json = await res.json();
  return { clients: json.clients ?? [], from: json.from, to: json.to };
}

/** Download and store one client's backup ZIP. Throws unless it is safely saved. */
export async function backupClientBatch(
  client: { clientId: number; clientName: string },
  from: Date,
  to: Date
): Promise<SavedBackup> {
  const query = new URLSearchParams({
    clientId: String(client.clientId),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const safeName = client.clientName.replace(/[^a-zA-Z0-9]/g, '_');
  const stamp = `${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}`;

  return downloadBackupArchive(
    `/api/retention/export?${query}`,
    `${safeName}_${stamp}.zip`,
    client.clientName
  );
}

/**
 * Permanently delete the records a saved backup accounts for.
 *
 * Only ever called with a manifest produced by the export route — the token it
 * carries is what the server checks the id list against.
 */
export async function purgeBackedUpBatch(manifest: BackupManifest): Promise<PurgeOutcome> {
  const res = await fetch('/api/retention/purge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: manifest.purgeToken, ids: manifest.exportedIds }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || 'Purge failed.');
  return json as PurgeOutcome;
}

/** Summary of what has been saved, shown in the confirm dialog before anything is deleted. */
export function describeBackups(items: Array<{ clientName: string; saved: SavedBackup }>): string {
  const records = items.reduce((n, i) => n + i.saved.manifest.exportedIds.length, 0);
  const bytes = items.reduce((n, i) => n + i.saved.bytes, 0);
  const skipped = items.reduce((n, i) => n + i.saved.manifest.skipped, 0);
  const remaining = items.reduce((n, i) => n + i.saved.manifest.remainingInScope, 0);

  const lines = [
    `Backed up ${records.toLocaleString()} record(s) across ${items.length} client(s) (${formatBytes(bytes)}):`,
    '',
    ...items.map(
      ({ clientName, saved }) =>
        `\u2022 ${clientName} \u2014 ${saved.manifest.exportedIds.length.toLocaleString()} record(s) \u2192 ` +
        (saved.path ?? 'your browser\u2019s Downloads folder')
    ),
    '',
    'Deleting these frees that space on the server permanently. Invoices, delivery records and order history are kept.',
  ];

  if (skipped > 0) {
    lines.push(
      '',
      `\u26A0 ${skipped} record(s) were left out because their photo could not be read. Those will NOT be deleted.`
    );
  }
  if (remaining > 0) {
    lines.push('', `${remaining.toLocaleString()} more record(s) remain in this range \u2014 run again to continue.`);
  }
  if (items.some(({ saved }) => !saved.path)) {
    lines.push('', 'Confirm only once you have checked the ZIP really is in your Downloads folder.');
  }

  return lines.join('\n');
}
