export type UserRole = string; // e.g. 'super_admin' | 'admin' | 'viewer' | custom

export interface RolePrivilege {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

export type SystemSection =
  | 'Dashboard'
  | 'QR Codes'
  | 'Category Management'
  | 'Analytics'
  | 'Theme Settings'
  | 'Role Management'
  | 'User Management'
  | 'Reports';

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  isSystem?: boolean; // Cannot delete Super Admin role
  privileges: Record<SystemSection, RolePrivilege>;
  createdAt: string;
  deletedAt?: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string; // Ethiopian format: +251 9...
  role: string; // role ID
  password?: string;
  mustChangePassword?: boolean; // Forced to change default 7-digit password on next login
  otpEnabled?: boolean; // Super Admin can toggle OTP on/off per user
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
  avatarUrl?: string;
  deletedAt?: string | null; // Soft delete
}

export interface OTPRecord {
  id: string;
  userId: string;
  email: string;
  phone?: string;
  code: string;
  type: 'login' | 'password_reset';
  sentVia: ('email' | 'sms')[];
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface QRCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  displayOrder: number;
  createdAt: string;
  deletedAt?: string | null; // Soft delete
}

export type QRDestinationType =
  | 'website'
  | 'restaurant_menu'
  | 'telegram'
  | 'youtube'
  | 'social_media'
  | 'business_list'
  | 'table_standee'
  | 'takeout_express'
  | 'wifi_menu'
  | 'feedback';

export type QRFrameStyle = 'none' | 'scan-me' | 'table-card' | 'badge-top' | 'minimal-border';
export type QRDotStyle = 'square' | 'rounded' | 'dots';

export interface QRCodeStyling {
  fgColor: string;
  bgColor: string;
  frameStyle: QRFrameStyle;
  frameText: string;
  dotStyle: QRDotStyle;
  logoInCenter: boolean;
  customLogoUrl?: string;
  logoSizePercent?: number;
  size: number;
}

export interface WelcomeScreenConfig {
  enabled: boolean;
  logoUrl?: string;
  headline?: string;
  subheadline?: string;
  bannerColor?: string;
  buttonText?: string;
  displaySeconds?: number;
}

export interface RestaurantQRCode {
  id: string;
  restaurantId: string;
  categoryId?: string; // Links to QRCategory
  title: string;
  type: QRDestinationType;
  targetUrl: string; // Destination URL (website, Telegram, YouTube, Social media, etc.)
  tableNumber?: number;
  shortUrl: string;
  scansCount: number;
  lastScanAt?: string;
  status: 'active' | 'paused';
  createdAt: string;
  expiresAt?: string | null; // Optional expiration date requested by user
  isExpired?: boolean;
  styling: QRCodeStyling;
  welcomeScreen?: WelcomeScreenConfig; // Welcome screen per QR code
  deletedAt?: string | null; // Soft delete
}

export interface QRScanEvent {
  id: string;
  qrId: string;
  qrTitle: string;
  timestamp: string;
  device: string; // 'iOS' | 'Android' | 'Desktop' | 'Tablet'
  city?: string;
  referrer?: string;
}

export interface UploadedMenuFile {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  url: string;
  sizeFormatted?: string;
  uploadedAt: string;
  caption?: string;
}

export type MenuDisplayMode = 'interactive' | 'document' | 'hybrid';

export interface RestaurantProfile {
  id: string;
  name: string;
  tagline: string;
  description: string;
  website: string;
  phone: string;
  address: string;
  wifiSsid: string;
  wifiPassword?: string;
  currencySymbol: string;
  currencyCode: string;
  taxRatePercent: number;
  logoUrl: string;
  coverImageUrl: string;
  themeColor: string;
  welcomeMessage: string;
  allowOnlineOrders: boolean;
  allowTableDelivery: boolean;
  allowPickup: boolean;
  acceptedPaymentMethods: ('apple_pay' | 'google_pay' | 'credit_card' | 'counter_cash')[];
  menuDisplayMode: MenuDisplayMode;
  uploadedMenuFiles: UploadedMenuFile[];
  showImagesInGrid?: boolean;
}

export interface CustomThemeSetting {
  id: string;
  name: string;
  primaryColor: string; // Header & active accents
  sidebarColor: string; // Sidebar background
  sidebarContrastText: string; // Text color on sidebar
  isDark: boolean;
}
