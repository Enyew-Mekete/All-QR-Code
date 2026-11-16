import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Check,
  Palette,
  Image as ImageIcon,
  Info,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Save,
  Sparkles,
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  ExternalLink,
  Copy,
  Download,
  Calendar,
} from 'lucide-react';
import {
  CustomThemeSetting,
  QRCategory,
  QRFrameStyle,
  RestaurantProfile,
  RestaurantQRCode,
  UploadedMenuFile,
} from '../types';
import { MobileDeviceFrame } from './MobileDeviceFrame';
import { QRScanLandingView } from './QRScanLandingView';
import { QRGeneratorService } from '../services/qrGenerator';
import { UrlResolver } from '../services/urlResolver';

interface QRCodeCustomizerProps {
  qrCode: RestaurantQRCode;
  categories: QRCategory[];
  restaurant: RestaurantProfile;
  theme: CustomThemeSetting;
  onBack: () => void;
  onSave: (updatedQR: RestaurantQRCode, updatedRestaurant: RestaurantProfile) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const QRCodeCustomizer: React.FC<QRCodeCustomizerProps> = ({
  qrCode,
  categories,
  restaurant,
  theme,
  onBack,
  onSave,
  onToast,
}) => {
  // Ensure legacy menu QR codes inherit sample files if they have none yet
  const initialFiles: UploadedMenuFile[] =
    qrCode.uploadedFiles && qrCode.uploadedFiles.length > 0
      ? qrCode.uploadedFiles
      : qrCode.type === 'restaurant_menu' ||
          qrCode.type === 'table_standee' ||
          qrCode.type === 'business_list'
        ? restaurant.uploadedMenuFiles || []
        : [];

  const [currentQR, setCurrentQR] = useState<RestaurantQRCode>({
    ...qrCode,
    uploadedFiles: initialFiles,
  });
  const [currentRestaurant, setCurrentRestaurant] = useState<RestaurantProfile>({ ...restaurant });

  const sheetInputRef = useRef<HTMLInputElement>(null);
  const welcomeLogoInputRef = useRef<HTMLInputElement>(null);
  const qrLogoFileInputRef = useRef<HTMLInputElement>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    sheets: true,
    welcome: true,
    design: true,
  });

  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>('');
  const [activePreviewTab, setActivePreviewTab] = useState<'welcome' | 'content' | 'qr'>(
    qrCode.welcomeScreen?.enabled ? 'welcome' : 'content'
  );

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const colorPresets = [
    { name: 'Emerald Jade', hex: '#059669' },
    { name: 'Obsidian Slate', hex: '#0f172a' },
    { name: 'Nordic Teal', hex: '#0d9488' },
    { name: 'Burnt Coral', hex: '#ea580c' },
    { name: 'Crimson Ruby', hex: '#be123c' },
  ];

  useEffect(() => {
    const scanUrl = UrlResolver.getScanUrl(currentQR);
    QRGeneratorService.generateBrandedCanvas(scanUrl, currentQR.styling, {
      restaurantName: currentQR.title,
      tableLabel: currentQR.tableNumber ? `Table ${currentQR.tableNumber}` : undefined,
      logoSrc: currentQR.styling.customLogoUrl || currentQR.welcomeScreen?.logoUrl,
    }).then((url) => setQrPreviewUrl(url));
  }, [currentQR]);

  const handleWelcomeLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCurrentQR((prev) => ({
        ...prev,
        welcomeScreen: {
          enabled: true,
          ...prev.welcomeScreen,
          logoUrl: dataUrl,
        },
      }));
      setActivePreviewTab('welcome');
    };
    reader.readAsDataURL(file);
  };

  const handleQRMiddleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCurrentQR((prev) => ({
        ...prev,
        styling: {
          ...prev.styling,
          logoInCenter: true,
          customLogoUrl: dataUrl,
        },
      }));
      setActivePreviewTab('qr');
    };
    reader.readAsDataURL(file);
  };

  const handleSheetUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const reader = new FileReader();
      reader.onload = (e) => {
        const resultUrl = e.target?.result as string;
        const newFile: UploadedMenuFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: isPdf ? 'pdf' : 'image',
          url: resultUrl,
          sizeFormatted: `${Math.max(0.1, file.size / (1024 * 1024)).toFixed(1)} MB`,
          uploadedAt: new Date().toISOString(),
          caption: file.name.replace(/\.[^/.]+$/, ''),
        };

        setCurrentQR((prev) => ({
          ...prev,
          uploadedFiles: [...(prev.uploadedFiles || []), newFile],
        }));
        setActivePreviewTab('content');
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveSheet = (id: string) => {
    setCurrentQR((prev) => ({
      ...prev,
      uploadedFiles: (prev.uploadedFiles || []).filter((f) => f.id !== id),
    }));
  };

  const handleUpdateSheetCaption = (id: string, caption: string) => {
    setCurrentQR((prev) => ({
      ...prev,
      uploadedFiles: (prev.uploadedFiles || []).map((f) =>
        f.id === id ? { ...f, caption } : f
      ),
    }));
  };

  const handleDownloadHighRes = async () => {
    onSave(currentQR, currentRestaurant);
    const scanUrl = UrlResolver.getScanUrl(currentQR);
    const hdUrl = await QRGeneratorService.generateBrandedCanvas(scanUrl, currentQR.styling, {
      restaurantName: currentQR.title,
      tableLabel: currentQR.tableNumber ? `Table ${currentQR.tableNumber}` : undefined,
      logoSrc: currentQR.styling.customLogoUrl || currentQR.welcomeScreen?.logoUrl,
      highRes: true,
    });
    QRGeneratorService.downloadImage(
      hdUrl,
      `${currentQR.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_qr_hd.png`
    );
    onToast('Saved & downloaded full-resolution PNG QR code.', 'success');
  };

  const handleDownloadSvg = async () => {
    onSave(currentQR, currentRestaurant);
    const scanUrl = UrlResolver.getScanUrl(currentQR);
    const svg = await QRGeneratorService.generateSvgString(scanUrl, currentQR.styling);
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    QRGeneratorService.downloadImage(
      blobUrl,
      `${currentQR.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_qr.svg`
    );
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    onToast('Saved & downloaded SVG QR code.', 'success');
  };

  const handleSave = () => {
    onSave(currentQR, currentRestaurant);
    onToast(`Saved changes to "${currentQR.title}".`, 'success');
  };

  const scanUrl = UrlResolver.getScanUrl(currentQR);
  const qrFiles = currentQR.uploadedFiles || [];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
            title="Back to All QR Codes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400">QR Code Studio</div>
            <input
              type="text"
              value={currentQR.title}
              onChange={(e) => setCurrentQR({ ...currentQR, title: e.target.value })}
              className="text-lg font-extrabold text-slate-900 tracking-tight bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none w-full"
              placeholder="Name your QR Code"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleDownloadHighRes}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Download HD</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>SVG</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-xs font-bold transition-opacity hover:opacity-90 shadow-sm cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Main Split: Left Config Accordions, Right Live Mobile Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-4">
          {/* 1. Destination, Description, Category & Expiration */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-slate-900 hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex items-center gap-2.5 text-sm">
                <Info className="w-4 h-4 text-slate-700" />
                <span>Title, Description, Destination &amp; Expiration</span>
              </span>
              {openSections.basic ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.basic && (
              <div className="px-5 pb-5 pt-3 space-y-4 border-t border-slate-100 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={currentQR.categoryId || categories[0]?.id}
                      onChange={(e) => setCurrentQR({ ...currentQR, categoryId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={currentQR.status}
                      onChange={(e) =>
                        setCurrentQR({
                          ...currentQR,
                          status: e.target.value as 'active' | 'paused',
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={currentQR.description || ''}
                      onChange={(e) => setCurrentQR({ ...currentQR, description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                      placeholder="Short description shown under the title"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Button Label</label>
                    <input
                      type="text"
                      value={currentQR.ctaLabel || 'See More'}
                      onChange={(e) => setCurrentQR({ ...currentQR, ctaLabel: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                      placeholder="See More"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Destination URL (Optional if Image/PDF uploaded)
                  </label>
                  <input
                    type="url"
                    value={currentQR.targetUrl}
                    onChange={(e) => setCurrentQR({ ...currentQR, targetUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                    placeholder="https://..."
                  />
                </div>

                {/* Optional Expiration Date */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      <span>Expiration Date (Optional)</span>
                    </span>
                    {currentQR.expiresAt && (
                      <button
                        type="button"
                        onClick={() => setCurrentQR({ ...currentQR, expiresAt: null, isExpired: false })}
                        className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Clear Expiry
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={
                      currentQR.expiresAt
                        ? new Date(currentQR.expiresAt).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) =>
                      setCurrentQR({
                        ...currentQR,
                        expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                        isExpired: e.target.value
                          ? new Date(e.target.value).getTime() < Date.now()
                          : false,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Uploaded Files (Images, PDFs, Menus, Catalogs) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('sheets')}
              className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-slate-900 hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex items-center gap-2.5 text-sm">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Uploaded Files (Image, PDF &amp; Menu Sheets)</span>
                {qrFiles.length > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-bold">
                    {qrFiles.length}
                  </span>
                )}
              </span>
              {openSections.sheets ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.sheets && (
              <div className="px-5 pb-5 pt-3 space-y-3 border-t border-slate-100 text-xs">
                <input
                  ref={sheetInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => handleSheetUpload(e.target.files)}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sheetInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Image / PDF File</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Displayed on scan right after the Welcome Screen across all categories.
                  </span>
                </div>

                {qrFiles.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    {qrFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {file.type === 'pdf' ? (
                            <div className="w-11 h-11 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                          ) : (
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <input
                              type="text"
                              value={file.caption || ''}
                              onChange={(e) => handleUpdateSheetCaption(file.id, e.target.value)}
                              placeholder="Caption or title..."
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs"
                            />
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              {file.name} · {file.type.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSheet(file.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Flexible Welcome Screen Builder */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('welcome')}
              className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-slate-900 hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex items-center gap-2.5 text-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Welcome Screen (Logo &amp; Custom Splash)</span>
              </span>
              {openSections.welcome ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.welcome && (
              <div className="px-5 pb-5 pt-3 space-y-4 border-t border-slate-100 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-bold text-slate-800">Enable Welcome Screen on Scan</span>
                  <input
                    type="checkbox"
                    checked={Boolean(currentQR.welcomeScreen?.enabled)}
                    onChange={(e) =>
                      setCurrentQR({
                        ...currentQR,
                        welcomeScreen: {
                          ...currentQR.welcomeScreen,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </label>

                {currentQR.welcomeScreen?.enabled && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-20 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
                        {currentQR.welcomeScreen.logoUrl ? (
                          <img
                            src={currentQR.welcomeScreen.logoUrl}
                            alt="Welcome Screen Logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-300" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          ref={welcomeLogoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleWelcomeLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => welcomeLogoInputRef.current?.click()}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Upload Welcome Image / Logo</span>
                        </button>
                        <p className="text-[11px] text-slate-500">
                          Shown first on scan before displaying the menu or uploaded files.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Headline</label>
                        <input
                          type="text"
                          value={currentQR.welcomeScreen.headline || ''}
                          onChange={(e) =>
                            setCurrentQR({
                              ...currentQR,
                              welcomeScreen: {
                                ...currentQR.welcomeScreen!,
                                headline: e.target.value,
                              },
                            })
                          }
                          placeholder="Welcome!"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Button Label</label>
                        <input
                          type="text"
                          value={currentQR.welcomeScreen.buttonText || ''}
                          onChange={(e) =>
                            setCurrentQR({
                              ...currentQR,
                              welcomeScreen: {
                                ...currentQR.welcomeScreen!,
                                buttonText: e.target.value,
                              },
                            })
                          }
                          placeholder="Continue"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Subheadline</label>
                        <input
                          type="text"
                          value={currentQR.welcomeScreen.subheadline || ''}
                          onChange={(e) =>
                            setCurrentQR({
                              ...currentQR,
                              welcomeScreen: {
                                ...currentQR.welcomeScreen!,
                                subheadline: e.target.value,
                              },
                            })
                          }
                          placeholder="Greeting message..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Banner Color</label>
                        <input
                          type="color"
                          value={currentQR.welcomeScreen.bannerColor || currentQR.styling.fgColor}
                          onChange={(e) =>
                            setCurrentQR({
                              ...currentQR,
                              welcomeScreen: {
                                ...currentQR.welcomeScreen!,
                                bannerColor: e.target.value,
                              },
                            })
                          }
                          className="w-full h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. QR Design & Center Logo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('design')}
              className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-slate-900 hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex items-center gap-2.5 text-sm">
                <Palette className="w-4 h-4 text-slate-700" />
                <span>QR Code Design &amp; Center Logo</span>
              </span>
              {openSections.design ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {openSections.design && (
              <div className="px-5 pb-5 pt-3 space-y-4 border-t border-slate-100 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-2">QR Foreground Color</label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {colorPresets.map((preset) => {
                      const isSelected = currentQR.styling.fgColor === preset.hex;
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() =>
                            setCurrentQR({
                              ...currentQR,
                              styling: { ...currentQR.styling, fgColor: preset.hex },
                            })
                          }
                          className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer ${
                            isSelected ? 'ring-2 ring-offset-2 ring-slate-900' : ''
                          }`}
                          style={{ backgroundColor: preset.hex }}
                          title={preset.name}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}

                    <input
                      type="color"
                      value={currentQR.styling.fgColor}
                      onChange={(e) =>
                        setCurrentQR({
                          ...currentQR,
                          styling: { ...currentQR.styling, fgColor: e.target.value },
                        })
                      }
                      className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                    />
                  </div>
                </div>

                {/* Frame & CTA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Frame Style</label>
                    <select
                      value={currentQR.styling.frameStyle}
                      onChange={(e) =>
                        setCurrentQR({
                          ...currentQR,
                          styling: {
                            ...currentQR.styling,
                            frameStyle: e.target.value as QRFrameStyle,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    >
                      <option value="scan-me">Scan Me Banner</option>
                      <option value="table-card">Framed Card</option>
                      <option value="badge-top">Top Header Frame</option>
                      <option value="none">Clean QR Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Frame Label</label>
                    <input
                      type="text"
                      value={currentQR.styling.frameText}
                      onChange={(e) =>
                        setCurrentQR({
                          ...currentQR,
                          styling: { ...currentQR.styling, frameText: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    />
                  </div>
                </div>

                {/* Center Logo */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-800">Embed Center Logo inside QR</span>
                    <input
                      type="checkbox"
                      checked={currentQR.styling.logoInCenter}
                      onChange={(e) =>
                        setCurrentQR({
                          ...currentQR,
                          styling: { ...currentQR.styling, logoInCenter: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </label>

                  {currentQR.styling.logoInCenter && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {currentQR.styling.customLogoUrl ? (
                          <img
                            src={currentQR.styling.customLogoUrl}
                            alt="Center logo"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <input
                          ref={qrLogoFileInputRef}
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                          onChange={handleQRMiddleLogoUpload}
                          className="hidden"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => qrLogoFileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Center Logo</span>
                          </button>
                          {currentQR.styling.customLogoUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentQR({
                                  ...currentQR,
                                  styling: { ...currentQR.styling, customLogoUrl: undefined },
                                })
                              }
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
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Mobile Simulator (Welcome, Menu/File, and QR Code BEFORE download) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Smartphone className="w-4 h-4 text-slate-700" />
                <span>Live Preview</span>
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                {currentQR.welcomeScreen?.enabled && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('welcome')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      activePreviewTab === 'welcome'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Welcome
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('content')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    activePreviewTab === 'content'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Menu / File
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('qr')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    activePreviewTab === 'qr'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  QR Code
                </button>
              </div>
            </div>

            {activePreviewTab === 'qr' ? (
              <div className="h-[660px] bg-slate-50 rounded-[34px] border border-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200 max-w-xs mx-auto">
                  {qrPreviewUrl ? (
                    <img
                      src={qrPreviewUrl}
                      alt={currentQR.title}
                      className="w-60 h-60 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-60 h-60 bg-slate-100 animate-pulse rounded-xl" />
                  )}
                </div>

                <div className="text-xs font-bold text-slate-800">{currentQR.title}</div>

                <div className="w-full max-w-xs space-y-2">
                  <div className="flex items-center justify-between gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-600 font-mono truncate">{scanUrl}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(scanUrl);
                        onToast('Copied scan URL to clipboard.', 'success');
                      }}
                      className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadHighRes}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download HD</span>
                    </button>
                    <a
                      href={scanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Test Link</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <MobileDeviceFrame width="100%" height={660} restaurantName={currentQR.title}>
                <QRScanLandingView
                  qrCode={currentQR}
                  restaurant={currentRestaurant}
                  theme={theme}
                  isPreview={true}
                  previewStage={
                    activePreviewTab === 'welcome' && currentQR.welcomeScreen?.enabled
                      ? 'welcome'
                      : 'content'
                  }
                  onPreviewStageChange={(stage) =>
                    setActivePreviewTab(stage === 'welcome' ? 'welcome' : 'content')
                  }
                />
              </MobileDeviceFrame>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
