import nodemailer from 'nodemailer';
import { pool, isDatabaseReady, memoryStore } from './db.ts';

export const SENDER_EMAIL = process.env.SMTP_USER || 'enyewmekete65@gmail.com';
export const SENDER_PHONE = process.env.SMS_SENDER_PHONE || '+251943305937';

/**
 * Generates a 7-character mixed temporary password:
 * Capital, small, number, and special character
 */
export function generate7DigitMixedPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const specials = '@#$%&*!';

  const required = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];

  const allPool = uppercase + lowercase + numbers + specials;
  for (let i = 0; i < 3; i++) {
    required.push(allPool[Math.floor(Math.random() * allPool.length)]);
  }

  return required.sort(() => 0.5 - Math.random()).join('');
}

export function generate6DigitOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function validatePasswordStrength(password: string) {
  const hasLength = password.length >= 8;
  const hasCapital = /[A-Z]/.test(password);
  const hasSmall = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [hasLength, hasCapital, hasSmall, hasNumber, hasSpecial].filter(Boolean).length;
  return {
    hasLength,
    hasCapital,
    hasSmall,
    hasNumber,
    hasSpecial,
    score,
    isValid: hasLength && hasCapital && hasSmall && hasNumber && hasSpecial,
  };
}

export async function dispatchNotification(params: {
  toEmail: string;
  toPhone?: string;
  subject: string;
  emailBody: string;
  smsBody: string;
  logMessage: string;
  type: 'welcome_credentials' | 'password_reset' | 'otp';
}) {
  let emailSent = false;
  let smsSent = false;

  // 1. Send Real Email via SMTP if App Password is configured
  const smtpPass = process.env.SMTP_APP_PASSWORD;
  if (smtpPass && smtpPass.trim() !== '') {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: SENDER_EMAIL,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"QR Code - Enyew M." <${SENDER_EMAIL}>`,
        to: params.toEmail,
        subject: params.subject,
        text: params.emailBody,
      });
      emailSent = true;
    } catch (err) {
      console.error('[Mailer] Failed to send SMTP email:', err);
    }
  } else {
    console.info(`[Mailer] SMTP_APP_PASSWORD not set. Recorded email dispatch to ${params.toEmail}: ${params.subject}`);
  }

  // 2. Send Real SMS if Ethiopian SMS Gateway URL is configured
  const smsProviderUrl = process.env.SMS_PROVIDER_URL;
  if (smsProviderUrl && smsProviderUrl.trim() !== '' && params.toPhone) {
    try {
      const response = await fetch(smsProviderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SMS_API_KEY
            ? { Authorization: `Bearer ${process.env.SMS_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          from: SENDER_PHONE,
          to: params.toPhone,
          message: params.smsBody,
        }),
      });
      smsSent = response.ok;
    } catch (err) {
      console.error('[SMS] Failed to dispatch SMS gateway webhook:', err);
    }
  } else if (params.toPhone) {
    console.info(`[SMS] Recorded SMS dispatch from ${SENDER_PHONE} to ${params.toPhone}`);
  }

  const logRecord = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    fromEmail: SENDER_EMAIL,
    fromPhone: SENDER_PHONE,
    toEmail: params.toEmail,
    toPhone: params.toPhone || '',
    subject: params.subject,
    message: params.logMessage,
    type: params.type,
    status: emailSent || smsSent ? 'delivered' : 'sent',
  };

  if (isDatabaseReady) {
    try {
      await pool.query(
        `INSERT INTO notification_logs (id, timestamp, from_email, from_phone, to_email, to_phone, subject, message, type, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          logRecord.id,
          logRecord.timestamp,
          logRecord.fromEmail,
          logRecord.fromPhone,
          logRecord.toEmail,
          logRecord.toPhone,
          logRecord.subject,
          logRecord.message,
          logRecord.type,
          logRecord.status,
        ]
      );
    } catch (err) {
      console.error('[DB] Failed to insert notification_log:', err);
    }
  } else {
    memoryStore.notificationLogs.unshift({
      id: logRecord.id,
      timestamp: logRecord.timestamp,
      from_email: logRecord.fromEmail,
      from_phone: logRecord.fromPhone,
      to_email: logRecord.toEmail,
      to_phone: logRecord.toPhone,
      subject: logRecord.subject,
      message: logRecord.message,
      type: logRecord.type,
      status: logRecord.status,
    });
    memoryStore.notificationLogs = memoryStore.notificationLogs.slice(0, 100);
  }

  return logRecord;
}
