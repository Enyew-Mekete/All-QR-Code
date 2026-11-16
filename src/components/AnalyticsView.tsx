import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  QrCode,
  Smartphone,
  Clock,
  ExternalLink,
  Search,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  CustomThemeSetting,
  QRCategory,
  QRScanEvent,
  RestaurantQRCode,
} from '../types';

interface AnalyticsViewProps {
  qrCodes: RestaurantQRCode[];
  categories: QRCategory[];
  scanEvents: QRScanEvent[];
  theme: CustomThemeSetting;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  qrCodes,
  categories,
  scanEvents,
  theme,
}) => {
  const [selectedQRId, setSelectedQRId] = useState<string>(qrCodes[0]?.id || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return qrCodes;
    return qrCodes.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.targetUrl.toLowerCase().includes(q)
    );
  }, [qrCodes, searchQuery]);

  const selectedQR =
    selectedQRId === 'all' ? null : qrCodes.find((q) => q.id === selectedQRId) || null;

  const totalSystemScans = qrCodes.reduce((sum, q) => sum + q.scansCount, 0);

  const scopedScansCount = selectedQR ? selectedQR.scansCount : totalSystemScans;
  const scopedEvents = useMemo(() => {
    if (!selectedQR) return scanEvents;
    return scanEvents.filter((e) => e.qrId === selectedQR.id);
  }, [selectedQR, scanEvents]);

  const deviceBreakdown = useMemo(() => {
    const counts: Record<string, number> = { iOS: 0, Android: 0, Desktop: 0, Tablet: 0 };
    scopedEvents.forEach((ev) => {
      if (ev.device.toLowerCase().includes('ios') || ev.device.toLowerCase().includes('iphone')) {
        counts.iOS += 1;
      } else if (ev.device.toLowerCase().includes('android')) {
        counts.Android += 1;
      } else if (ev.device.toLowerCase().includes('tablet') || ev.device.toLowerCase().includes('ipad')) {
        counts.Tablet += 1;
      } else {
        counts.Desktop += 1;
      }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  }, [scopedEvents]);

  const categoryName = (catId?: string) =>
    categories.find((c) => c.id === catId)?.name || 'General';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-slate-800" />
          <span>QR Code Real-Time Analytics</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Select any generated QR code from the directory to inspect its live scan performance, device breakdown, and expiration telemetry.
        </p>
      </div>

      {/* 2-Column Interactive Layout: Left QR Selector List, Right Selected QR Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Generated QR Codes Selector */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Select QR Code ({qrCodes.length})
            </h2>
            <button
              type="button"
              onClick={() => setSelectedQRId('all')}
              className={`text-xs font-semibold cursor-pointer ${
                selectedQRId === 'all' ? 'text-slate-900 underline' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Codes
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter generated QR codes..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
            {filteredList.map((qr) => {
              const isSelected = selectedQRId === qr.id;
              return (
                <button
                  key={qr.id}
                  type="button"
                  onClick={() => setSelectedQRId(qr.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{qr.title}</div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {categoryName(qr.categoryId)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold tabular-nums">
                      {qr.scansCount.toLocaleString()}
                    </div>
                    <div
                      className={`text-[10px] ${
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      scans
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredList.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                No matching QR codes.
              </div>
            )}
          </div>
        </div>

        {/* Right: Real-Time Metrics Panel */}
        <div className="lg:col-span-8 space-y-5">
          {/* Selected Subject Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500">
                {selectedQR ? categoryName(selectedQR.categoryId) : 'Aggregate System Telemetry'}
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 truncate mt-0.5">
                {selectedQR ? selectedQR.title : `All ${qrCodes.length} Generated QR Codes`}
              </h2>
              {selectedQR && (
                <a
                  href={selectedQR.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono text-slate-600 hover:text-slate-900 mt-1 truncate max-w-full"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{selectedQR.targetUrl}</span>
                </a>
              )}
            </div>

            {selectedQR && (
              <div className="text-xs font-bold shrink-0">
                {selectedQR.isExpired ? (
                  <span className="text-rose-600">Expired</span>
                ) : selectedQR.status === 'paused' ? (
                  <span className="text-amber-600">Paused</span>
                ) : (
                  <span className="text-emerald-700">Active & Live</span>
                )}
              </div>
            )}
          </div>

          {/* 4-Card Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Total Scans</span>
                <QrCode className="w-4 h-4" style={{ color: theme.primaryColor }} />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2 tabular-nums">
                {scopedScansCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {selectedQR && totalSystemScans > 0
                  ? `${Math.round((selectedQR.scansCount / totalSystemScans) * 100)}% of total traffic`
                  : 'Across all active codes'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Logged Events</span>
                <Smartphone className="w-4 h-4" style={{ color: theme.primaryColor }} />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2 tabular-nums">
                {scopedEvents.length.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Real-time scan hits</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Last Scan</span>
                <Clock className="w-4 h-4" style={{ color: theme.primaryColor }} />
              </div>
              <div className="text-sm font-bold text-slate-900 mt-2 tabular-nums">
                {selectedQR?.lastScanAt
                  ? new Date(selectedQR.lastScanAt).toLocaleDateString()
                  : scopedEvents[0]
                  ? new Date(scopedEvents[0].timestamp).toLocaleDateString()
                  : 'No scans yet'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {selectedQR?.lastScanAt
                  ? new Date(selectedQR.lastScanAt).toLocaleTimeString()
                  : 'Real-time synced'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{selectedQR ? 'Expiration' : 'Welcome Screens'}</span>
                {selectedQR ? (
                  <Calendar className="w-4 h-4" style={{ color: theme.primaryColor }} />
                ) : (
                  <Sparkles className="w-4 h-4" style={{ color: theme.primaryColor }} />
                )}
              </div>
              <div className="text-sm font-bold text-slate-900 mt-2 tabular-nums">
                {selectedQR
                  ? selectedQR.expiresAt
                    ? new Date(selectedQR.expiresAt).toLocaleDateString()
                    : 'No Expiry'
                  : qrCodes.filter((q) => q.welcomeScreen?.enabled).length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {selectedQR
                  ? selectedQR.welcomeScreen?.enabled
                    ? 'Welcome Screen On'
                    : 'Direct Launch'
                  : 'Active splash pages'}
              </div>
            </div>
          </div>

          {/* Device Distribution & Scan Comparison Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Device Breakdown</h3>
              {deviceBreakdown.total === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Scan this QR code to capture device metrics.
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(deviceBreakdown.counts).map(([device, count]) => {
                    const pct =
                      deviceBreakdown.total > 0
                        ? Math.round((count / deviceBreakdown.total) * 100)
                        : 0;
                    return (
                      <div key={device} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span>{device}</span>
                          <span className="tabular-nums text-slate-500">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: theme.primaryColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Recent Scan Events</h3>
              {scopedEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No scan events recorded for this selection yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {scopedEvents.slice(0, 8).map((ev) => (
                    <div key={ev.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{ev.device}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {ev.city || 'Addis Ababa, ET'}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                        {new Date(ev.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
