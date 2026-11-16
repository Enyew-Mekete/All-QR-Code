import type {
  AppUser,
  CustomThemeSetting,
  OTPRecord,
  QRCategory,
  QRScanEvent,
  RestaurantProfile,
  RestaurantQRCode,
  RoleDefinition,
} from '../types';
import type { SentNotificationRecord } from './notificationService';

export interface BootstrapResponse {
  success: boolean;
  roles: RoleDefinition[];
  users: AppUser[];
  categories: QRCategory[];
  qrCodes: RestaurantQRCode[];
  scanEvents: QRScanEvent[];
  otps: OTPRecord[];
  notifications: SentNotificationRecord[];
  theme: CustomThemeSetting;
  restaurant: RestaurantProfile;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok && !data?.error) {
    throw new Error(`HTTP ${res.status}`);
  }
  return data as T;
}

export const ApiClient = {
  bootstrap(): Promise<BootstrapResponse> {
    return request<BootstrapResponse>('/api/bootstrap');
  },

  login(identifier: string, password: string) {
    return request<{
      success: boolean;
      step?: 'otp' | 'force_password_change' | 'authenticated';
      user?: AppUser;
      otpPreview?: string;
      error?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  },

  verifyOTP(email: string, code: string) {
    return request<{
      success: boolean;
      step?: 'force_password_change' | 'authenticated';
      user?: AppUser;
      error?: string;
    }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },

  resendOTP(email: string) {
    return request<{ success: boolean; otpPreview?: string; error?: string }>(
      '/api/auth/resend-otp',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
  },

  changePassword(userId: string, newPassword: string) {
    return request<{ success: boolean; user?: AppUser; error?: string }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ userId, newPassword }),
      }
    );
  },

  // Users
  createUser(payload: {
    name: string;
    email: string;
    phone: string;
    role: string;
    otpEnabled: boolean;
  }) {
    return request<{ success: boolean; user?: AppUser; message?: string; error?: string }>(
      '/api/users',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  updateUser(
    id: string,
    payload: {
      name: string;
      email: string;
      phone: string;
      role: string;
      status: 'active' | 'suspended';
      otpEnabled: boolean;
    }
  ) {
    return request<{ success: boolean; user?: AppUser; error?: string }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  toggleUserOTP(id: string) {
    return request<{ success: boolean; user?: AppUser; error?: string }>(
      `/api/users/${id}/toggle-otp`,
      { method: 'POST' }
    );
  },

  resetUserPassword(id: string) {
    return request<{ success: boolean; message?: string; error?: string }>(
      `/api/users/${id}/reset-password`,
      { method: 'POST' }
    );
  },

  softDeleteUser(id: string) {
    return request<{ success: boolean; error?: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  restoreUser(id: string) {
    return request<{ success: boolean; error?: string }>(`/api/users/${id}/restore`, {
      method: 'POST',
    });
  },

  // Roles
  createRole(role: Omit<RoleDefinition, 'id' | 'createdAt'>) {
    return request<{ success: boolean; role?: RoleDefinition; error?: string }>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(role),
    });
  },

  updateRole(role: RoleDefinition) {
    return request<{ success: boolean; role?: RoleDefinition; error?: string }>(
      `/api/roles/${role.id}`,
      {
        method: 'PUT',
        body: JSON.stringify(role),
      }
    );
  },

  softDeleteRole(id: string) {
    return request<{ success: boolean; error?: string }>(`/api/roles/${id}`, {
      method: 'DELETE',
    });
  },

  restoreRole(id: string) {
    return request<{ success: boolean; error?: string }>(`/api/roles/${id}/restore`, {
      method: 'POST',
    });
  },

  // Categories
  createCategory(cat: Omit<QRCategory, 'id' | 'createdAt'>) {
    return request<{ success: boolean; category?: QRCategory; error?: string }>(
      '/api/categories',
      {
        method: 'POST',
        body: JSON.stringify(cat),
      }
    );
  },

  updateCategory(cat: QRCategory) {
    return request<{ success: boolean; category?: QRCategory; error?: string }>(
      `/api/categories/${cat.id}`,
      {
        method: 'PUT',
        body: JSON.stringify(cat),
      }
    );
  },

  softDeleteCategory(id: string) {
    return request<{ success: boolean; error?: string }>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  },

  restoreCategory(id: string) {
    return request<{ success: boolean; error?: string }>(`/api/categories/${id}/restore`, {
      method: 'POST',
    });
  },

  // QR Codes
  createQRCode(qr: RestaurantQRCode) {
    return request<{ success: boolean; qrCode?: RestaurantQRCode; error?: string }>(
      '/api/qr-codes',
      {
        method: 'POST',
        body: JSON.stringify(qr),
      }
    );
  },

  updateQRCode(qr: RestaurantQRCode) {
    return request<{ success: boolean; qrCode?: RestaurantQRCode; error?: string }>(
      `/api/qr-codes/${qr.id}`,
      {
        method: 'PUT',
        body: JSON.stringify(qr),
      }
    );
  },

  softDeleteQRCode(id: string) {
    return request<{ success: boolean; error?: string }>(`/api/qr-codes/${id}`, {
      method: 'DELETE',
    });
  },

  restoreQRCode(id: string) {
    return request<{ success: boolean; error?: string }>(`/api/qr-codes/${id}/restore`, {
      method: 'POST',
    });
  },

  recordScan(id: string, device: string) {
    return request<{ success: boolean; qrCode?: RestaurantQRCode; error?: string }>(
      `/api/qr-codes/${id}/scan`,
      {
        method: 'POST',
        body: JSON.stringify({ device }),
      }
    );
  },

  // Settings & Reset
  saveTheme(theme: CustomThemeSetting) {
    return request<{ success: boolean }>('/api/settings/theme', {
      method: 'PUT',
      body: JSON.stringify(theme),
    });
  },

  saveCompany(profile: RestaurantProfile) {
    return request<{ success: boolean }>('/api/settings/company', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  },

  resetDefaults() {
    return request<{ success: boolean }>('/api/admin/reset-defaults', {
      method: 'POST',
    });
  },
};
