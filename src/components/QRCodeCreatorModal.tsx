import React, { useState, useRef } from 'react';
import {
  X,
  ArrowRight,
  Upload,
  Calendar,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import {
  CustomThemeSetting,
  QRCategory,
  QRDestinationType,
  RestaurantQRCode,
} from '../types';
import { getDistinctCreateQRTheme } from '../utils/themeColors';

interface QRCodeCreatorModalProps {
  categories: QRCategory[];
  defaultCategoryId?: string;
  theme: CustomThemeSetting;
  onClose: () => void;
  onCreate: (newQR: Partial<RestaurantQRCode>) => void;
}

const CATEGORY_TO_TYPE: Record<string, { type: QRDestinationType; placeholder: string; cta: string }> = {
  cat_website: { type: 'website', placeholder: 'https://yourcompany.com', cta: 'VISIT WEBSITE' },
  cat_telegram: { type: 'telegram', placeholder: 'https://t.me/yourchannel', cta: 'JOIN TELEGRAM' },
  cat_youtube: { type: 'youtube', placeholder: 'https://youtube.com/@yourchannel', cta: 'WATCH ON YOUTUBE' },
  cat_social: { type: 'social_media', placeholder: 'https://instagram.com/yourhandle', cta: 'FOLLOW US' },
  cat_business_list: { type: 'business_list', placeholder: 'https://directory.yourcompany.com', cta: 'VIEW BUSINESS' },
  cat_restaurant: { type: 'restaurant_menu', placeholder: 'https://yourmenu.com', cta: 'SCAN FOR MENU' },
};

export const QRCodeCreatorModal: React.FC<QRCodeCreatorModalProps> = ({
  categories,
  defaultCategoryId,
  theme,
  onClose,
  onCreate,
}) => {
  const initialCatId = defaultCategoryId || categories[0]?.id || 'cat_website';
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCatId);
  const [title, setTitle] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [hasExpiry, setHasExpiry] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string>('');

  // Welcome Screen config
  const [welcomeEnabled, setWelcomeEnabled] = useState<boolean>(true);
  const [welcomeLogoUrl, setWelcomeLogoUrl] = useState<string>('');
  const [welcomeHeadline, setWelcomeHeadline] = useState<string>('');
  const [welcomeSubheadline, setWelcomeSubheadline] = useState<string>('');
  const [welcomeButtonText, setWelcomeButtonText] = useState<string>('Continue');

  const welcomeLogoRef = useRef<HTMLInputElement>(null);
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
      setWelcomeLogoUrl((ev.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || `${selectedCat?.name || 'Dynamic'} QR Code`;
    const finalUrl = targetUrl.trim() || presetMeta.placeholder;

    onCreate({
      categoryId: selectedCategoryId,
      title: finalTitle,
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
        logoInCenter: Boolean(welcomeLogoUrl),
        customLogoUrl: welcomeLogoUrl || undefined,
        size: 280,
      },
      welcomeScreen: {
        enabled: welcomeEnabled,
        logoUrl: welcomeLogoUrl || undefined,
        headline: welcomeHeadline.trim() || `Welcome to ${finalTitle}`,
        subheadline:
          welcomeSubheadline.trim() ||
          `Connecting you directly to ${selectedCat?.name || 'our digital link'}`,
        bannerColor: createBtn.bg,
        buttonText: welcomeButtonText.trim() || 'Continue',
        displaySeconds: 3,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Create QR Code</h2>
            <p className="text-xs text-slate-500">
              Supports Websites, Telegram, YouTube, Social Media, Business Listings &amp; Menus.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto text-xs">
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

            {/* Title & Target URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">QR Code Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Official Telegram Channel"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Destination URL</label>
                <input
                  type="url"
                  required
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder={presetMeta.placeholder}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                />
              </div>
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
                  <p className="text-[11px] text-slate-500 mt-1">
                    After this date and time, scanning the QR code will show an expiration notice.
                  </p>
                </div>
              )}
            </div>

            {/* Flexible Welcome Screen Setup */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2 font-bold text-slate-800">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Welcome Screen on Scan</span>
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
                    <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {welcomeLogoUrl ? (
                        <img
                          src={welcomeLogoUrl}
                          alt="Welcome Logo"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-300" />
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
                        <span>Upload Logo / Image</span>
                      </button>
                      <p className="text-[11px] text-slate-500">
                        Displayed on the Welcome Screen &amp; QR center in full quality.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Welcome Headline</label>
                      <input
                        type="text"
                        value={welcomeHeadline}
                        onChange={(e) => setWelcomeHeadline(e.target.value)}
                        placeholder="Welcome to Our Brand"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Button Text</label>
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
                    <label className="block font-semibold text-slate-700 mb-1">Welcome Message</label>
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
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ backgroundColor: createBtn.bg, color: createBtn.text }}
            >
              <span>Create QR Code</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
