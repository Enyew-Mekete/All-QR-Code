import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Download,
  ExternalLink,
  MoreVertical,
  QrCode,
  Check,
  Copy,
  LayoutGrid,
  List,
  Printer,
  Trash2,
  ChevronDown,
  Smartphone,
  Edit3,
} from 'lucide-react';
import {
  CustomThemeSetting,
  QRCategory,
  RestaurantProfile,
  RestaurantQRCode,
} from '../types';
import { QRGeneratorService } from '../services/qrGenerator';
import { UrlResolver } from '../services/urlResolver';
import { ConfirmModal } from './ConfirmModal';
import { getDistinctCreateQRTheme } from '../utils/themeColors';

interface QRCodeListProps {
  qrCodes: RestaurantQRCode[];
  categories: QRCategory[];
  restaurant: RestaurantProfile;
  theme: CustomThemeSetting;
  onCreateNew: () => void;
  onEdit: (qrCode: RestaurantQRCode) => void;
  onOpenScanPreview: (qrCode: RestaurantQRCode) => void;
  onSoftDelete: (id: string) => void;
  onDuplicate: (qrCode: RestaurantQRCode) => void;
  onPrintTent: (qrCode: RestaurantQRCode) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const QRCodeList: React.FC<QRCodeListProps> = ({
  qrCodes,
  categories,
  restaurant,
  theme,
  onCreateNew,
  onEdit,
  onOpenScanPreview,
  onSoftDelete,
  onDuplicate,
  onPrintTent,
  onToast,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'expired'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'last_created' | 'scans'>('last_created');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [qrThumbs, setQrThumbs] = useState<Record<string, string>>({});
  const [pendingDeleteQR, setPendingDeleteQR] = useState<RestaurantQRCode | null>(null);

  const createBtnTheme = getDistinctCreateQRTheme(theme);

  useEffect(() => {
    qrCodes.forEach((qr) => {
      const scanUrl = UrlResolver.getScanUrl(qr);
      if (qr.styling.logoInCenter || qr.styling.frameStyle !== 'none') {
        QRGeneratorService.generateBrandedCanvas(scanUrl, qr.styling, {
          restaurantName: qr.title,
          tableLabel: qr.tableNumber ? `Table ${qr.tableNumber}` : undefined,
          logoSrc: qr.styling.customLogoUrl || qr.welcomeScreen?.logoUrl,
        }).then((dataUrl) => {
          setQrThumbs((prev) => ({ ...prev, [qr.id]: dataUrl }));
        });
      } else {
        QRGeneratorService.generateBasicDataUrl(scanUrl, qr.styling).then((dataUrl) => {
          setQrThumbs((prev) => ({ ...prev, [qr.id]: dataUrl }));
        });
      }
    });
  }, [qrCodes]);

  const copyScanUrl = (id: string, qr: RestaurantQRCode) => {
    const scanUrl = UrlResolver.getScanUrl(qr);
    navigator.clipboard?.writeText(scanUrl);
    setCopiedId(id);
    onToast('Live scan URL copied to clipboard.', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQR = async (qr: RestaurantQRCode) => {
    const scanUrl = UrlResolver.getScanUrl(qr);
    const brandedUrl = await QRGeneratorService.generateBrandedCanvas(scanUrl, qr.styling, {
      restaurantName: qr.title,
      tableLabel: qr.tableNumber ? `Table ${qr.tableNumber}` : undefined,
      logoSrc: qr.styling.customLogoUrl || qr.welcomeScreen?.logoUrl,
      highRes: true,
    });
    QRGeneratorService.downloadImage(
      brandedUrl,
      `${qr.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_qr_hd.png`
    );
    onToast(`Downloaded HD QR code for "${qr.title}".`, 'success');
  };

  const getCategoryLabel = (categoryId?: string) =>
    categories.find((c) => c.id === categoryId)?.name || 'General';

  const filteredQRCodes = qrCodes
    .filter((qr) => {
      if (statusFilter === 'active' && (qr.status !== 'active' || qr.isExpired)) return false;
      if (statusFilter === 'paused' && qr.status !== 'paused') return false;
      if (statusFilter === 'expired' && !qr.isExpired) return false;
      if (categoryFilter !== 'all' && qr.categoryId !== categoryFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          qr.title.toLowerCase().includes(q) ||
          qr.targetUrl.toLowerCase().includes(q) ||
          qr.shortUrl.toLowerCase().includes(q) ||
          (qr.tableNumber && qr.tableNumber.toString().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'scans') return b.scansCount - a.scansCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalScans = qrCodes.reduce((acc, q) => acc + q.scansCount, 0);
  const activeCount = qrCodes.filter((q) => q.status === 'active' && !q.isExpired).length;

  return (
    <div className="space-y-6">
      {/* Real-time Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Generated QR Codes</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {qrCodes.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Real-time database count</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Total Scans Recorded</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {totalScans.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Live scan counters</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Active Codes</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {activeCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Valid &amp; ready to scan</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Average Scans / Code</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {qrCodes.length > 0 ? Math.round(totalScans / qrCodes.length) : 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Per generated QR code</div>
        </div>
      </div>

      {/* Title & Distinct Create QR Code Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">All QR Codes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, customize, download HD PNGs, and manage expiration dates &amp; welcome screens.
          </p>
        </div>

        {canAdd && (
          <button
            type="button"
            onClick={onCreateNew}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-90 shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
            style={{ backgroundColor: createBtnTheme.bg, color: createBtnTheme.text }}
          >
            <Plus className="w-4 h-4" />
            <span>Create QR Code</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused' | 'expired')}
              className="appearance-none pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Status: All</option>
              <option value="active">Active Only</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Category: All</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'last_created' | 'scans')}
              className="appearance-none pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="last_created">Sort: Last Created</option>
              <option value="scans">Sort: Most Scanned</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or target URL..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>
      </div>

      {/* QR Codes List / Grid */}
      {filteredQRCodes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No QR codes found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Adjust your filter criteria or create a new dynamic QR code.
          </p>
          {canAdd && (
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              style={{ backgroundColor: createBtnTheme.bg, color: createBtnTheme.text }}
            >
              Create New QR Code
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredQRCodes.map((qr) => {
            const scanUrl = UrlResolver.getScanUrl(qr);
            return (
              <div
                key={qr.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative w-18 h-18 bg-white border border-slate-200 rounded-xl p-1.5 shrink-0 flex items-center justify-center group">
                    {qrThumbs[qr.id] ? (
                      <img
                        src={qrThumbs[qr.id]}
                        alt={qr.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QrCode className="w-8 h-8 text-slate-400" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownloadQR(qr)}
                      className="absolute inset-0 bg-slate-900/65 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Download HD PNG"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{qr.title}</h3>

                    {/* Clean unboxed typographic metadata */}
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {getCategoryLabel(qr.categoryId)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(qr.createdAt).toLocaleDateString()}</span>
                      <span aria-hidden="true">·</span>
                      {qr.isExpired ? (
                        <span className="text-rose-600 font-semibold">Expired</span>
                      ) : qr.status === 'paused' ? (
                        <span className="text-amber-700 font-semibold">Paused</span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Active</span>
                      )}
                      {qr.expiresAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            Expires {new Date(qr.expiresAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                      {qr.welcomeScreen?.enabled && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600">Welcome Screen On</span>
                        </>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 mt-1 truncate max-w-lg">
                      {qr.targetUrl
                        ? `Target: ${qr.targetUrl}`
                        : qr.uploadedFiles && qr.uploadedFiles.length > 0
                        ? `Uploaded Files: ${qr.uploadedFiles.map((f) => f.name).join(', ')}`
                        : 'Dynamic QR Content'}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 max-w-xs">
                        <span className="text-[11px] font-mono text-slate-700 truncate" title={scanUrl}>
                          {scanUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyScanUrl(qr.id, qr)}
                          className="p-0.5 text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                          title="Copy Scan URL"
                        >
                          {copiedId === qr.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <a
                        href={scanUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Test Scan URL</span>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Scans</div>
                    <div className="text-base font-extrabold text-slate-900 tabular-nums">
                      {qr.scansCount.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDownloadQR(qr)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      title="Download High-Res PNG"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(qr)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Edit QR Code, Files, Welcome Screen & Design"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenScanPreview(qr)}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Preview Scan Landing & Welcome Screen"
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onPrintTent(qr)}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Print Standee / Poster"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === qr.id ? null : qr.id)}
                        className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === qr.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                onEdit(qr);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-800 font-semibold hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit QR Code</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadQR(qr);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download High-Res PNG</span>
                          </button>
                          {canAdd && (
                            <button
                              type="button"
                              onClick={() => {
                                onDuplicate(qr);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Duplicate QR Code</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onPrintTent(qr);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Standee</span>
                          </button>
                          {canDelete && (
                            <>
                              <div className="border-t border-slate-100 my-1" />
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingDeleteQR(qr);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Soft Delete Code</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQRCodes.map((qr) => (
            <div
              key={qr.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="relative w-full aspect-square max-w-[180px] mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-center mb-4 group">
                  {qrThumbs[qr.id] ? (
                    <img
                      src={qrThumbs[qr.id]}
                      alt={qr.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <QrCode className="w-16 h-16 text-slate-300" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownloadQR(qr)}
                    className="absolute inset-0 bg-slate-900/65 text-white rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-bold text-xs gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download HD</span>
                  </button>
                </div>

                <h3 className="text-sm font-bold text-slate-900 text-center truncate">{qr.title}</h3>
                <div className="text-[11px] text-slate-500 text-center mt-0.5 truncate">
                  {getCategoryLabel(qr.categoryId)} · {qr.isExpired ? 'Expired' : qr.status}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-900 tabular-nums">
                  {qr.scansCount.toLocaleString()} scans
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadQR(qr)}
                    className="p-1.5 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="Download HD PNG"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenScanPreview(qr)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="Preview Scan View"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(qr)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer"
                      title="Edit QR Code"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteQR(qr)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Soft Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(pendingDeleteQR)}
        title="Soft Delete QR Code"
        message={`Are you sure you want to soft delete "${pendingDeleteQR?.title}"? Scanning it will pause until restored from Reports.`}
        confirmLabel="Soft Delete Code"
        onConfirm={() => {
          if (pendingDeleteQR) {
            onSoftDelete(pendingDeleteQR.id);
            setPendingDeleteQR(null);
          }
        }}
        onCancel={() => setPendingDeleteQR(null)}
      />
    </div>
  );
};
