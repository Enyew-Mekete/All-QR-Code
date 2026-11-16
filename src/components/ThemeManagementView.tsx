import React, { useState } from 'react';
import { Palette, Check, RefreshCw, Plus, QrCode, ShieldCheck } from 'lucide-react';
import { CustomThemeSetting } from '../types';
import { StorageService } from '../services/storage';
import {
  getContrastTextColor,
  getContrastMutedColor,
  getDistinctCreateQRTheme,
} from '../utils/themeColors';

interface ThemeManagementViewProps {
  currentTheme: CustomThemeSetting;
  onApplyTheme: (theme: CustomThemeSetting) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  canEdit: boolean;
}

export const ThemeManagementView: React.FC<ThemeManagementViewProps> = ({
  currentTheme,
  onApplyTheme,
  onToast,
  canEdit,
}) => {
  const presets = StorageService.getAvailableThemes();
  const [draft, setDraft] = useState<CustomThemeSetting>(currentTheme);

  const handleSelectPreset = (preset: CustomThemeSetting) => {
    const contrast = getContrastTextColor(preset.sidebarColor);
    const updated: CustomThemeSetting = {
      ...preset,
      sidebarContrastText: contrast,
    };
    setDraft(updated);
    if (canEdit) {
      onApplyTheme(updated);
      onToast(`Theme "${updated.name}" applied to Sidebar & Login Header.`, 'success');
    }
  };

  const handleCustomColorChange = (field: 'sidebarColor' | 'primaryColor', hex: string) => {
    const nextSidebar = field === 'sidebarColor' ? hex : draft.sidebarColor;
    const nextPrimary = field === 'primaryColor' ? hex : draft.primaryColor;
    const contrast = getContrastTextColor(nextSidebar);

    const updated: CustomThemeSetting = {
      id: 'custom_theme',
      name: 'Custom Brand Theme',
      sidebarColor: nextSidebar,
      primaryColor: nextPrimary,
      sidebarContrastText: contrast,
      isDark: contrast === '#ffffff',
    };
    setDraft(updated);
  };

  const handleSaveCustom = () => {
    if (!canEdit) return;
    onApplyTheme(draft);
    onToast('Custom Sidebar & Login Header theme saved.', 'success');
  };

  const handleResetDefault = () => {
    const def = presets[0];
    setDraft(def);
    if (canEdit) {
      onApplyTheme(def);
      onToast(`Reset to default theme "${def.name}".`, 'info');
    }
  };

  const previewContrast = getContrastTextColor(draft.sidebarColor);
  const previewMuted = getContrastMutedColor(draft.sidebarColor);
  const createBtn = getDistinctCreateQRTheme(draft);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Palette className="w-6 h-6 text-slate-800" />
            <span>Theme Settings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecting a theme automatically updates the Login Page header/backdrop and Fixed Sidebar with automatic contrast text. The Create QR Code action keeps a distinct color.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>
        )}
      </div>

      {/* Live Preview: Sidebar + Login Header + Distinct Create QR Button */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Live Contrast & Layout Preview</h2>
          <span className="text-xs font-mono text-slate-500">{draft.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sidebar & Distinct Create Button Preview */}
          <div
            className="rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors"
            style={{ backgroundColor: draft.sidebarColor, color: previewContrast }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold">QR Code Sidebar</div>
                  <div className="text-[11px]" style={{ color: previewMuted }}>
                    Auto contrast: {previewContrast}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md whitespace-nowrap"
                style={{ backgroundColor: createBtn.bg, color: createBtn.text }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create QR Code (Distinct Theme)</span>
              </button>
            </div>
          </div>

          {/* Login Page Header Preview */}
          <div
            className="rounded-2xl p-5 flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: draft.sidebarColor }}
          >
            <div className="bg-white/95 rounded-xl p-4 w-full max-w-xs shadow-lg text-center space-y-2">
              <div
                className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center text-white"
                style={{ backgroundColor: draft.primaryColor }}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs font-extrabold text-slate-900">Login Page Header Sync</div>
              <div
                className="py-1.5 px-3 rounded-lg text-[11px] font-bold text-white"
                style={{ backgroundColor: draft.primaryColor }}
              >
                Sign In Accent
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Curated Presets */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Curated Theme Presets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {presets.map((preset) => {
            const isSelected =
              draft.sidebarColor.toLowerCase() === preset.sidebarColor.toLowerCase() &&
              draft.primaryColor.toLowerCase() === preset.primaryColor.toLowerCase();

            return (
              <button
                key={preset.id}
                type="button"
                disabled={!canEdit}
                onClick={() => handleSelectPreset(preset)}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                  canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                } ${
                  isSelected
                    ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex -space-x-2 shrink-0">
                    <div
                      className="w-8 h-8 rounded-xl border-2 border-white shadow-xs"
                      style={{ backgroundColor: preset.sidebarColor }}
                    />
                    <div
                      className="w-8 h-8 rounded-xl border-2 border-white shadow-xs"
                      style={{ backgroundColor: preset.primaryColor }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{preset.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {preset.sidebarColor} / {preset.primaryColor}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Hex Color Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Custom Brand Colors</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Fine-tune your exact sidebar background and login accent colors. Contrast text updates automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-800">Sidebar & Login Backdrop</div>
              <div className="text-[11px] font-mono text-slate-500">{draft.sidebarColor}</div>
            </div>
            <input
              type="color"
              disabled={!canEdit}
              value={draft.sidebarColor}
              onChange={(e) => handleCustomColorChange('sidebarColor', e.target.value)}
              className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer bg-white p-0.5"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-800">Login Header & Primary Accent</div>
              <div className="text-[11px] font-mono text-slate-500">{draft.primaryColor}</div>
            </div>
            <input
              type="color"
              disabled={!canEdit}
              value={draft.primaryColor}
              onChange={(e) => handleCustomColorChange('primaryColor', e.target.value)}
              className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer bg-white p-0.5"
            />
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveCustom}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: draft.primaryColor }}
            >
              Apply Custom Theme
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
