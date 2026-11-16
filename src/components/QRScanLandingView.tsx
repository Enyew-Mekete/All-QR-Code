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
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import {
  CustomThemeSetting,
  RestaurantProfile,
  RestaurantQRCode,
  UploadedMenuFile,
} from '../types';

interface QRScanLandingViewProps {
  qrCode: RestaurantQRCode | null;
  restaurant: RestaurantProfile;
  theme: CustomThemeSetting;
  isPreview?: boolean;
  /** Optional controlled preview stage for editor/creator simulators */
  previewStage?: 'welcome' | 'content';
  onPreviewStageChange?: (stage: 'welcome' | 'content') => void;
}

export const QRScanLandingView: React.FC<QRScanLandingViewProps> = ({
  qrCode,
  restaurant,
  theme,
  isPreview = false,
  previewStage,
  onPreviewStageChange,
}) => {
  const welcomeEnabled = Boolean(qrCode?.welcomeScreen?.enabled);
  const [internalShowWelcome, setInternalShowWelcome] = useState<boolean>(welcomeEnabled);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // HD Document / Menu Sheet Viewer state
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const showWelcome =
    previewStage !== undefined ? previewStage === 'welcome' : internalShowWelcome;

  const setShowWelcome = (show: boolean) => {
    setInternalShowWelcome(show);
    onPreviewStageChange?.(show ? 'welcome' : 'content');
  };

  useEffect(() => {
    setInternalShowWelcome(Boolean(qrCode?.welcomeScreen?.enabled));
    setActiveDocIndex(0);
  }, [qrCode?.id, qrCode?.welcomeScreen?.enabled]);

  // Resolve active file unconditionally so hooks remain top-level
  const resolvedFiles: UploadedMenuFile[] = qrCode
    ? qrCode.uploadedFiles && qrCode.uploadedFiles.length > 0
      ? qrCode.uploadedFiles
      : qrCode.type === 'restaurant_menu' ||
          qrCode.type === 'table_standee' ||
          qrCode.type === 'business_list'
        ? restaurant.uploadedMenuFiles || []
        : []
    : [];
  const resolvedSafeIndex = Math.min(activeDocIndex, Math.max(0, resolvedFiles.length - 1));
  const resolvedActiveFile = resolvedFiles[resolvedSafeIndex];

  useEffect(() => {
    if (!resolvedActiveFile || resolvedActiveFile.type !== 'pdf') {
      setPdfBlobUrl(null);
      return;
    }
    if (!resolvedActiveFile.url.startsWith('data:application/pdf')) {
      setPdfBlobUrl(resolvedActiveFile.url);
      return;
    }
    try {
      const base64 = resolvedActiveFile.url.split(',')[1];
      const byteChars = atob(base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch {
      setPdfBlobUrl(resolvedActiveFile.url);
    }
  }, [resolvedActiveFile?.id, resolvedActiveFile?.type, resolvedActiveFile?.url]);

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
      </div>
    );
  }

  const accentColor =
    qrCode.welcomeScreen?.bannerColor || qrCode.styling.fgColor || theme.primaryColor;
  const welcomeLogo = qrCode.welcomeScreen?.logoUrl || qrCode.styling.customLogoUrl;

  // Step 1: Welcome Logo Screen — waits for user to press Continue
  if (showWelcome && qrCode.welcomeScreen?.enabled) {
    return (
      <div
        className="min-h-full flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden"
        style={{ backgroundColor: accentColor }}
      >
        <div className="max-w-sm w-full space-y-6 my-auto py-8 animate-in fade-in zoom-in-95">
          {welcomeLogo ? (
            <div className="w-36 h-36 mx-auto rounded-3xl bg-white p-3 shadow-2xl flex items-center justify-center overflow-hidden">
              <img
                src={welcomeLogo}
                alt={qrCode.title}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-24 h-24 mx-auto rounded-3xl bg-white/15 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          )}

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-balance">
              {qrCode.welcomeScreen.headline || `Welcome to ${qrCode.title}`}
            </h1>
            {(qrCode.welcomeScreen.subheadline || qrCode.description) && (
              <p className="text-xs text-white/85 leading-relaxed">
                {qrCode.welcomeScreen.subheadline || qrCode.description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowWelcome(false)}
            className="w-full py-3.5 px-5 bg-white text-slate-900 rounded-full text-sm font-extrabold shadow-lg hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{qrCode.welcomeScreen.buttonText || 'Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const getTypeMeta = () => {
    switch (qrCode.type) {
      case 'telegram':
        return { label: 'Telegram Link', Icon: Send, cta: 'See More' };
      case 'youtube':
        return { label: 'YouTube Video / Channel', Icon: Youtube, cta: 'See More' };
      case 'social_media':
        return { label: 'Social Media Profile', Icon: Share2, cta: 'See More' };
      case 'business_list':
        return { label: 'Business Directory & Listing', Icon: Briefcase, cta: 'See More' };
      case 'restaurant_menu':
      case 'table_standee':
      case 'takeout_express':
        return { label: 'Digital Menu', Icon: UtensilsCrossed, cta: 'See More' };
      default:
        return { label: 'Website & Portal', Icon: Globe, cta: 'See More' };
    }
  };

  const meta = getTypeMeta();
  const TypeIcon = meta.Icon;

  const qrFiles = resolvedFiles;
  const safeIndex = resolvedSafeIndex;
  const activeFile = resolvedActiveFile;

  const displayTitle = qrCode.title || 'QR Content';
  const displayDescription =
    qrCode.description ||
    qrCode.welcomeScreen?.subheadline ||
    '';
  const seeMoreLabel = qrCode.ctaLabel?.trim() || 'See More';
  const hasTargetUrl = Boolean(qrCode.targetUrl && qrCode.targetUrl.trim() !== '');

  const handleCopyTarget = () => {
    if (!hasTargetUrl) return;
    navigator.clipboard?.writeText(qrCode.targetUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleOpenPdfInNewTab = (file: UploadedMenuFile) => {
    try {
      if (file.url.startsWith('data:application/pdf')) {
        const base64 = file.url.split(',')[1];
        const byteChars = atob(base64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      window.open(file.url, '_blank', 'noopener,noreferrer');
    } catch {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSeeMoreClick = () => {
    if (hasTargetUrl) {
      window.open(qrCode.targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (activeFile) {
      if (activeFile.type === 'pdf') {
        handleOpenPdfInNewTab(activeFile);
      } else {
        setLightboxImageUrl(activeFile.url);
        setLightboxZoom(1);
      }
    }
  };

  // Step 2: Top Logo -> Title -> Description -> See More Button -> Uploaded Menu Image / PDF ONLY (nothing after)
  return (
    <div className="min-h-full bg-white flex flex-col">
      {/* Top Logo Header Bar */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-center relative">
        {welcomeLogo ? (
          <img
            src={welcomeLogo}
            alt={displayTitle}
            className="w-8 h-8 object-contain rounded-lg"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <ImageIcon className="w-4 h-4" />
          </div>
        )}
        {isPreview && qrCode.welcomeScreen?.enabled && (
          <button
            type="button"
            onClick={() => setShowWelcome(true)}
            className="absolute right-4 text-[10px] font-semibold text-slate-400 hover:text-slate-900 underline cursor-pointer"
          >
            Welcome
          </button>
        )}
      </div>

      {/* Title, Description & See More Button */}
      <div className="px-5 pt-6 pb-5 max-w-lg w-full mx-auto text-center space-y-3">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight text-balance leading-tight">
          {displayTitle}
        </h1>

        {displayDescription && (
          <p className="text-sm text-slate-600 leading-relaxed text-balance">
            {displayDescription}
          </p>
        )}

        {(hasTargetUrl || qrFiles.length > 0) && (
          <div className="pt-1">
            <button
              type="button"
              onClick={handleSeeMoreClick}
              className="w-full py-3 px-5 bg-slate-950 hover:bg-slate-800 text-white rounded-full text-sm font-bold shadow-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{seeMoreLabel}</span>
            </button>
          </div>
        )}
      </div>

      {/* Uploaded Menu Image or PDF directly next to See More Button — nothing rendered after */}
      <div className="px-4 pb-6 max-w-lg w-full mx-auto">
        {qrFiles.length > 0 && activeFile ? (
          <div className="overflow-hidden">
            {qrFiles.length > 1 && (
              <div className="mb-2 flex items-center justify-between text-xs font-mono text-slate-600">
                <button
                  type="button"
                  disabled={safeIndex === 0}
                  onClick={() => setActiveDocIndex((i) => Math.max(0, i - 1))}
                  className="p-1 rounded-lg border border-slate-200 bg-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold">
                  {safeIndex + 1} / {qrFiles.length}
                </span>
                <button
                  type="button"
                  disabled={safeIndex === qrFiles.length - 1}
                  onClick={() =>
                    setActiveDocIndex((i) => Math.min(qrFiles.length - 1, i + 1))
                  }
                  className="p-1 rounded-lg border border-slate-200 bg-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeFile.type === 'pdf' ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="truncate font-medium text-slate-700">{activeFile.name}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenPdfInNewTab(activeFile)}
                    className="inline-flex items-center gap-1 font-bold text-slate-900 underline shrink-0 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open PDF</span>
                  </button>
                </div>
                <iframe
                  src={pdfBlobUrl || activeFile.url}
                  title={activeFile.name}
                  className="w-full h-[500px] border-0 bg-white block"
                />
              </div>
            ) : (
              <div
                className="cursor-zoom-in"
                onClick={() => {
                  setLightboxImageUrl(activeFile.url);
                  setLightboxZoom(1);
                }}
              >
                <img
                  src={activeFile.url}
                  alt={activeFile.name || displayTitle}
                  className="w-full h-auto object-contain block mx-auto"
                />
              </div>
            )}
          </div>
        ) : (
          /* Fallback Destination Link Card ONLY if no files were uploaded */
          hasTargetUrl && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5 text-left">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <TypeIcon className="w-4 h-4 text-slate-600" />
                <span>{meta.label}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-800 truncate">
                  {qrCode.targetUrl}
                </span>
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
          )
        )}
      </div>

      {/* HD Lightbox Modal when user taps the uploaded image */}
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
              <span className="text-xs font-mono tabular-nums">
                {Math.round(lightboxZoom * 100)}%
              </span>
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
