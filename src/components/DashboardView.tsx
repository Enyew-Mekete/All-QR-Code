import React, { useState } from 'react';
import {
  QrCode,
  Layers,
  Users,
  BarChart3,
  KeyRound,
  Bell,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import {
  AppUser,
  CustomThemeSetting,
  OTPRecord,
  QRCategory,
  QRScanEvent,
  RestaurantQRCode,
  RoleDefinition,
  SystemSection,
} from '../types';
import { SentNotificationRecord } from '../services/notificationService';

interface DashboardViewProps {
  currentUser: AppUser;
  userRole: RoleDefinition | undefined;
  qrCodes: RestaurantQRCode[];
  categories: QRCategory[];
  users: AppUser[];
  roles: RoleDefinition[];
  otps: OTPRecord[];
  notifications: SentNotificationRecord[];
  scanEvents: QRScanEvent[];
  theme: CustomThemeSetting;
  onNavigate: (section: SystemSection) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  userRole,
  qrCodes,
  categories,
  users,
  roles,
  otps,
  notifications,
  scanEvents,
  theme,
  onNavigate,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const filteredQRs =
    selectedCategoryFilter === 'all'
      ? qrCodes
      : qrCodes.filter((q) => q.categoryId === selectedCategoryFilter);

  const totalScans = filteredQRs.reduce((sum, q) => sum + q.scansCount, 0);
  const expiredOrPausedCount = filteredQRs.filter((q) => q.isExpired || q.status === 'paused').length;
  const welcomeEnabledCount = filteredQRs.filter((q) => q.welcomeScreen?.enabled).length;

  const canAccess = (section: SystemSection) =>
    userRole ? Boolean(userRole.privileges?.[section]?.view) : true;

  const statCards: {
    label: string;
    value: number;
    caption: string;
    icon: React.ComponentType<{ className?: string }>;
    target: SystemSection;
  }[] = [
    {
      label: 'Generated QR Codes',
      value: filteredQRs.length,
      caption: 'Active dynamic codes in selected scope.',
      icon: QrCode,
      target: 'QR Codes',
    },
    {
      label: 'Total Scans Recorded',
      value: totalScans,
      caption: 'Real-time scan counter across devices.',
      icon: BarChart3,
      target: 'Analytics',
    },
    {
      label: 'Categories',
      value: categories.length,
      caption: 'Websites, Telegram, YouTube, Menus & more.',
      icon: Layers,
      target: 'Category Management',
    },
    {
      label: 'Admin Users',
      value: users.length,
      caption: `${roles.length} configured RBAC roles in database.`,
      icon: Users,
      target: 'User Management',
    },
    {
      label: 'Welcome Screens',
      value: welcomeEnabledCount,
      caption: 'Codes with custom splash branding on scan.',
      icon: Sparkles,
      target: 'QR Codes',
    },
    {
      label: 'Expired / Paused QRs',
      value: expiredOrPausedCount,
      caption: 'Codes with elapsed expiry or paused state.',
      icon: Clock,
      target: 'QR Codes',
    },
    {
      label: 'OTP Verifications',
      value: otps.length,
      caption: 'Issued 2FA login & reset codes logged.',
      icon: KeyRound,
      target: 'Reports',
    },
    {
      label: 'Notifications Sent',
      value: notifications.length,
      caption: 'Dispatched via enyewmekete65@gmail.com & SMS.',
      icon: Bell,
      target: 'Reports',
    },
  ];

  const recentEvents = scanEvents.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {currentUser.name} · {userRole?.name || currentUser.role} · Real-time overview of QR Code Generator
        </p>
      </div>

      {/* Category Scope Filter Container (matches reference dashboard layout structure) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <label
          htmlFor="dashboard-category-filter"
          className="block text-xs font-semibold text-slate-600 mb-2"
        >
          Overview Scope
        </label>
        <div className="relative max-w-xs">
          <select
            id="dashboard-category-filter"
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full appearance-none pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
          >
            <option value="all">All categories and destinations</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 8-Card System Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const permitted = canAccess(card.target);

          return (
            <button
              key={card.label}
              type="button"
              disabled={!permitted}
              onClick={() => permitted && onNavigate(card.target)}
              className={`text-left bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs transition-all flex flex-col justify-between ${
                permitted
                  ? 'hover:border-slate-400 hover:shadow-sm cursor-pointer'
                  : 'opacity-80 cursor-default'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">{card.label}</span>
                <span style={{ color: theme.primaryColor }}>
                  <Icon className="w-4 h-4 shrink-0" />
                </span>
              </div>
              <div
                className="text-3xl font-extrabold mt-3 tabular-nums"
                style={{ color: theme.primaryColor }}
              >
                {card.value.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                {card.caption}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Messages & Recent Audit Activity Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Recent Scan & Dispatch Activity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live scan telemetry, OTP audits, and automated Email/SMS logs are stored in Reports.
            </p>
          </div>
          {canAccess('Reports') && (
            <button
              type="button"
              onClick={() => onNavigate('Reports')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              style={{ backgroundColor: theme.primaryColor }}
            >
              <span>View Full Reports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentEvents.length > 0 ? (
          <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
            {recentEvents.map((ev) => (
              <div
                key={ev.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
              >
                <div className="font-semibold text-slate-800 truncate">{ev.qrTitle}</div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                  <span>{ev.device}</span>
                  <span aria-hidden="true">·</span>
                  <span>{ev.city || 'Addis Ababa, ET'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(ev.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 py-4 text-center border-t border-slate-100">
            No scan activity recorded yet.
          </div>
        )}
      </div>
    </div>
  );
};
