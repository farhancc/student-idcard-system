/**
 * Helper to safely encode Uint8Array to base64 in 32KB chunks without stack overflow
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Utility to automatically download or save a completed PDF print job file
 * directly into the target documents directory (Electron) or user's downloads (Browser).
 */
export async function autoDownloadJobFile(downloadUrl: string, fileName?: string, clientName?: string): Promise<string | undefined> {
  if (!downloadUrl) return;

  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;

  // 1. Desktop Client (Electron) native file saving (silent auto-save to Documents folder)
  if (electronAPI && typeof electronAPI.savePdfLocally === 'function') {
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Failed to fetch PDF for local saving');
      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64Data = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
      const targetFileName = fileName || downloadUrl.split('/').pop()?.split('?')[0] || `idexo_print_job_${Date.now()}.pdf`;
      const saveRes = await electronAPI.savePdfLocally(targetFileName, base64Data, clientName || 'Client');
      if (saveRes && saveRes.success) {
        console.log('PDF auto-saved locally via native bridge silently:', saveRes.path);
        return saveRes.path;
      }
    } catch (err) {
      console.error('Electron native auto-save error:', err);
    }
  }

  // 2. Web Browser automatic file download (only reached if not in Electron or native save failed)
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error('Failed to fetch PDF blob for download');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || downloadUrl.split('/').pop()?.split('?')[0] || `idexo_print_job_${Date.now()}.pdf`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 10000);
  } catch (err) {
    console.error('Browser automatic file download error:', err);
  }
}


/** The slice of the Electron preload bridge this module uses. */
interface ElectronBackupBridge {
  saveBackupLocally?: (
    clientName: string,
    label: string,
    base64ZipData: string
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
}

/** The `manifest.json` entry written as the last file of a retention backup ZIP. */
export interface BackupManifest {
  client: { id: number; name: string };
  range: { from: string; to: string };
  generatedAt: string;
  /** Records that verifiably made it into this archive — the only ones a purge may touch. */
  exportedIds: number[];
  /** Records left out because their photo could not be archived. */
  skipped: number;
  /** Records still matching the scope beyond this batch. */
  remainingInScope: number;
  purgeToken: string;
}

export interface SavedBackup {
  manifest: BackupManifest;
  /** Absolute path on disk (desktop), or null when the browser handled the download. */
  path: string | null;
  bytes: number;
}

/**
 * Fetch a retention backup ZIP, store it on the operator's machine, and return
 * the manifest that authorises purging what it contains.
 *
 * Throws rather than returning partial success: the caller uses the result to
 * decide whether to permanently delete the records, so "saved" must mean saved.
 */
export async function downloadBackupArchive(
  url: string,
  fileName: string,
  clientName: string
): Promise<SavedBackup> {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error || `Backup download failed (${res.status})`);
  }

  const bytes = new Uint8Array(await (await res.blob()).arrayBuffer());

  // Read the manifest before saving — a ZIP we cannot parse is not a backup we
  // should be deleting anything on the strength of.
  const JSZip = (await import('jszip')).default;
  const entry = (await JSZip.loadAsync(bytes)).file('manifest.json');
  if (!entry) throw new Error('Backup archive is missing its manifest; refusing to purge.');
  const manifest: BackupManifest = JSON.parse(await entry.async('string'));

  const electronAPI = (globalThis as { electronAPI?: ElectronBackupBridge }).electronAPI;

  if (typeof electronAPI?.saveBackupLocally === 'function') {
    const saveRes = await electronAPI.saveBackupLocally(
      clientName,
      fileName.replace(/\.zip$/i, ''),
      uint8ArrayToBase64(bytes)
    );
    if (!saveRes?.success) {
      throw new Error(saveRes?.error || 'Could not write the backup to disk.');
    }
    return { manifest, path: saveRes.path ?? null, bytes: bytes.byteLength };
  }

  // Browser: hand the file to the download manager. The browser gives no
  // completion signal for a blob download, so the caller must have the operator
  // confirm the file arrived before purging anything.
  const blobUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // These archives can be hundreds of MB; do not leak them for the tab's life.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }

  return { manifest, path: null, bytes: bytes.byteLength };
}
