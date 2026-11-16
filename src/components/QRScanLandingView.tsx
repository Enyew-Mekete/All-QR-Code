import React, { useState, useEffect } from 'react';
import {
  Globe,
  Send,
  Youtube,
  Share2,
  Briefcase,
  UtensilsCrossed,
  ExternalLink,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { CustomThemeSetting, RestaurantProfile, RestaurantQRCode } from '../types';

interface QRScanLandingViewProps {
  qrCode: RestaurantQRCode | null;
  restaurant: RestaurantProfile;
  theme: CustomThemeSetting;
  isPreview?: boolean;
}

export const QRScanLandingView: React.FC<QRScanLandingViewProps> = ({
  qrCode,
  restaurant,
  theme,
  isPreview = false,
}) => {
  const welcomeEnabled = Boolean(qrCode?.welcomeScreen?.enabled);
  const [showWelcome, setShowWelcome] = useState<boolean>(welcomeEnabled);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // HD Document / Menu Sheet Viewer state
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  useEffect(() => {
    setShowWelcome(Boolean(qrCode?.welcomeScreen?.enabled));
  }, [qrCode?.id, qrCode?.welcomeScreen?.enabled]);

  if (!qrCode) {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full shadow-sm space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-lg font-extrabold text-slate-900">QR Code Not Found</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            This QR code may have been deactivated or soft-deleted by an administrator.
          </p>
        </div>
        <div className="mt-6 text-[11px] text-slate-400 font-medium">
          Powered By <strong className="text-slate-700 font-bold">Enyew M.</strong>
        </div>
      </div>
    );
  }

  const isExpired =
    Boolean(qrCode.isExpired) ||
    (Boolean(qrCode.expiresAt) && new Date(qrCode.expiresAt as string).getTime() < Date.now());

  if (isExpired || qrCode.status === 'paused') {
    return (
      <div className="min-h-full bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">
            {isExpired ? 'This QR Code Has Expired' : 'QR Code Temporarily Paused'}
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isExpired && qrCode.expiresAt
              ? `Expiration date reached on ${new Date(qrCode.expiresAt).toLocaleString()}.`
              : 'This QR code is currently paused by the administrator.'}
          </p>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            {qrCode.title}
          </div>
        </div>
        <div className="mt-6 text-[11px] text-slate-400 font-medium">
          Powered By <strong className="text-slate-700 font-bold">Enyew M.</strong>
        </div>
      </div>
    );
  }

  const accentColor = qrCode.welcomeScreen?.bannerColor || qrCode.styling.fgColor || theme.primaryColor;
  const welcomeLogo = qrCode.welcomeScreen?.logoUrl || qrCode.styling.customLogoUrl;

  // Flexible Welcome Screen before showing destination
  if (showWelcome && qrCode.welcomeScreen?.enabled) {
    return (
      <div
        className="min-h-full flex flex-col items-center justify-between p-6 text-center text-white relative overflow-hidden"
        style={{ backgroundColor: accentColor }}
      >
        <div className="w-full flex justify-end">
          {isPreview && (
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              className="text-[11px] font-semibold text-white/80 hover:text-white underline cursor-pointer"
            >
              Skip preview
            </button>
          )}
        </div>

        <div className="max-w-sm w-full space-y-5 my-auto py-8 animate-in fade-in zoom-in-95">
          {welcomeLogo ? (
            <div className="w-32 h-32 mx-auto rounded-2xl bg-white p-2 shadow-xl flex items-center justify-center overflow-hidden">
              <img
                src={welcomeLogo}
                alt={qrCode.title}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto rounded-2xl bg-white/15 flex items-center justify-center">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
          )}

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-balance">
              {qrCode.welcomeScreen.headline || `Welcome to ${qrCode.title}`}
            </h1>
            <p className="text-xs text-white/85 leading-relaxed">
              {qrCode.welcomeScreen.subheadline || 'Tap below to open your destination immediately.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowWelcome(false)}
            className="w-full py-3 px-5 bg-white text-slate-900 rounded-xl text-xs font-extrabold shadow-lg hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{qrCode.welcomeScreen.buttonText || 'Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-white/75 font-medium">
          Powered By <strong className="text-white font-bold">Enyew M.</strong>
        </div>
      </div>
    );
  }

  const getTypeMeta = () => {
    switch (qrCode.type) {
      case 'telegram':
        return { label: 'Telegram Link', Icon: Send, cta: 'Open in Telegram' };
      case 'youtube':
        return { label: 'YouTube Video / Channel', Icon: Youtube, cta: 'Watch on YouTube' };
      case 'social_media':
        return { label: 'Social Media Profile', Icon: Share2, cta: 'Visit Social Profile' };
      case 'business_list':
        return { label: 'Business Directory & Listing', Icon: Briefcase, cta: 'View Business Listing' };
      case 'restaurant_menu':
      case 'table_standee':
      case 'takeout_express':
        return { label: 'Digital Menu', Icon: UtensilsCrossed, cta: 'Open Destination Link' };
      default:
        return { label: 'Website & Portal', Icon: Globe, cta: 'Open Website' };
    }
  };

  const meta = getTypeMeta();
  const TypeIcon = meta.Icon;

  const isMenuOrDocType =
    (qrCode.type === 'restaurant_menu' ||
      qrCode.type === 'table_standee' ||
      qrCode.type === 'business_list') &&
    restaurant.uploadedMenuFiles &&
    restaurant.uploadedMenuFiles.length > 0;

  const handleCopyTarget = () => {
    navigator.clipboard?.writeText(qrCode.targetUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadHD = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-full bg-[#f1f5f9] flex flex-col justify-between pb-8">
      <div>
        {/* Dynamic Branded Header */}
        <div
          className="px-5 pt-6 pb-10 text-white text-center relative"
          style={{ backgroundColor: accentColor }}
        >
          {qrCode.welcomeScreen?.enabled && (
            <button
              type="button"
              onClick={() => setShowWelcome(true)}
              className="text-[11px] font-semibold text-white/80 hover:text-white underline mb-2 cursor-pointer"
            >
              Replay Welcome Screen
            </button>
          )}

          <div className="w-14 h-14 rounded-2xl bg-white/15 mx-auto flex items-center justify-center mb-3 overflow-hidden">
            {welcomeLogo ? (
              <img src={welcomeLogo} alt={qrCode.title} className="w-full h-full object-contain bg-white p-1" />
            ) : (
              <TypeIcon className="w-7 h-7 text-white" />
            )}
          </div>

          <div className="text-[11px] font-semibold text-white/80">{meta.label}</div>
          <h1 className="text-xl font-extrabold tracking-tight mt-0.5 text-balance">
            {qrCode.title}
          </h1>
          {qrCode.expiresAt && (
            <div className="text-[11px] text-white/75 mt-1 font-mono tabular-nums">
              Valid until {new Date(qrCode.expiresAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Main Destination Card */}
        <div className="px-4 -mt-5 max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 space-y-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-500">Destination URL</div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-800 truncate">{qrCode.targetUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyTarget}
                  className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                  title="Copy destination link"
                >
                  {copiedUrl ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <a
              href={qrCode.targetUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              <span>{meta.cta}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* High-Resolution Uploaded Sheet Viewer (Zero Quality Loss) */}
          {isMenuOrDocType && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">
                  {restaurant.uploadedMenuFiles[activeDocIndex]?.caption || 'HD Sheet'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = restaurant.uploadedMenuFiles[activeDocIndex]?.url;
                      if (url) {
                        setLightboxImageUrl(url);
                        setLightboxZoom(1);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>HD Zoom</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const file = restaurant.uploadedMenuFiles[activeDocIndex];
                      if (file) handleDownloadHD(file.url, file.name || 'document.png');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save HD</span>
                  </button>
                </div>
              </div>

              <div className="bg-white">
                <img
                  src={restaurant.uploadedMenuFiles[activeDocIndex]?.url}
                  alt={restaurant.uploadedMenuFiles[activeDocIndex]?.name || 'HD Sheet'}
                  className="w-full h-auto object-contain block"
                />
              </div>

              {restaurant.uploadedMenuFiles.length > 1 && (
                <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                  <button
                    type="button"
                    disabled={activeDocIndex === 0}
                    onClick={() => setActiveDocIndex((i) => Math.max(0, i - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>
                    {activeDocIndex + 1} / {restaurant.uploadedMenuFiles.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeDocIndex === restaurant.uploadedMenuFiles.length - 1}
                    onClick={() =>
                      setActiveDocIndex((i) =>
                        Math.min(restaurant.uploadedMenuFiles.length - 1, i + 1)
                      )
                    }
                    className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Attribution */}
      <div className="pt-8 text-center text-[11px] text-slate-500 font-medium">
        Powered By <strong className="font-bold text-slate-800">Enyew M.</strong>
      </div>

      {/* HD Lightbox Modal */}
      {lightboxImageUrl && (
        <div className="fixed inset-0 z-[120] bg-black/90 flex flex-col">
          <div className="p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(1, z - 0.5))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono tabular-nums">{Math.round(lightboxZoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(3, z + 0.5))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img
              src={lightboxImageUrl}
              alt="Full HD Document"
              className="max-w-full max-h-full object-contain transition-transform"
              style={{ transform: `scale(${lightboxZoom})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
