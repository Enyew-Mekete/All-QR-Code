import { RestaurantQRCode } from '../types';

const DB_NAME = 'qrcode_generator_file_vault';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function openVaultDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const FileVault = {
  /**
   * Saves a file data URL into IndexedDB (supports hundreds of MBs, unlike localStorage).
   */
  async saveFile(id: string, dataUrl: string): Promise<void> {
    if (!id || !dataUrl) return;
    const db = await openVaultDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(dataUrl, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  /**
   * Retrieves a stored file data URL from IndexedDB by file ID.
   */
  async getFile(id: string): Promise<string | null> {
    if (!id) return null;
    const db = await openVaultDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  },

  /**
   * Hydrates any QR codes whose uploadedFiles URLs were omitted from localStorage.
   */
  async hydrateQRCodes(qrCodes: RestaurantQRCode[]): Promise<RestaurantQRCode[]> {
    if (!Array.isArray(qrCodes) || qrCodes.length === 0) return qrCodes;
    const db = await openVaultDB();
    if (!db) return qrCodes;

    const hydrated = await Promise.all(
      qrCodes.map(async (qr) => {
        if (!Array.isArray(qr.uploadedFiles) || qr.uploadedFiles.length === 0) return qr;
        const files = await Promise.all(
          qr.uploadedFiles.map(async (f) => {
            if (f && (!f.url || f.url.trim() === '')) {
              const restored = await this.getFile(f.id);
              if (restored) return { ...f, url: restored };
            }
            return f;
          })
        );
        return { ...qr, uploadedFiles: files };
      })
    );
    return hydrated;
  },

  /**
   * Compresses oversized PNG/JPG uploads (> 350 KB) into crisp HD WebP/JPEG (~150-400 KB)
   * so uploaded menu sheets persist cleanly across localStorage, IndexedDB, and 4G scans.
   * SVGs and PDFs are returned untouched.
   */
  async compressImageIfLarge(dataUrl: string, maxDimension = 1600): Promise<string> {
    if (
      !dataUrl ||
      !dataUrl.startsWith('data:image/') ||
      dataUrl.startsWith('data:image/svg+xml') ||
      dataUrl.length < 350000
    ) {
      return dataUrl;
    }

    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const natW = img.naturalWidth || img.width;
            const natH = img.naturalHeight || img.height;
            if (!natW || !natH) {
              resolve(dataUrl);
              return;
            }
            const ratio = Math.min(1, maxDimension / Math.max(natW, natH));
            const w = Math.max(1, Math.round(natW * ratio));
            const h = Math.max(1, Math.round(natH * ratio));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(dataUrl);
              return;
            }
            // White background prevents transparent PNGs turning black in JPEG fallback
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            const compressed = canvas.toDataURL('image/jpeg', 0.86);
            resolve(compressed && compressed.length < dataUrl.length ? compressed : dataUrl);
          } catch {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch {
        resolve(dataUrl);
      }
    });
  },
};
