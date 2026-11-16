import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  Layers,
  BarChart3,
  Palette,
  ShieldCheck,
  Users,
  FileSpreadsheet,
  Plus,
  LogOut,
  X,
} from 'lucide-react';
import { AppUser, CustomThemeSetting, RoleDefinition, SystemSection } from '../types';
import {
  getContrastTextColor,
  getContrastMutedColor,
  getDistinctCreateQRTheme,
} from '../utils/themeColors';

export type SidebarSection = SystemSection;

interface SidebarProps {
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  onOpenCreateQR: () => void;
  onLogout: () => void;
  currentUser: AppUser;
  userRole: RoleDefinition | undefined;
  theme: CustomThemeSetting;
  qrCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { section: SystemSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { section: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'QR Codes', label: 'QR Codes', icon: QrCode },
  { section: 'Category Management', label: 'Categories', icon: Layers },
  { section: 'Analytics', label: 'Analytics', icon: BarChart3 },
  { section: 'Role Management', label: 'Role Management', icon: ShieldCheck },
  { section: 'User Management', label: 'User Management', icon: Users },
  { section: 'Theme Settings', label: 'Theme Settings', icon: Palette },
  { section: 'Reports', label: 'Reports', icon: FileSpreadsheet },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  onOpenCreateQR,
  onLogout,
  currentUser,
  userRole,
  theme,
  qrCount,
  isMobileOpen,
  onCloseMobile,
}) => {
  const sidebarBg = theme.sidebarColor || '#064e3b';
  const contrastText = getContrastTextColor(sidebarBg);
  const mutedText = getContrastMutedColor(sidebarBg);
  const isLightBg = contrastText === '#0f172a';
  const createBtn = getDistinctCreateQRTheme(theme);

  const canView = (section: SystemSection): boolean => {
    if (!userRole) return section === 'Dashboard' || section === 'QR Codes';
    return Boolean(userRole.privileges?.[section]?.view);
  };

  const canCreateQR = userRole ? Boolean(userRole.privileges?.['QR Codes']?.add) : true;

  const sidebarContent = (
    <div
      className="h-full flex flex-col justify-between select-none transition-colors duration-300"
      style={{ backgroundColor: sidebarBg, color: contrastText }}
    >
      {/* Top Brand + Primary Distinct Action */}
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{
                backgroundColor: isLightBg ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.14)',
                color: contrastText,
              }}
            >
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold tracking-tight truncate leading-tight">
                QR Code
              </div>
              <div className="text-[11px] font-medium truncate" style={{ color: mutedText }}>
                Enyew M. · {userRole?.name || currentUser.role}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg cursor-pointer"
            style={{ color: mutedText }}
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Distinct "Create QR Code" Button Theme */}
        {canCreateQR && (
          <button
            type="button"
            onClick={() => {
              onOpenCreateQR();
              onCloseMobile();
            }}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98] cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: createBtn.bg,
              color: createBtn.text,
            }}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Create QR Code</span>
          </button>
        )}

        {/* Navigation Links */}
        <nav className="space-y-1 pt-1" aria-label="Sidebar Navigation">
          {NAV_ITEMS.filter((item) => canView(item.section)).map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.section;

            return (
              <button
                key={item.section}
                type="button"
                onClick={() => {
                  onSelectSection(item.section);
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: isActive
                    ? isLightBg
                      ? 'rgba(15, 23, 42, 0.12)'
                      : 'rgba(255, 255, 255, 0.16)'
                    : 'transparent',
                  color: isActive ? contrastText : mutedText,
                }}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.section === 'QR Codes' && (
                  <span
                    className="text-[11px] font-mono tabular-nums font-bold"
                    style={{ color: isActive ? contrastText : mutedText }}
                  >
                    {qrCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Logged-In User Footer */}
      <div
        className="p-4 border-t"
        style={{
          borderColor: isLightBg ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)',
        }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0"
              style={{
                backgroundColor: isLightBg ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.18)',
                color: contrastText,
              }}
            >
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{currentUser.name}</div>
              <div className="text-[11px] truncate" style={{ color: mutedText }}>
                {currentUser.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-lg transition-colors cursor-pointer shrink-0"
            style={{ color: mutedText }}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Fixed Desktop & Laptop Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40 shadow-xl">
        {sidebarContent}
      </aside>

      {/* Mobile & Tablet Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
