'use client';

export interface CustomCard {
  id: string;
  name: string;
  pdfBytes: string; // base64 string for front side
  backPdfBytes?: string; // base64 string for back side (if double-sided)
  isDoubleSided?: boolean;
  cardType?: string; // e.g. 'PAN Card', 'Driving License', 'Visitor Pass', etc.
  createdAt: number; // timestamp
  expiresAt: number; // timestamp
}

export function initClientDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }
    const request = window.indexedDB.open('IdexoClientDb', 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('customCards')) {
        db.createObjectStore('customCards', { keyPath: 'id' });
      }
    };
    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export async function saveCustomCard(
  name: string,
  pdfBytes: string,
  backPdfBytes?: string,
  isDoubleSided?: boolean,
  cardType?: string
): Promise<CustomCard> {
  const db = await initClientDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customCards', 'readwrite');
    const store = tx.objectStore('customCards');
    const now = Date.now();
    const expiresAt = now + 3 * 24 * 60 * 60 * 1000; // 3 days
    const item: CustomCard = {
      id: Math.random().toString(36).substring(2) + now.toString(36),
      name,
      pdfBytes,
      backPdfBytes,
      isDoubleSided: !!isDoubleSided,
      cardType: cardType || 'Custom PDF',
      createdAt: now,
      expiresAt
    };
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

export async function getCustomCards(): Promise<CustomCard[]> {
  const db = await initClientDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customCards', 'readonly');
    const store = tx.objectStore('customCards');
    const req = store.getAll();
    req.onsuccess = () => {
      const now = Date.now();
      const results = req.result || [];
      // Clean up expired ones asynchronously
      const valid = results.filter((item: CustomCard) => item.expiresAt > now);
      const expired = results.filter((item: CustomCard) => item.expiresAt <= now);
      if (expired.length > 0) {
        // Run deletion in another transaction
        initClientDb().then(writeDb => {
          const deleteTx = writeDb.transaction('customCards', 'readwrite');
          const deleteStore = deleteTx.objectStore('customCards');
          expired.forEach((item: CustomCard) => {
            deleteStore.delete(item.id);
          });
        }).catch(err => console.error('Failed to purge expired custom cards:', err));
      }
      resolve(valid);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCustomCardById(id: string): Promise<CustomCard | null> {
  const db = await initClientDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customCards', 'readonly');
    const store = tx.objectStore('customCards');
    const req = store.get(id);
    req.onsuccess = () => {
      const result = req.result;
      if (!result) {
        resolve(null);
        return;
      }
      // Check expiry
      if (result.expiresAt <= Date.now()) {
        // Expired, delete it
        initClientDb().then(writeDb => {
          const deleteTx = writeDb.transaction('customCards', 'readwrite');
          deleteTx.objectStore('customCards').delete(id);
        }).catch(err => console.error('Failed to delete expired card:', err));
        resolve(null);
      } else {
        resolve(result);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCustomCard(id: string): Promise<void> {
  const db = await initClientDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customCards', 'readwrite');
    const store = tx.objectStore('customCards');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
