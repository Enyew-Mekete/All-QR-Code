import React, { useEffect, useState } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { RestaurantQRCode, RestaurantProfile } from '../types';
import { QRGeneratorService } from '../services/qrGenerator';
import { UrlResolver } from '../services/urlResolver';

interface PrintTableTentModalProps {
  qrCode: RestaurantQRCode;
  restaurant: RestaurantProfile;
  onClose: () => void;
}

export const PrintTableTentModal: React.FC<PrintTableTentModalProps> = ({
  qrCode,
  restaurant,
  onClose,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const scanUrl = UrlResolver.getScanUrl(qrCode);
    QRGeneratorService.generateBrandedCanvas(scanUrl, qrCode.styling, {
      restaurantName: qrCode.title,
      tableLabel: qrCode.tableNumber ? `Table ${qrCode.tableNumber}` : undefined,
      logoSrc: qrCode.styling.customLogoUrl || qrCode.welcomeScreen?.logoUrl,
    }).then((url) => {
      setQrDataUrl(url);
    });
  }, [qrCode]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const scanUrl = UrlResolver.getScanUrl(qrCode);
    const hdUrl = await QRGeneratorService.generateBrandedCanvas(scanUrl, qrCode.styling, {
      restaurantName: qrCode.title,
      tableLabel: qrCode.tableNumber ? `Table ${qrCode.tableNumber}` : undefined,
      logoSrc: qrCode.styling.customLogoUrl || qrCode.welcomeScreen?.logoUrl,
      highRes: true,
    });
    QRGeneratorService.downloadImage(
      hdUrl || qrDataUrl,
      `${qrCode.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_standee_hd.png`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Printable QR Standee</h3>
            <p className="text-xs text-slate-500">
              High-resolution printable display card for {qrCode.title}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download HD PNG</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-100 overflow-y-auto max-h-[70vh] flex justify-center">
          <div
            id="printable-qr-standee"
            className="w-full max-w-md bg-white border border-slate-300 shadow-md p-6 rounded-2xl flex flex-col items-center text-center relative"
          >
            <div className="w-full border-b border-dashed border-slate-300 pb-2 mb-4 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Fold along dashed line for tabletop display
            </div>

            <div className="mb-3">
              {(qrCode.welcomeScreen?.logoUrl || restaurant.logoUrl) && (
                <img
                  src={qrCode.welcomeScreen?.logoUrl || restaurant.logoUrl}
                  alt={qrCode.title}
                  className="w-14 h-14 object-contain mx-auto mb-1.5"
                />
              )}
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {qrCode.title}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-xs mx-auto">
                {qrCode.targetUrl}
              </p>
            </div>

            <div className="p-3 bg-white rounded-2xl border-2 border-slate-900/10 shadow-sm my-2">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={qrCode.title} className="w-56 h-56 object-contain" />
              ) : (
                <div className="w-56 h-56 bg-slate-100 animate-pulse rounded-xl" />
              )}
            </div>

            <div className="mt-3 space-y-1">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Scan with your smartphone camera
              </h4>
              {qrCode.expiresAt && (
                <p className="text-xs text-slate-500">
                  Valid until {new Date(qrCode.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="mt-5 text-[10px] text-slate-500">
              Powered By <strong className="font-semibold text-slate-800">Enyew M.</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
