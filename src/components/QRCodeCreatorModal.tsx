import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRight,
  Upload,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Trash2,
  Smartphone,
  QrCode as QrCodeIcon,
  Download,
  Edit3,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import {
  CustomThemeSetting,
  QRCategory,
  QRDestinationType,
  RestaurantProfile,
  RestaurantQRCode,
  UploadedMenuFile,
} from '../types';
import { getDistinctCreateQRTheme } from '../utils/themeColors';
import { MobileDeviceFrame } from './MobileDeviceFrame';
import { QRScanLandingView } from './QRScanLandingView';
import { QRGeneratorService } from '../services/qrGenerator';
import { UrlResolver } from '../services/urlResolver';
import { INITIAL_RESTAURANT } from '../data/initialData';

interface QRCodeCreatorModalProps {
  categories: QRCategory[];
  defaultCategoryId?: string;
  theme: CustomThemeSetting;
  restaurant?: RestaurantProfile;
  onClose: () => void;
  onCreate: (newQR: Partial<RestaurantQRCode>) => RestaurantQRCode | void;
  onEditCreated?: (qr: RestaurantQRCode) => void;
  onPreviewCreated?: (qr: RestaurantQRCode) => void;
}

const CATEGORY_TO_TYPE: Record<
  string,
  { type: QRDestinationType; placeholder: string; cta: string }
> = {
  cat_website: {
    type: 'website',
    placeholder: 'https://yourcompany.com',
    cta: 'VISIT WEBSITE',
  },
  cat_telegram: {
    type: 'telegram',
    placeholder: 'https://t.me/yourchannel',
    cta: 'JOIN TELEGRAM',
  },
  cat_youtube: {
    type: 'youtube',
    placeholder: 'https://youtube.com/@yourchannel',
    cta: 'WATCH ON YOUTUBE',
  },
  cat_social: {
    type: 'social_media',
    placeholder: 'https://instagram.com/yourhandle',
    cta: 'FOLLOW US',
  },
  cat_business_list: {
    type: 'business_list',
    placeholder: 'https://directory.yourcompany.com',
    cta: 'VIEW BUSINESS',
  },
  cat_restaurant: {
    type: 'restaurant_menu',
    placeholder: 'https://yourmenu.com',
    cta: 'SCAN FOR MENU',
  },
};

