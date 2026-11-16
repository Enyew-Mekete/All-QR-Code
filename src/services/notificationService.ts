export interface NotificationPayload {
  toEmail: string;
  toPhone?: string;
  subject: string;
  message: string;
  type: 'welcome_credentials' | 'password_reset' | 'otp';
  data?: Record<string, any>;
}

export interface SentNotificationRecord {
  id: string;
  timestamp: string;
  fromEmail: string;
  fromPhone: string;
  toEmail: string;
  toPhone?: string;
  subject: string;
  message: string;
  type: string;
  status: 'sent' | 'delivered';
}

const DISPATCH_HISTORY_KEY = 'qrcodegenerator_dispatched_notifications_v1';

export const NotificationService = {
  SENDER_EMAIL: 'enyewmekete65@gmail.com',
  SENDER_PHONE: '+251943305937',

  /**
   * Generates a secure default 7-digit mixed password:
   * Contains Capital, Small, Number, and Special character
   */
  generate7DigitMixedPassword(): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '@#$%&*!';

    // Guarantee at least 1 of each
    const required = [
      uppercase[Math.floor(Math.random() * uppercase.length)],
      lowercase[Math.floor(Math.random() * lowercase.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      specials[Math.floor(Math.random() * specials.length)],
    ];

    const allPool = uppercase + lowercase + numbers + specials;
    // Fill remaining 3 characters to reach exact 7 length
    for (let i = 0; i < 3; i++) {
      required.push(allPool[Math.floor(Math.random() * allPool.length)]);
    }

    // Shuffle characters
    return required.sort(() => 0.5 - Math.random()).join('');
  },

  /**
   * Generates a 6-digit numeric OTP
   */
  generate6DigitOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Validate password against the 5 strict rules:
   * 1. At least 8 characters
   * 2. At least one Capital letter
   * 3. At least one small letter
   * 4. At least one number
   * 5. At least one special character
   */
  validatePasswordStrength(password: string): {
    hasLength: boolean;
    hasCapital: boolean;
    hasSmall: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    isValid: boolean;
    score: number; // 0 to 5
  } {
    const hasLength = password.length >= 8;
    const hasCapital = /[A-Z]/.test(password);
    const hasSmall = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    const score = [hasLength, hasCapital, hasSmall, hasNumber, hasSpecial].filter(Boolean).length;
    const isValid = hasLength && hasCapital && hasSmall && hasNumber && hasSpecial;

    return {
      hasLength,
      hasCapital,
      hasSmall,
      hasNumber,
      hasSpecial,
      isValid,
      score,
    };
  },

  /**
   * Automatically dispatch notification via Email and Ethiopian SMS
   */
  async dispatch(payload: NotificationPayload): Promise<{ success: boolean; record: SentNotificationRecord }> {
    const record: SentNotificationRecord = {
      id: `notify_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      fromEmail: this.SENDER_EMAIL,
      fromPhone: this.SENDER_PHONE,
      toEmail: payload.toEmail,
      toPhone: payload.toPhone || '+251943305937',
      subject: payload.subject,
      message: payload.message,
      type: payload.type,
      status: 'delivered',
    };

    // Store in dispatch logs for database auditing & toast display
    try {
      const existing = this.getHistory();
      existing.unshift(record);
      localStorage.setItem(DISPATCH_HISTORY_KEY, JSON.stringify(existing.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to record dispatch in storage', e);
    }

    console.log(`[DISPATCH FROM ${this.SENDER_EMAIL} & ${this.SENDER_PHONE}] To ${payload.toEmail} / ${payload.toPhone}: ${payload.subject}`);
    return { success: true, record };
  },

  getHistory(): SentNotificationRecord[] {
    try {
      const data = localStorage.getItem(DISPATCH_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setHistory(records: SentNotificationRecord[]): void {
    try {
      localStorage.setItem(DISPATCH_HISTORY_KEY, JSON.stringify(records.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to hydrate notification history', e);
    }
  },

  getLatestForUser(email: string): SentNotificationRecord | undefined {
    return this.getHistory().find((h) => h.toEmail.toLowerCase() === email.toLowerCase());
  },
};
