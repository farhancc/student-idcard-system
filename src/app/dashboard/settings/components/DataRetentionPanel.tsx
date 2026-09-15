'use client';

import React, { useState } from 'react';
import { HardDrive, Search, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useToast } from '@/components/ui/toast';
import {
  backupClientBatch,
  describeBackups,
  fetchRetentionCandidates,
  formatBytes,
  purgeBackedUpBatch,
  type RetentionCandidate,
} from '@/lib/retention-client';
import type { SavedBackup } from '@/lib/downloadHelper';

/** `<input type="date">` works in the operator's local calendar, so build local dates. */
function startOfDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function endOfDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function sixMonthsAgo(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date;
}

/**
 * Back up a batch of old records to the operator's computer, then permanently
 * delete them from the database and Cloudflare R2.
 *
 * Nothing is deleted until the backup ZIP has been written and the operator has
 * confirmed what it contains — the purge itself is authorised by a token inside
 * that ZIP, so records whose photo could not be archived cannot be destroyed.
 */
export default function DataRetentionPanel() {
  const { toast } = useToast();
  const { confirmOpen, confirmConfig, showConfirm, closeConfirm } = useConfirmDialog();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState(isoDate(sixMonthsAgo()));
  const [candidates, setCandidates] = useState<RetentionCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState('');

  const fromDate = from ? startOfDay(from) : new Date(0);
  const toDate = to ? endOfDay(to) : null;

  const selectedClients = (candidates ?? []).filter((c) => selected.has(c.clientId));
  const selectedBytes = selectedClients.reduce((n, c) => n + c.estimatedBytes, 0);
  const selectedRecords = selectedClients.reduce((n, c) => n + c.records, 0);

  function toggle(clientId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  async function handleScan() {
    if (!toDate) {
      toast('Choose an end date first.', 'warning');
      return;
    }
    if (fromDate > toDate) {
      toast('The start date must come before the end date.', 'warning');
      return;
    }
    setScanning(true);
    setSelected(new Set());
    try {
      const { clients } = await fetchRetentionCandidates({ from: fromDate, to: toDate });
      setCandidates(clients);
      if (clients.length === 0) toast('No records found in that range.', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Scan failed.', 'error');
    } finally {
      setScanning(false);
    }
  }

  async function handleBackupAndPurge() {
    if (!toDate || selectedClients.length === 0) return;

    // Phase 1 — get every selected client safely onto disk. A client whose
    // backup fails is dropped here and never reaches the purge.
    const saved: Array<{ clientName: string; saved: SavedBackup }> = [];
    for (const client of selectedClients) {
      setBusy(`Backing up ${client.clientName}…`);
      try {
        saved.push({
          clientName: client.clientName,
          saved: await backupClientBatch(client, fromDate, toDate),
        });
      } catch (err) {
        toast(
          `Backup failed for ${client.clientName}: ${err instanceof Error ? err.message : 'unknown error'}. Nothing was deleted.`,
          'error',
          8000
        );
      }
    }
    setBusy('');
    if (saved.length === 0) return;

    // Phase 2 — the operator sees exactly what was saved, and where, before
    // anything is destroyed.
    showConfirm({
      title: 'Delete these records from the server?',
      message: describeBackups(saved),
      confirmLabel: 'Delete permanently',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        let records = 0;
        let files = 0;
        for (const { clientName, saved: backup } of saved) {
          setBusy(`Purging ${clientName}…`);
          try {
            const result = await purgeBackedUpBatch(backup.manifest);
            records += result.cardholdersDeleted;
            files += result.filesDeleted;
            if (result.filesFailed.length > 0) {
              toast(
                `${clientName}: ${result.filesFailed.length} stored file(s) could not be removed and were logged for a later sweep.`,
                'warning',
                8000
              );
            }
          } catch (err) {
            toast(
              `Purge failed for ${clientName}: ${err instanceof Error ? err.message : 'unknown error'}`,
              'error',
              8000
            );
          }
        }
        setBusy('');
        toast(`Deleted ${records.toLocaleString()} record(s) and ${files.toLocaleString()} stored file(s).`, 'success', 8000);
        handleScan();
      },
    });
  }

  return (
    <div className="glass-panel">
      <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <HardDrive size={18} color="var(--primary)" /> Data Retention &amp; Storage
      </h3>
      <p style={{ fontSize: '0.8rem', marginBottom: '20px', color: 'var(--muted)' }}>
        Back up old cardholders to your computer as a ZIP (Excel + photos), then permanently
        delete them from the server to free database and storage space. Invoices, delivery
        records and order history are always kept.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label className="form-label" htmlFor="retention-from">From (optional)</label>
          <input
            id="retention-from"
            type="date"
            className="form-input"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label className="form-label" htmlFor="retention-to">Up to and including</label>
          <input
            id="retention-to"
            type="date"
            className="form-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button
          className="btn btn-secondary"
          style={{ gap: '6px' }}
          onClick={handleScan}
          disabled={scanning || Boolean(busy) || !to}
        >
          <Search size={14} /> {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {candidates !== null && candidates.length === 0 && (
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          No records found in that date range.
        </span>
      )}

      {candidates !== null && candidates.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {candidates.map((c) => (
              <label
                key={c.clientId}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                  padding: '12px', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid var(--glass-border)', borderRadius: '8px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.clientId)}
                    onChange={() => toggle(c.clientId)}
                    disabled={Boolean(busy)}
                  />
                  <span>
                    <h5 style={{ fontSize: '0.85rem' }}>{c.clientName}</h5>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                      {c.records.toLocaleString()} record(s), {c.photos.toLocaleString()} photo(s)
                    </span>
                  </span>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  ~{formatBytes(c.estimatedBytes)}
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }} aria-live="polite">
              {busy
                ? busy
                : selectedClients.length === 0
                  ? 'Select the clients to archive.'
                  : `${selectedRecords.toLocaleString()} record(s) selected, freeing roughly ${formatBytes(selectedBytes)}.`}
            </span>
            <button
              className="btn btn-danger"
              style={{ gap: '6px' }}
              onClick={handleBackupAndPurge}
              disabled={selectedClients.length === 0 || Boolean(busy) || scanning}
            >
              <Trash2 size={14} /> {busy ? 'Working…' : 'Back up & delete'}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={confirmConfig?.title ?? ''}
        message={confirmConfig?.message ?? ''}
        confirmLabel={confirmConfig?.confirmLabel}
        variant={confirmConfig?.variant}
        onConfirm={() => confirmConfig?.onConfirm()}
        onCancel={closeConfirm}
      />
    </div>
  );
}
