import { RestaurantQRCode } from '../types';

const CUSTOM_SCAN_BASE_KEY = 'qrcode_generator_custom_scan_base_url';

export const UrlResolver = {
  getCustomBaseUrl(): string {
    try {
      return (typeof localStorage !== 'undefined' && localStorage.getItem(CUSTOM_SCAN_BASE_KEY)) || '';
    } catch {
      return '';
    }
  },

  setCustomBaseUrl(url: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const trimmed = url.trim().replace(/\/+$/, '');
      if (trimmed) {
        localStorage.setItem(CUSTOM_SCAN_BASE_KEY, trimmed);
      } else {
        localStorage.removeItem(CUSTOM_SCAN_BASE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  },

  isPrivateNetworkUrl(url: string): boolean {
    return /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);
  },

  /**
   * Resolves the real live base URL of the running application.
   */
  getBaseAppUrl(customBaseUrl?: string): string {
    const override = (customBaseUrl !== undefined ? customBaseUrl : this.getCustomBaseUrl()).trim();
    if (override !== '') {
      let url = override;
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
