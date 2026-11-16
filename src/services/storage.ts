import {
  RestaurantProfile,
  RestaurantQRCode,
  AppUser,
  RoleDefinition,
  QRCategory,
  CustomThemeSetting,
  OTPRecord,
  QRScanEvent,
} from '../types';
import { INITIAL_RESTAURANT } from '../data/initialData';
import { INITIAL_ROLES, INITIAL_CATEGORIES, INITIAL_THEMES } from '../data/systemDefaults';
import { NotificationService, SentNotificationRecord } from './notificationService';
import { ApiClient } from './api';
import { FileVault } from './fileVault';

const DB_KEY_PREFIX = 'qrcode_generator_postgres_v2_';

const STORAGE_KEYS = {
  DATABASE_NAME: 'QR Code Generator',
  USERS: `${DB_KEY_PREFIX}users`,
  ROLES: `${DB_KEY_PREFIX}roles`,
  CATEGORIES: `${DB_KEY_PREFIX}categories`,
  QR_CODES: `${DB_KEY_PREFIX}qr_codes`,
  SCAN_EVENTS: `${DB_KEY_PREFIX}scan_events`,
  OTPS: `${DB_KEY_PREFIX}otps`,
  THEME: `${DB_KEY_PREFIX}theme_setting`,
  RESTAURANT: `${DB_KEY_PREFIX}restaurant_profile`,
  SESSION: `${DB_KEY_PREFIX}session_user`,
};

// In-memory session fallback when uploaded images/PDFs exceed browser ~5MB localStorage quota
let memoryQRCodesFallback: RestaurantQRCode[] | null = null;
let memoryRestaurantFallback: RestaurantProfile | null = null;

// Real-time broadcast sync
let syncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel('qrcode_generator_postgres_sync');
  } catch (e) {
    console.warn('BroadcastChannel not supported', e);
  }
}

export const subscribeToLiveSync = (callback: (event: { type: string; payload?: unknown }) => void) => {
  if (!syncChannel) return () => {};
  const handler = (event: MessageEvent) => {
    callback(event.data);
  };
  syncChannel.addEventListener('message', handler);
  return () => {
    syncChannel?.removeEventListener('message', handler);
  };
};

const notifySync = (type: string, payload?: unknown) => {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch (e) {
      console.warn('Sync postMessage failed', e);
    }
  }
};

