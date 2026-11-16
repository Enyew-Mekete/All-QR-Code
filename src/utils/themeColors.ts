import { CustomThemeSetting } from '../types';

/**
 * Computes relative luminance of a hex color and returns crisp WCAG-AA contrast text color
 */
export function getContrastTextColor(hex: string): string {
  const clean = (hex || '#0f172a').replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance > 0.45 ? '#0f172a' : '#ffffff';
}

/**
 * Returns a muted secondary contrast text color for subtitles/icons inside themed surfaces
 */
export function getContrastMutedColor(hex: string): string {
  return getContrastTextColor(hex) === '#ffffff'
    ? 'rgba(255, 255, 255, 0.72)'
    : 'rgba(15, 23, 42, 0.68)';
}

/**
 * Computes a distinct, high-contrast button theme specifically for "Create QR Code" CTA
 * Requirement: "NB: When 'Create QR Code' theme is differ from this."
 */
export function getDistinctCreateQRTheme(theme: CustomThemeSetting): {
  bg: string;
  hoverBg: string;
  text: string;
  ring: string;
} {
  const sidebarHex = (theme.sidebarColor || '').toLowerCase();
  const primaryHex = (theme.primaryColor || '').toLowerCase();

  // If active theme is green/emerald/teal, use crisp Burnt Coral/Amber-Orange
  if (
    sidebarHex.includes('064e3b') ||
    sidebarHex.includes('059669') ||
    primaryHex.includes('059669') ||
    primaryHex.includes('0d9488') ||
    sidebarHex.includes('115e59')
  ) {
    return {
      bg: '#ea580c',
      hoverBg: '#c2410c',
      text: '#ffffff',
      ring: 'rgba(234, 88, 12, 0.35)',
    };
  }

  // If active theme is warm amber/brown/orange, use Deep Indigo
  if (
    sidebarHex.includes('78350f') ||
    primaryHex.includes('d97706') ||
    primaryHex.includes('ea580c')
  ) {
    return {
      bg: '#4338ca',
      hoverBg: '#3730a3',
      text: '#ffffff',
      ring: 'rgba(67, 56, 202, 0.35)',
    };
  }

  // Otherwise (Carbon Onyx, Purple, Custom), use vibrant Emerald
  return {
    bg: '#059669',
    hoverBg: '#047857',
    text: '#ffffff',
    ring: 'rgba(5, 150, 105, 0.35)',
  };
}