export const QRCodeCreatorModal: React.FC<QRCodeCreatorModalProps> = ({
  categories,
  defaultCategoryId,
  theme,
  restaurant,
  onClose,
  onCreate,
  onEditCreated,
  onPreviewCreated,
}) => {
  const initialCatId = defaultCategoryId || categories[0]?.id || 'cat_website';
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCatId);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [ctaLabel, setCtaLabel] = useState<string>('See More');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [hasExpiry, setHasExpiry] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string>('');

  // Uploaded files (Images, PDFs, Menus, Catalogs) for ANY category
  const [uploadedFiles, setUploadedFiles] = useState<UploadedMenuFile[]>([]);

  // Welcome Screen config
  const [welcomeEnabled, setWelcomeEnabled] = useState<boolean>(true);
  const [welcomeLogoUrl, setWelcomeLogoUrl] = useState<string>('');
  const [welcomeHeadline, setWelcomeHeadline] = useState<string>('');
  const [welcomeSubheadline, setWelcomeSubheadline] = useState<string>('');
  const [welcomeButtonText, setWelcomeButtonText] = useState<string>('Continue');

  // QR Center Logo config
  const [logoInCenter, setLogoInCenter] = useState<boolean>(true);
  const [customCenterLogoUrl, setCustomCenterLogoUrl] = useState<string>('');

  // Live Preview controls BEFORE creating/generating
  const [previewTab, setPreviewTab] = useState<'welcome' | 'content' | 'qr'>('welcome');
  const [liveQrImg, setLiveQrImg] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [createdQR, setCreatedQR] = useState<RestaurantQRCode | null>(null);
  const [generatedHdImg, setGeneratedHdImg] = useState<string>('');
  const [copiedScanUrl, setCopiedScanUrl] = useState<boolean>(false);

  const welcomeLogoRef = useRef<HTMLInputElement>(null);
  const centerLogoRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const createBtn = getDistinctCreateQRTheme(theme);

  const selectedCat = categories.find((c) => c.id === selectedCategoryId) || categories[0];
  const presetMeta = CATEGORY_TO_TYPE[selectedCategoryId] || {
    type: 'website' as QRDestinationType,
    placeholder: 'https://example.com',
    cta: 'SCAN ME',
  };

  const handleUploadWelcomeLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = (ev.target?.result as string) || '';
      setWelcomeLogoUrl(url);
      if (welcomeEnabled) setPreviewTab('welcome');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCenterLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = (ev.target?.result as string) || '';
      setCustomCenterLogoUrl(url);
      setLogoInCenter(true);
      setPreviewTab('qr');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const reader = new FileReader();
      reader.onload = (ev) => {
        const resultUrl = (ev.target?.result as string) || '';
        const newFile: UploadedMenuFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: isPdf ? 'pdf' : 'image',
          url: resultUrl,
          sizeFormatted: `${Math.max(0.1, file.size / (1024 * 1024)).toFixed(1)} MB`,
          uploadedAt: new Date().toISOString(),
          caption: file.name.replace(/\.[^/.]+$/, ''),
        };
        setUploadedFiles((prev) => [...prev, newFile]);
        setPreviewTab('content');
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLoadSampleMenu = () => {
    setSelectedCategoryId('cat_restaurant');
    setTitle("Guansa Ma'ed Menu");
    setDescription('GOOD FOOD · GOOD MOOD — Fresh Ingredients, Authentic Flavors');
    setCtaLabel('See More');
    setTargetUrl('https://guansa-maed-mu.vercel.app');
    setWelcomeEnabled(true);
    setWelcomeLogoUrl('/assets/guansa_logo.png');
    setWelcomeHeadline("Guansa Ma'ed");
    setWelcomeSubheadline('GOOD FOOD · GOOD MOOD — Tap below to view our menu');
    setWelcomeButtonText('View Menu');
    setLogoInCenter(true);
    setCustomCenterLogoUrl('/assets/guansa_logo.png');
    setUploadedFiles([
      {
        id: `sample_menu_${Date.now()}`,
        name: 'Guansa Coffee Hub Menu.png',
        type: 'image',
        url: '/assets/guansa_menu_card.png',
        sizeFormatted: '652 × 922 HD',
        uploadedAt: new Date().toISOString(),
        caption: "Guansa Ma'ed Digital Menu",
      },
    ]);
    setPreviewTab('welcome');
  };

  const draftQR: RestaurantQRCode = useMemo(() => {
    const finalTitle = title.trim() || `${selectedCat?.name || 'Dynamic'} QR Code`;
    const finalUrl = targetUrl.trim();
    return {
      id: 'draft_preview',
      restaurantId: restaurant?.id || 'company_qr_01',
      categoryId: selectedCategoryId,
      title: finalTitle,
      description: description.trim() || undefined,
      ctaLabel: ctaLabel.trim() || 'See More',
      type: presetMeta.type,
      targetUrl: finalUrl,
      shortUrl: 'dineqr.io/preview',
      scansCount: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : null,
      styling: {
        fgColor: createBtn.bg,
        bgColor: '#ffffff',
        frameStyle: 'scan-me',
        frameText: presetMeta.cta,
        dotStyle: 'rounded',
        logoInCenter: logoInCenter && Boolean(customCenterLogoUrl || welcomeLogoUrl),
        customLogoUrl: (customCenterLogoUrl || welcomeLogoUrl) || undefined,
        size: 280,
      },
      welcomeScreen: {
        enabled: welcomeEnabled,
        logoUrl: welcomeLogoUrl || undefined,
        headline: welcomeHeadline.trim() || `Welcome to ${finalTitle}`,
        subheadline:
          welcomeSubheadline.trim() ||
          description.trim() ||
          `Connecting you directly to ${selectedCat?.name || 'our digital link'}`,
        bannerColor: createBtn.bg,
        buttonText: welcomeButtonText.trim() || 'Continue',
        displaySeconds: 2,
      },
      uploadedFiles,
    };
  }, [
    title,
    description,
    ctaLabel,
    targetUrl,
    selectedCategoryId,
    selectedCat?.name,
    presetMeta.type,
    presetMeta.cta,
    hasExpiry,
    expiresAt,
    createBtn.bg,
    logoInCenter,
    customCenterLogoUrl,
    welcomeEnabled,
    welcomeLogoUrl,
    welcomeHeadline,
    welcomeSubheadline,
    welcomeButtonText,
    uploadedFiles,
    restaurant?.id,
  ]);

  useEffect(() => {
    const previewUrl = UrlResolver.getScanUrl(draftQR);
    QRGeneratorService.generateBrandedCanvas(previewUrl, draftQR.styling, {
      restaurantName: draftQR.title,
      logoSrc: draftQR.styling.customLogoUrl || draftQR.welcomeScreen?.logoUrl,
    }).then((url) => setLiveQrImg(url));
  }, [draftQR]);

  const normalizeTargetUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const rawUrl = targetUrl.trim();
    if (!rawUrl && uploadedFiles.length === 0) {
      setFormError('Please enter a Destination URL or upload at least one image / PDF file.');
      return;
    }

    if (hasExpiry && !expiresAt) {
      setFormError('Please pick an expiration date or turn off Optional Expiration Date.');
      return;
    }

    const finalTitle = title.trim() || `${selectedCat?.name || 'Dynamic'} QR Code`;
    const finalUrl = rawUrl ? normalizeTargetUrl(rawUrl) : '';

    setIsGenerating(true);
    try {
      const payload: Partial<RestaurantQRCode> = {
        categoryId: selectedCategoryId,
        title: finalTitle,
        description: description.trim() || undefined,
        ctaLabel: ctaLabel.trim() || 'See More',
        type: presetMeta.type,
        targetUrl: finalUrl,
        shortUrl: `qr.enyew.io/${Math.random().toString(36).substring(2, 7)}`,
        expiresAt: hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : null,
        styling: {
          fgColor: createBtn.bg,
          bgColor: '#ffffff',
          frameStyle: 'scan-me',
          frameText: presetMeta.cta,
          dotStyle: 'rounded',
          logoInCenter: logoInCenter && Boolean(customCenterLogoUrl || welcomeLogoUrl),
          customLogoUrl: (customCenterLogoUrl || welcomeLogoUrl) || undefined,
          size: 280,
        },
        welcomeScreen: {
          enabled: welcomeEnabled,
          logoUrl: welcomeLogoUrl || undefined,
          headline: welcomeHeadline.trim() || `Welcome to ${finalTitle}`,
          subheadline:
            welcomeSubheadline.trim() ||
            description.trim() ||
            `Connecting you directly to ${selectedCat?.name || 'our digital link'}`,
          bannerColor: createBtn.bg,
          buttonText: welcomeButtonText.trim() || 'Continue',
          displaySeconds: 2,
        },
        uploadedFiles,
      };

      const persisted = onCreate(payload);
      const resultQR: RestaurantQRCode = persisted || {
        ...draftQR,
        id: `qr_${Date.now()}`,
        title: finalTitle,
        targetUrl: finalUrl,
        styling: payload.styling!,
        welcomeScreen: payload.welcomeScreen,
        uploadedFiles,
      };

      const scanUrl = UrlResolver.getScanUrl(resultQR);
      const hdPng =
        (await QRGeneratorService.generateBrandedCanvas(scanUrl, resultQR.styling, {
          restaurantName: resultQR.title,
          logoSrc: resultQR.styling.customLogoUrl || resultQR.welcomeScreen?.logoUrl,
          highRes: true,
        })) || liveQrImg;

      setGeneratedHdImg(hdPng);
      setCreatedQR(resultQR);

      if (hdPng) {
        QRGeneratorService.downloadImage(
          hdPng,
          `${resultQR.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_qr_hd.png`
        );
      }
    } catch (err) {
      console.error('QR generation failed:', err);
      const reason = err instanceof Error ? err.message : String(err || '');
      setFormError(
        reason
          ? `Could not generate the QR code: ${reason}`
          : 'Could not generate the QR code. Please check your inputs and try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadGeneratedPng = async () => {
    if (!createdQR) return;
    let url = generatedHdImg;
    if (!url) {
      const scanUrl = UrlResolver.getScanUrl(createdQR);
      url = await QRGeneratorService.generateBrandedCanvas(scanUrl, createdQR.styling, {
        restaurantName: createdQR.title,
        logoSrc: createdQR.styling.customLogoUrl || createdQR.welcomeScreen?.logoUrl,
        highRes: true,
      });
      setGeneratedHdImg(url);
    }
    QRGeneratorService.downloadImage(
      url,
      `${createdQR.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_qr_hd.png`
    );
  };

  const handleDownloadGeneratedSvg = async () => {
    if (!createdQR) return;
    const scanUrl = UrlResolver.getScanUrl(createdQR);
    const svg = await QRGeneratorService.generateSvgString(scanUrl, createdQR.styling);
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    QRGeneratorService.downloadImage(
      blobUrl,
      `${createdQR.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_qr.svg`
    );
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  if (createdQR) {
    const generatedScanUrl = UrlResolver.getScanUrl(createdQR);
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-base font-extrabold text-slate-900">QR Code Generated</h2>
                <p className="text-xs text-slate-500">
                  Ready to download, scan, or edit anytime.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-5 text-center">
            <div className="inline-block p-4 bg-white rounded-2xl border border-slate-200 shadow-md">
              {generatedHdImg ? (
                <img
                  src={generatedHdImg}
                  alt={createdQR.title}
                  className="w-60 h-60 object-contain mx-auto"
                />
              ) : (
                <div className="w-60 h-60 bg-slate-100 animate-pulse rounded-xl flex items-center justify-center">
                  <QrCodeIcon className="w-10 h-10 text-slate-300" />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">{createdQR.title}</h3>
              {createdQR.description && (
                <p className="text-xs text-slate-500 mt-0.5">{createdQR.description}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-left">
              <span className="text-[11px] font-mono text-slate-700 truncate">
                {generatedScanUrl}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(generatedScanUrl);
                  setCopiedScanUrl(true);
                  setTimeout(() => setCopiedScanUrl(false), 2000);
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                title="Copy Scan URL"
              >
                {copiedScanUrl ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadGeneratedPng}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download HD PNG</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadGeneratedSvg}
                className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download SVG</span>
              </button>

              {onEditCreated && (
                <button
                  type="button"
                  onClick={() => onEditCreated(createdQR)}
                  className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit QR Code</span>
                </button>
              )}

              {onPreviewCreated ? (
                <button
                  type="button"
                  onClick={() => onPreviewCreated(createdQR)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Preview Scan Screen</span>
                </button>
              ) : (
                <a
                  href={generatedScanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Test Scan Link</span>
                </a>
              )}
            </div>
          </div>

          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <a
              href={generatedScanUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Scan URL</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              style={{ backgroundColor: createBtn.bg, color: createBtn.text }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Create QR Code</h2>
            <p className="text-xs text-slate-500">
              Upload images, PDFs, or menus, configure your welcome screen logo, and preview before generating.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSampleMenu}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap"
            >
              Load Sample Menu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Inputs */}
            <div className="lg:col-span-7 space-y-4 text-xs">
              {/* Category Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    QR Code / Content Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Guansa Ma'ed Menu"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Button Text (CTA)
                  </label>
                  <input
                    type="text"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="See More"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description shown under the title when scanned"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Destination URL {uploadedFiles.length > 0 ? '(Optional when file uploaded)' : ''}
                </label>
                <input
                  type="text"
                  inputMode="url"
                  value={targetUrl}
                  onChange={(e) => {
                    setTargetUrl(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder={presetMeta.placeholder}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                />
              </div>

              {/* Upload Files: Image, PDF, Menu, Flyer (for ANY Category) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold text-slate-800">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Upload File(s): Image, PDF or Menu Sheet</span>
                  </span>
                  <input
                    ref={filesInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => handleUploadFiles(e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => filesInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image / PDF</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Uploaded images or PDFs appear right after the Welcome Screen when scanned (and in the live preview on the right).
                </p>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {file.type === 'pdf' ? (
                            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          ) : (
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">{file.name}</div>
                            <div className="text-[10px] text-slate-400 uppercase">
                              {file.type} · {file.sizeFormatted}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Flexible Welcome Screen Setup */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 font-bold text-slate-800">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Welcome Screen Logo (Shown First on Scan)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={welcomeEnabled}
                    onChange={(e) => setWelcomeEnabled(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </label>

                {welcomeEnabled && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {welcomeLogoUrl ? (
                          <img
                            src={welcomeLogoUrl}
                            alt="Welcome Logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <input
                          ref={welcomeLogoRef}
                          type="file"
                          accept="image/*"
                          onChange={handleUploadWelcomeLogo}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => welcomeLogoRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Welcome Logo</span>
                        </button>
                        <p className="text-[11px] text-slate-500">
                          Shown on the Welcome Screen before opening the menu/file &amp; embedded in QR center.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Welcome Headline
                        </label>
                        <input
                          type="text"
                          value={welcomeHeadline}
                          onChange={(e) => setWelcomeHeadline(e.target.value)}
                          placeholder="Welcome to Our Brand"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Welcome Button Text
                        </label>
                        <input
                          type="text"
                          value={welcomeButtonText}
                          onChange={(e) => setWelcomeButtonText(e.target.value)}
                          placeholder="Continue"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Welcome Message
                      </label>
                      <input
                        type="text"
                        value={welcomeSubheadline}
                        onChange={(e) => setWelcomeSubheadline(e.target.value)}
                        placeholder="Short greeting shown when scanned"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* QR Center Logo Setup */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 font-bold text-slate-800">
                    <ImageIcon className="w-4 h-4 text-slate-700" />
                    <span>Embed Center Logo inside QR</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={logoInCenter}
                    onChange={(e) => setLogoInCenter(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </label>

                {logoInCenter && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {customCenterLogoUrl || welcomeLogoUrl ? (
                        <img
                          src={customCenterLogoUrl || welcomeLogoUrl}
                          alt="Center Logo"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <input
                        ref={centerLogoRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                        onChange={handleUploadCenterLogo}
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => centerLogoRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Center Logo</span>
                        </button>
                        {customCenterLogoUrl && (
                          <button
                            type="button"
                            onClick={() => setCustomCenterLogoUrl('')}
                            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Upload custom logo image (PNG, JPG, SVG) to display in center.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Expiration Date */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 font-bold text-slate-800">
                    <Calendar className="w-4 h-4 text-slate-600" />
                    <span>Optional Expiration Date</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={hasExpiry}
                    onChange={(e) => setHasExpiry(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </label>

                {hasExpiry && (
                  <div>
                    <input
                      type="datetime-local"
                      required={hasExpiry}
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Mobile Preview BEFORE Generating */}
            <div className="lg:col-span-5 lg:sticky lg:top-0">
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Live Preview</span>
                  </div>

                  <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    {welcomeEnabled && (
                      <button
                        type="button"
                        onClick={() => setPreviewTab('welcome')}
                        className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                          previewTab === 'welcome'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Welcome
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewTab('content')}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        previewTab === 'content'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Menu / File
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('qr')}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        previewTab === 'qr'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      QR
                    </button>
                  </div>
                </div>

                {previewTab === 'qr' ? (
                  <div className="h-[540px] bg-white rounded-[30px] border border-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                      {liveQrImg ? (
                        <img
                          src={liveQrImg}
                          alt={draftQR.title}
                          className="w-52 h-52 object-contain"
                        />
                      ) : (
                        <div className="w-52 h-52 bg-slate-100 animate-pulse rounded-xl flex items-center justify-center">
                          <QrCodeIcon className="w-10 h-10 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900">{draftQR.title}</div>
                    <div className="text-[11px] text-slate-500">
                      Preview before generating &amp; downloading
                    </div>
                    <button
                      type="submit"
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isGenerating ? 'Generating...' : 'Create & Download HD PNG'}</span>
                    </button>
                  </div>
                ) : (
                  <MobileDeviceFrame width="100%" height={540} restaurantName={draftQR.title}>
                    <QRScanLandingView
                      qrCode={draftQR}
                      restaurant={restaurant || INITIAL_RESTAURANT}
                      theme={theme}
                      isPreview={true}
                      previewStage={previewTab === 'welcome' && welcomeEnabled ? 'welcome' : 'content'}
                      onPreviewStageChange={(stage) =>
                        setPreviewTab(stage === 'welcome' ? 'welcome' : 'content')
                      }
                    />
                  </MobileDeviceFrame>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {formError ? (
              <div className="text-xs font-semibold text-rose-600">{formError}</div>
            ) : (
              <div className="text-[11px] text-slate-500">
                Generates your live QR code immediately with Download &amp; Edit options.
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGenerating ? 'Generating...' : 'Download HD PNG'}</span>
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
                style={{ backgroundColor: createBtn.bg, color: createBtn.text }}
              >
                <span>{isGenerating ? 'Generating...' : 'Create QR Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