export const StorageService = {
  getDatabaseName(): string {
    return STORAGE_KEYS.DATABASE_NAME;
  },

  // ==================== THEME MANAGEMENT ====================
  getThemeSetting(): CustomThemeSetting {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.THEME);
      if (data) return JSON.parse(data);
      localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(INITIAL_THEMES[0]));
      return INITIAL_THEMES[0];
    } catch {
      return INITIAL_THEMES[0];
    }
  },

  hydrateFromBackend(data: {
    roles?: RoleDefinition[];
    users?: AppUser[];
    categories?: QRCategory[];
    qrCodes?: RestaurantQRCode[];
    scanEvents?: QRScanEvent[];
    otps?: OTPRecord[];
    notifications?: SentNotificationRecord[];
    theme?: CustomThemeSetting;
    restaurant?: RestaurantProfile;
  }): void {
    if (data.roles) localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(data.roles));
    if (data.users) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
    if (data.categories) localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
    if (data.qrCodes) {
      memoryQRCodesFallback = data.qrCodes;
      try {
        localStorage.setItem(STORAGE_KEYS.QR_CODES, JSON.stringify(data.qrCodes));
      } catch {
        // Ignore quota overflow during hydration; memoryQRCodesFallback holds full payload
      }
    }
    if (data.scanEvents) localStorage.setItem(STORAGE_KEYS.SCAN_EVENTS, JSON.stringify(data.scanEvents));
    if (data.otps) localStorage.setItem(STORAGE_KEYS.OTPS, JSON.stringify(data.otps));
    if (data.notifications) NotificationService.setHistory(data.notifications);
    if (data.theme) localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(data.theme));
    if (data.restaurant) {
      memoryRestaurantFallback = data.restaurant;
      try {
        localStorage.setItem(STORAGE_KEYS.RESTAURANT, JSON.stringify(data.restaurant));
      } catch {
        // Ignore quota overflow
      }
    }
  },

  saveThemeSetting(theme: CustomThemeSetting): void {
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(theme));
    notifySync('THEME_UPDATED', theme);
    ApiClient.saveTheme(theme).catch(() => {});
  },

  getAvailableThemes(): CustomThemeSetting[] {
    return INITIAL_THEMES;
  },

  // ==================== ROLES MANAGEMENT ====================
  getRoles(): RoleDefinition[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ROLES);
      if (data) {
        const parsed: RoleDefinition[] = JSON.parse(data);
        return parsed.filter((r) => !r.deletedAt); // Exclude soft-deleted
      }
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(INITIAL_ROLES));
      return INITIAL_ROLES;
    } catch {
      return INITIAL_ROLES;
    }
  },

  getAllRolesIncludingDeleted(): RoleDefinition[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ROLES);
      return data ? JSON.parse(data) : INITIAL_ROLES;
    } catch {
      return INITIAL_ROLES;
    }
  },

  saveRoles(roles: RoleDefinition[]): void {
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
    notifySync('ROLES_UPDATED', roles);
  },

  createRole(role: Omit<RoleDefinition, 'id' | 'createdAt'>): { success: boolean; role?: RoleDefinition; error?: string } {
    const all = this.getAllRolesIncludingDeleted();
    const existing = all.find((r) => r.name.toLowerCase() === role.name.toLowerCase().trim() && !r.deletedAt);
    if (existing) {
      return { success: false, error: 'A role with this name already exists.' };
    }
    const newRole: RoleDefinition = {
      ...role,
      id: `role_${Date.now()}`,
      name: role.name.trim(),
      createdAt: new Date().toISOString(),
    };
    all.push(newRole);
    this.saveRoles(all);
    ApiClient.createRole(role).then((res) => {
      if (res.success && res.role) {
        const updatedAll = this.getAllRolesIncludingDeleted().map((r) =>
          r.id === newRole.id ? res.role! : r
        );
        this.saveRoles(updatedAll);
      }
    }).catch(() => {});
    return { success: true, role: newRole };
  },

  updateRole(updated: RoleDefinition): { success: boolean; error?: string } {
    const all = this.getAllRolesIncludingDeleted();
    const index = all.findIndex((r) => r.id === updated.id);
    if (index === -1) return { success: false, error: 'Role not found.' };
    all[index] = updated;
    this.saveRoles(all);
    ApiClient.updateRole(updated).catch(() => {});
    return { success: true };
  },

  softDeleteRole(roleId: string): { success: boolean; error?: string } {
    const all = this.getAllRolesIncludingDeleted();
    const target = all.find((r) => r.id === roleId);
    if (!target) return { success: false, error: 'Role not found.' };
    if (target.isSystem || target.id === 'super_admin') {
      return { success: false, error: 'Cannot delete the Super Admin system role.' };
    }
    target.deletedAt = new Date().toISOString();
    this.saveRoles(all);
    ApiClient.softDeleteRole(roleId).catch(() => {});
    return { success: true };
  },

  restoreRole(roleId: string): { success: boolean; error?: string } {
    const all = this.getAllRolesIncludingDeleted();
    const target = all.find((r) => r.id === roleId);
    if (!target) return { success: false, error: 'Role not found.' };
    target.deletedAt = null;
    this.saveRoles(all);
    ApiClient.restoreRole(roleId).catch(() => {});
    return { success: true };
  },

  // ==================== CATEGORIES MANAGEMENT ====================
  getCategories(): QRCategory[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (data) {
        const parsed: QRCategory[] = JSON.parse(data);
        return parsed.filter((c) => !c.deletedAt); // Exclude soft-deleted
      }
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
      return INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  },

  getAllCategoriesIncludingDeleted(): QRCategory[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  },

  saveCategories(categories: QRCategory[]): void {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    notifySync('CATEGORIES_UPDATED', categories);
  },

  createCategory(cat: Omit<QRCategory, 'id' | 'createdAt'>): { success: boolean; category?: QRCategory; error?: string } {
    const all = this.getAllCategoriesIncludingDeleted();
    const existing = all.find((c) => c.name.toLowerCase() === cat.name.toLowerCase().trim() && !c.deletedAt);
    if (existing) {
      return { success: false, error: 'A category with this name already exists.' };
    }
    const newCat: QRCategory = {
      ...cat,
      id: `cat_${Date.now()}`,
      name: cat.name.trim(),
      slug: cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      createdAt: new Date().toISOString(),
    };
    all.push(newCat);
    this.saveCategories(all);
    ApiClient.createCategory(cat).then((res) => {
      if (res.success && res.category) {
        const updatedAll = this.getAllCategoriesIncludingDeleted().map((c) =>
          c.id === newCat.id ? res.category! : c
        );
        this.saveCategories(updatedAll);
      }
    }).catch(() => {});
    return { success: true, category: newCat };
  },

  updateCategory(updated: QRCategory): { success: boolean; error?: string } {
    const all = this.getAllCategoriesIncludingDeleted();
    const idx = all.findIndex((c) => c.id === updated.id);
    if (idx === -1) return { success: false, error: 'Category not found.' };
    all[idx] = updated;
    this.saveCategories(all);
    ApiClient.updateCategory(updated).catch(() => {});
    return { success: true };
  },

  softDeleteCategory(categoryId: string): { success: boolean; error?: string } {
    const all = this.getAllCategoriesIncludingDeleted();
    const target = all.find((c) => c.id === categoryId);
    if (!target) return { success: false, error: 'Category not found.' };
    target.deletedAt = new Date().toISOString();
    this.saveCategories(all);
    ApiClient.softDeleteCategory(categoryId).catch(() => {});
    return { success: true };
  },

  restoreCategory(categoryId: string): { success: boolean; error?: string } {
    const all = this.getAllCategoriesIncludingDeleted();
    const target = all.find((c) => c.id === categoryId);
    if (!target) return { success: false, error: 'Category not found.' };
    target.deletedAt = null;
    this.saveCategories(all);
    ApiClient.restoreCategory(categoryId).catch(() => {});
    return { success: true };
  },

  // ==================== USERS & AUTH ====================
  getUsers(): AppUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (data) {
        const parsed: AppUser[] = JSON.parse(data);
        return parsed.filter((u) => !u.deletedAt);
      }
      const initialUsers: AppUser[] = [
        {
          id: 'user_super_admin',
          name: 'Enyew Mekete',
          email: 'enyewmekete65@gmail.com',
          phone: '+251943305937',
          role: 'super_admin',
          password: 'SuperAdmin@2026',
          status: 'active',
          otpEnabled: false,
          mustChangePassword: false,
          createdAt: '2026-01-01T00:00:00Z',
          lastLoginAt: '2026-11-12T08:00:00Z',
        },
        {
          id: 'user_admin_demo',
          name: 'Hermela B.',
          email: 'admin@qrcodegenerator.io',
          phone: '+251911223344',
          role: 'admin',
          password: 'Admin@2026',
          status: 'active',
          otpEnabled: true,
          mustChangePassword: false,
          createdAt: '2026-02-01T00:00:00Z',
          lastLoginAt: '2026-11-10T12:00:00Z',
        },
      ];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
      return initialUsers;
    } catch {
      return [];
    }
  },

  getAllUsersIncludingDeleted(): AppUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveUsers(users: AppUser[]): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    notifySync('USERS_UPDATED', users);
  },

  addUser(params: {
    name: string;
    email: string;
    phone?: string;
    role: string;
    otpEnabled?: boolean;
  }): { success: boolean; user?: AppUser; defaultPassword?: string; error?: string } {
    const all = this.getAllUsersIncludingDeleted();
    const existing = all.find((u) => u.email.toLowerCase() === params.email.toLowerCase().trim() && !u.deletedAt);
    if (existing) {
      return { success: false, error: 'A user with this email already exists in QR Code Generator database.' };
    }

    // Auto-generate 7-digit mixed password as requested
    const defaultPassword = NotificationService.generate7DigitMixedPassword();

    const newUser: AppUser = {
      id: `usr_${Date.now()}`,
      name: params.name.trim(),
      email: params.email.trim().toLowerCase(),
      phone: params.phone?.trim() || '+251943305937',
      role: params.role || 'admin',
      password: defaultPassword,
      mustChangePassword: true, // MUST change password on next login!
      otpEnabled: params.otpEnabled !== undefined ? params.otpEnabled : true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    all.push(newUser);
    this.saveUsers(all);

    // Automatically dispatch credentials via Email & Ethiopian SMS
    NotificationService.dispatch({
      toEmail: newUser.email,
      toPhone: newUser.phone,
      subject: 'Welcome to QR Code Generator - Your Account Credentials',
      message: `Dear ${newUser.name}, your account has been created. Username/Email: ${newUser.email}, Temporary Password: ${defaultPassword}. Please sign in and set your new permanent password.`,
      type: 'welcome_credentials',
      data: { defaultPassword },
    });

    return { success: true, user: newUser, defaultPassword };
  },

  resetPasswordForUser(userId: string): { success: boolean; newDefaultPassword?: string; error?: string } {
    const all = this.getAllUsersIncludingDeleted();
    const user = all.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'User not found.' };

    const newDefaultPassword = NotificationService.generate7DigitMixedPassword();
    user.password = newDefaultPassword;
    user.mustChangePassword = true; // Force change on next login
    this.saveUsers(all);

    // Auto send to email & Ethiopian SMS
    NotificationService.dispatch({
      toEmail: user.email,
      toPhone: user.phone,
      subject: 'QR Code Generator - Password Reset',
      message: `Dear ${user.name}, your password has been reset. Temporary Password: ${newDefaultPassword}. You will be required to change this upon next sign in.`,
      type: 'password_reset',
      data: { newDefaultPassword },
    });

    return { success: true, newDefaultPassword };
  },

  changeUserPassword(userId: string, newPassword: string): { success: boolean; error?: string } {
    const strength = NotificationService.validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      return {
        success: false,
        error: 'Password does not satisfy the 5 security rules (Min 8 chars, 1 Capital, 1 Small, 1 Number, 1 Special).',
      };
    }

    const all = this.getAllUsersIncludingDeleted();
    const user = all.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'User not found.' };

    user.password = newPassword;
    user.mustChangePassword = false; // Successfully changed
    this.saveUsers(all);

    const session = this.getCurrentUser();
    if (session && session.id === userId) {
      session.password = newPassword;
      session.mustChangePassword = false;
      this.setCurrentUser(session);
    }

    return { success: true };
  },

  softDeleteUser(userId: string): { success: boolean; error?: string } {
    const all = this.getAllUsersIncludingDeleted();
    const target = all.find((u) => u.id === userId);
    if (!target) return { success: false, error: 'User not found.' };
    if (target.role === 'super_admin') {
      const activeSuperAdmins = all.filter((u) => u.role === 'super_admin' && !u.deletedAt);
      if (activeSuperAdmins.length <= 1) {
        return { success: false, error: 'Cannot delete the only Super Admin in the system.' };
      }
    }
    target.deletedAt = new Date().toISOString();
    this.saveUsers(all);
    return { success: true };
  },

  restoreUser(userId: string): { success: boolean; error?: string } {
    const all = this.getAllUsersIncludingDeleted();
    const target = all.find((u) => u.id === userId);
    if (!target) return { success: false, error: 'User not found.' };
    target.deletedAt = null;
    this.saveUsers(all);
    ApiClient.restoreUser(userId).catch(() => {});
    return { success: true };
  },

  updateUser(
    userId: string,
    updates: {
      name: string;
      email: string;
      phone?: string;
      role: string;
      status: 'active' | 'suspended';
      otpEnabled: boolean;
    }
  ): { success: boolean; user?: AppUser; error?: string } {
    const all = this.getAllUsersIncludingDeleted();
    const target = all.find((u) => u.id === userId && !u.deletedAt);
    if (!target) return { success: false, error: 'User not found.' };
    target.name = updates.name.trim();
    target.email = updates.email.trim().toLowerCase();
    target.phone = updates.phone?.trim() || target.phone;
    target.role = updates.role;
    target.status = updates.status;
    target.otpEnabled = updates.otpEnabled;
    this.saveUsers(all);
    return { success: true, user: target };
  },

  toggleUserOTP(userId: string): { success: boolean; otpEnabled?: boolean; error?: string } {
    const all = this.getAllUsersIncludingDeleted();
    const target = all.find((u) => u.id === userId);
    if (!target) return { success: false, error: 'User not found.' };
    target.otpEnabled = !target.otpEnabled;
    this.saveUsers(all);
    return { success: true, otpEnabled: target.otpEnabled };
  },

  updateUserRoleAndStatus(userId: string, roleId: string, status: 'active' | 'suspended'): { success: boolean; error?: string } {
    const all = this.getAllUsersIncludingDeleted();
    const target = all.find((u) => u.id === userId);
    if (!target) return { success: false, error: 'User not found.' };
    target.role = roleId;
    target.status = status;
    this.saveUsers(all);
    return { success: true };
  },

  getCurrentUser(): AppUser | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: AppUser | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
    notifySync('SESSION_CHANGED', user);
  },

  logout(): void {
    this.setCurrentUser(null);
  },

  // ==================== OTP MANAGEMENT ====================
  getOTPs(): OTPRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OTPS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  createOTP(user: AppUser, type: 'login' | 'password_reset' = 'login'): OTPRecord {
    const code = NotificationService.generate6DigitOTP();
    const record: OTPRecord = {
      id: `otp_${Date.now()}`,
      userId: user.id,
      email: user.email,
      phone: user.phone,
      code,
      type,
      sentVia: ['email', 'sms'],
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      used: false,
      createdAt: new Date().toISOString(),
    };

    const otps = this.getOTPs();
    otps.unshift(record);
    localStorage.setItem(STORAGE_KEYS.OTPS, JSON.stringify(otps.slice(0, 50)));

    // Send via email and SMS
    NotificationService.dispatch({
      toEmail: user.email,
      toPhone: user.phone,
      subject: `Your QR Code Generator Verification Code: ${code}`,
      message: `Your one-time verification code is ${code}. Valid for 10 minutes. Do not share this code with anyone.`,
      type: 'otp',
      data: { code },
    });

    return record;
  },

  verifyOTP(email: string, inputCode: string): { success: boolean; error?: string } {
    const otps = this.getOTPs();
    const trimmedEmail = email.trim().toLowerCase();
    const valid = otps.find(
      (o) =>
        o.email.toLowerCase() === trimmedEmail &&
        o.code === inputCode.trim() &&
        !o.used &&
        new Date(o.expiresAt).getTime() > Date.now()
    );

    if (!valid) {
      return { success: false, error: 'Invalid or expired OTP code. Please request a new one.' };
    }

    valid.used = true;
    localStorage.setItem(STORAGE_KEYS.OTPS, JSON.stringify(otps));
    return { success: true };
  },

  // ==================== QR CODES & ANALYTICS ====================
  getQRCodes(): RestaurantQRCode[] {
    try {
      const now = Date.now();
      if (Array.isArray(memoryQRCodesFallback)) {
        return memoryQRCodesFallback
          .filter((q) => q && !q.deletedAt)
          .map((q) => ({
            ...q,
            isExpired: q.expiresAt ? new Date(q.expiresAt).getTime() < now : false,
          }));
      }
      const data = localStorage.getItem(STORAGE_KEYS.QR_CODES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          memoryQRCodesFallback = parsed;
          return parsed
            .filter((q) => q && !q.deletedAt)
            .map((q) => {
              const isExpired = q.expiresAt ? new Date(q.expiresAt).getTime() < now : false;
              return { ...q, isExpired };
            });
        }
      }
      // Populate default categories
      const initialQRs: RestaurantQRCode[] = [
        {
          id: 'qr_web_01',
          restaurantId: 'company_qr_01',
          categoryId: 'cat_website',
          title: 'Official Company Portal',
          type: 'website',
          targetUrl: 'https://qrcodegenerator.io',
          shortUrl: 'dineqr.io/portal-main',
          scansCount: 428,
          lastScanAt: '2026-11-12T01:30:00Z',
          status: 'active',
          createdAt: '2026-10-15T10:00:00Z',
          styling: {
            fgColor: '#059669',
            bgColor: '#ffffff',
            frameStyle: 'scan-me',
            frameText: 'VISIT WEBSITE',
            dotStyle: 'rounded',
            logoInCenter: true,
            size: 280,
          },
          welcomeScreen: {
            enabled: true,
            headline: 'Welcome to Our Digital Space',
            subheadline: 'Connecting you instantly to our official platform',
            displaySeconds: 2,
          },
        },
        {
          id: 'qr_telegram_01',
          restaurantId: 'company_qr_01',
          categoryId: 'cat_telegram',
          title: 'Telegram Official Broadcast Channel',
          type: 'telegram',
          targetUrl: 'https://t.me/qrcodegenerator_updates',
          shortUrl: 'dineqr.io/telegram-join',
          scansCount: 286,
          lastScanAt: '2026-11-11T19:40:00Z',
          status: 'active',
          createdAt: '2026-10-20T11:00:00Z',
          styling: {
            fgColor: '#0284c7',
            bgColor: '#ffffff',
            frameStyle: 'minimal-border',
            frameText: 'JOIN TELEGRAM',
            dotStyle: 'dots',
            logoInCenter: true,
            size: 280,
          },
          welcomeScreen: {
            enabled: true,
            headline: 'Join Our Community',
            subheadline: 'Fastest updates and direct customer support on Telegram',
            displaySeconds: 2,
          },
        },
        {
          id: 'qr_youtube_01',
          restaurantId: 'company_qr_01',
          categoryId: 'cat_youtube',
          title: 'YouTube Product Showcase & Demo',
          type: 'youtube',
          targetUrl: 'https://youtube.com/@qrcodegenerator',
          shortUrl: 'dineqr.io/youtube-channel',
          scansCount: 194,
          lastScanAt: '2026-11-10T14:15:00Z',
          status: 'active',
          createdAt: '2026-10-25T09:00:00Z',
          styling: {
            fgColor: '#dc2626',
            bgColor: '#ffffff',
            frameStyle: 'badge-top',
            frameText: 'WATCH ON YOUTUBE',
            dotStyle: 'square',
            logoInCenter: true,
            size: 280,
          },
        },
        {
          id: 'qr_menu_01',
          restaurantId: 'company_qr_01',
          categoryId: 'cat_restaurant',
          title: "Guansa Ma'ed Menu (Table 04)",
          description: 'GOOD FOOD · GOOD MOOD — Fresh Ingredients, Authentic Flavors',
          ctaLabel: 'See More',
          type: 'table_standee',
          tableNumber: 4,
          targetUrl: 'https://guansa-maed-mu.vercel.app',
          shortUrl: 'dineqr.io/table-04',
          scansCount: 164,
          lastScanAt: '2026-11-12T01:12:00Z',
          status: 'active',
          createdAt: '2026-10-18T14:20:00Z',
          styling: {
            fgColor: '#0f172a',
            bgColor: '#ffffff',
            frameStyle: 'table-card',
            frameText: 'TABLE 04 · SCAN TO VIEW',
            dotStyle: 'dots',
            logoInCenter: true,
            customLogoUrl: '/assets/guansa_logo.png',
            size: 280,
          },
          welcomeScreen: {
            enabled: true,
            logoUrl: '/assets/guansa_logo.png',
            headline: "Guansa Ma'ed",
            subheadline: 'GOOD FOOD · GOOD MOOD — Fresh Ingredients, Authentic Flavors',
            bannerColor: '#0f172a',
            buttonText: 'View Menu',
            displaySeconds: 2,
          },
          uploadedFiles: [
            {
              id: 'menu_sheet_official',
              name: 'Guansa Coffee Hub Menu.png',
              type: 'image',
              url: '/assets/guansa_menu_card.png',
              sizeFormatted: '652 × 922 HD',
              uploadedAt: '2026-10-29T18:30:00Z',
              caption: "Guansa Ma'ed Digital Menu",
            },
          ],
        },
      ];
      localStorage.setItem(STORAGE_KEYS.QR_CODES, JSON.stringify(initialQRs));
      return initialQRs;
    } catch {
      return [];
    }
  },

  getAllQRCodesIncludingDeleted(): RestaurantQRCode[] {
    try {
      if (Array.isArray(memoryQRCodesFallback)) return memoryQRCodesFallback;
      const data = localStorage.getItem(STORAGE_KEYS.QR_CODES);
      const parsed = data ? JSON.parse(data) : [];
      const safe = Array.isArray(parsed) ? parsed : [];
      memoryQRCodesFallback = safe;
      return safe;
    } catch {
      return Array.isArray(memoryQRCodesFallback) ? memoryQRCodesFallback : [];
    }
  },

  saveQRCodes(qrCodes: RestaurantQRCode[]): void {
    const safeList = Array.isArray(qrCodes) ? qrCodes : [];
    memoryQRCodesFallback = safeList;

    // Persist large inline files into IndexedDB FileVault so reloads/static hosts never lose them
    safeList.forEach((q) => {
      if (Array.isArray(q.uploadedFiles)) {
        q.uploadedFiles.forEach((f) => {
          if (f?.id && typeof f.url === 'string' && f.url.startsWith('data:')) {
            FileVault.saveFile(f.id, f.url).catch(() => {});
          }
        });
      }
    });

    try {
      localStorage.setItem(STORAGE_KEYS.QR_CODES, JSON.stringify(safeList));
    } catch {
      // Fallback: strip oversized inline base64 blobs (>150KB) for localStorage metadata persistence;
      // full files remain in memoryQRCodesFallback, IndexedDB FileVault, and backend API.
      try {
        const compact = safeList.map((q) => ({
          ...q,
          uploadedFiles: Array.isArray(q.uploadedFiles)
            ? q.uploadedFiles.map((f) =>
                f && typeof f.url === 'string' && f.url.startsWith('data:') && f.url.length > 150000
                  ? { ...f, url: '' }
                  : f
              )
            : [],
        }));
        localStorage.setItem(STORAGE_KEYS.QR_CODES, JSON.stringify(compact));
      } catch {
        // Ignore if still over quota
      }
    }
    notifySync('QR_CODES_UPDATED', safeList);
  },

  async hydrateFilesFromVault(): Promise<RestaurantQRCode[]> {
    const all = this.getAllQRCodesIncludingDeleted();
    const hydrated = await FileVault.hydrateQRCodes(all);
    memoryQRCodesFallback = hydrated;
    return this.getQRCodes();
  },

  createQRCode(qrCode: RestaurantQRCode): void {
    const all = this.getAllQRCodesIncludingDeleted();
    const safeAll = Array.isArray(all) ? all : [];
    const next = [qrCode, ...safeAll];
    this.saveQRCodes(next);
    try {
      ApiClient.createQRCode(qrCode).catch(() => {});
    } catch {
      // Ignore sync network error; memory fallback already saved
    }
  },

  updateQRCode(updated: RestaurantQRCode): void {
    const all = this.getAllQRCodesIncludingDeleted();
    const idx = all.findIndex((q) => q.id === updated.id);
    if (idx !== -1) {
      all[idx] = updated;
      this.saveQRCodes(all);
      ApiClient.updateQRCode(updated).catch(() => {});
    }
  },

  softDeleteQRCode(id: string): void {
    const all = this.getAllQRCodesIncludingDeleted();
    const target = all.find((q) => q.id === id);
    if (target) {
      target.deletedAt = new Date().toISOString();
      this.saveQRCodes(all);
      ApiClient.softDeleteQRCode(id).catch(() => {});
    }
  },

  restoreQRCode(id: string): void {
    const all = this.getAllQRCodesIncludingDeleted();
    const target = all.find((q) => q.id === id);
    if (target) {
      target.deletedAt = null;
      this.saveQRCodes(all);
      ApiClient.restoreQRCode(id).catch(() => {});
    }
  },

  recordScan(qrId: string, device: string = 'iOS'): void {
    const all = this.getAllQRCodesIncludingDeleted();
    const target = all.find((q) => q.id === qrId);
    if (target) {
      target.scansCount += 1;
      target.lastScanAt = new Date().toISOString();
      this.saveQRCodes(all);

      const events: QRScanEvent[] = this.getScanEvents();
      events.unshift({
        id: `scan_${Date.now()}`,
        qrId: target.id,
        qrTitle: target.title,
        timestamp: new Date().toISOString(),
        device,
        city: 'Addis Ababa, ET',
      });
      localStorage.setItem(STORAGE_KEYS.SCAN_EVENTS, JSON.stringify(events.slice(0, 300)));
      notifySync('SCAN_RECORDED', { qrId, count: target.scansCount });
      ApiClient.recordScan(qrId, device).catch(() => {});
    }
  },

  getScanEvents(): QRScanEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCAN_EVENTS);
      if (data) return JSON.parse(data);
      const seeded: QRScanEvent[] = [
        {
          id: 'scan_seed_1',
          qrId: 'qr_web_01',
          qrTitle: 'Official Company Portal',
          timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
          device: 'iOS',
          city: 'Addis Ababa, ET',
        },
        {
          id: 'scan_seed_2',
          qrId: 'qr_telegram_01',
          qrTitle: 'Telegram Official Broadcast Channel',
          timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
          device: 'Android',
          city: 'Bahir Dar, ET',
        },
        {
          id: 'scan_seed_3',
          qrId: 'qr_youtube_01',
          qrTitle: 'YouTube Product Showcase & Demo',
          timestamp: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
          device: 'Desktop',
          city: 'Hawassa, ET',
        },
        {
          id: 'scan_seed_4',
          qrId: 'qr_menu_01',
          qrTitle: 'Table 04 Contactless Dine-In',
          timestamp: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
          device: 'iOS',
          city: 'Addis Ababa, ET',
        },
      ];
      localStorage.setItem(STORAGE_KEYS.SCAN_EVENTS, JSON.stringify(seeded));
      return seeded;
    } catch {
      return [];
    }
  },

  // ==================== RESTAURANT / BRAND PROFILE ====================
  getRestaurant(): RestaurantProfile {
    try {
      if (memoryRestaurantFallback && typeof memoryRestaurantFallback === 'object') {
        return memoryRestaurantFallback;
      }
      const data = localStorage.getItem(STORAGE_KEYS.RESTAURANT);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          memoryRestaurantFallback = parsed;
          return parsed;
        }
      }
      return INITIAL_RESTAURANT;
    } catch {
      return memoryRestaurantFallback || INITIAL_RESTAURANT;
    }
  },

  saveRestaurant(restaurant: RestaurantProfile): void {
    memoryRestaurantFallback = restaurant;
    try {
      localStorage.setItem(STORAGE_KEYS.RESTAURANT, JSON.stringify(restaurant));
    } catch {
      // Ignore quota overflow
    }
    notifySync('RESTAURANT_UPDATED', restaurant);
    ApiClient.saveCompany(restaurant).catch(() => {});
  },

  resetAllToDefault(): void {
    memoryQRCodesFallback = null;
    memoryRestaurantFallback = null;
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (key !== STORAGE_KEYS.DATABASE_NAME) {
        localStorage.removeItem(key);
      }
    });
    notifySync('RESET_ALL');
    ApiClient.resetDefaults().catch(() => {});
  },
};
