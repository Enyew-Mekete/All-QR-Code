import { RestaurantQRCode } from '../types';

export const UrlResolver = {
  /**
   * Resolves the real live base URL of the running application.
   */
  getBaseAppUrl(customBaseUrl?: string): string {
    if (customBaseUrl && customBaseUrl.trim() !== '') {
      let url = customBaseUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      return url.replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      const pathname = window.location.pathname.replace(/\/+$/, '');
      return `${origin}${pathname}`;
    }

    return 'https://qrcodegenerator.io';
  },

  /**
   * Generates the real, scan-testable URL for any generated QR code.
   * Scanning routes directly to the QR Scan Landing & Welcome Screen!
   */
  getScanUrl(qr: RestaurantQRCode, customBaseUrl?: string): string {
    const base = this.getBaseAppUrl(customBaseUrl);
    const params = new URLSearchParams();
    params.set('mode', 'scan');
    if (qr.id) {
      params.set('qr', qr.id);
    }
    if (qr.type) {
      params.set('type', qr.type);
    }
    if (qr.tableNumber) {
      params.set('table', qr.tableNumber.toString());
    }

    return `${base}?${params.toString()}`;
  },

  /**
   * Detects whether the current browser session was opened via a QR scan link.
   */
  detectScanSession(): {
    isScan: boolean;
    qrId?: string;
    tableNumber?: number;
    type?: string;
  } {
    if (typeof window === 'undefined' || !window.location) {
      return { isScan: false };
    }

    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    const mode = searchParams.get('mode');
    const isScanParam = mode === 'scan' || mode === 'customer';
    const hasScanParam = searchParams.has('scan') || searchParams.has('qr') || searchParams.has('table');
    const isMenuHash = hash.includes('scan') || hash.includes('customer');

    const isScan = isScanParam || hasScanParam || isMenuHash;

    const tableStr = searchParams.get('table');
    const tableNumber = tableStr ? parseInt(tableStr, 10) : undefined;
    const qrId = searchParams.get('qr') || undefined;
    const type = searchParams.get('type') || undefined;

    return {
      isScan,
      qrId,
      tableNumber,
      type,
    };
  },
};
