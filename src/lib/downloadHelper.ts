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

