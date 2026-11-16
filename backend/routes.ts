import express from 'express';
import {
  pool,
  isDatabaseReady,
  seedInitialData,
  memoryStore,
  resetMemoryStore,
} from './db.ts';
import {
  dispatchNotification,
  generate6DigitOTP,
  generate7DigitMixedPassword,
  validatePasswordStrength,
} from './mailer.ts';
import { INITIAL_THEMES } from '../src/data/systemDefaults.ts';
import { INITIAL_RESTAURANT } from '../src/data/initialData.ts';

export const apiRouter = express.Router();

// Helper mappers between snake_case DB rows and camelCase frontend models
function mapUserRow(row: any, includePassword = false) {
  const user: any = {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    role: row.role_id,
    mustChangePassword: Boolean(row.must_change_password),
    otpEnabled: Boolean(row.otp_enabled),
    status: row.status || 'active',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
  if (includePassword) {
    user.password = row.password;
  }
  return user;
}

function mapRoleRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    isSystem: Boolean(row.is_system),
    privileges: row.privileges,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}

function mapCategoryRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon || 'Globe',
    description: row.description || '',
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}

function mapQRRow(row: any) {
  const expiresAt = row.expires_at ? new Date(row.expires_at).toISOString() : null;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
  return {
    id: row.id,
    restaurantId: row.restaurant_id || 'company_qr_01',
    categoryId: row.category_id || undefined,
    title: row.title,
    description: row.description || undefined,
    ctaLabel: row.cta_label || undefined,
    type: row.type,
    targetUrl: row.target_url,
    tableNumber: row.table_number ?? undefined,
    shortUrl: row.short_url || '',
    scansCount: Number(row.scans_count || 0),
    lastScanAt: row.last_scan_at ? new Date(row.last_scan_at).toISOString() : undefined,
    status: row.status || 'active',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    expiresAt,
    isExpired,
    styling: row.styling,
    welcomeScreen: row.welcome_screen || undefined,
    uploadedFiles: Array.isArray(row.uploaded_files) ? row.uploaded_files : [],
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}

function mapScanRow(row: any) {
  return {
    id: row.id,
    qrId: row.qr_id,
    qrTitle: row.qr_title,
    timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
    device: row.device || 'Desktop',
    city: row.city || 'Addis Ababa, ET',
    referrer: row.referrer || undefined,
  };
}

function mapOTPRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    phone: row.phone || '',
    code: row.code,
    type: row.type || 'login',
    sentVia: row.sent_via || ['email', 'sms'],
    expiresAt: new Date(row.expires_at).toISOString(),
    used: Boolean(row.used),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapNotificationRow(row: any) {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp).toISOString(),
    fromEmail: row.from_email,
    fromPhone: row.from_phone,
    toEmail: row.to_email,
    toPhone: row.to_phone,
    subject: row.subject,
    message: row.message,
    type: row.type,
    status: row.status,
  };
}

apiRouter.get('/health', async (_req, res) => {
  try {
    if (!isDatabaseReady) {
      return res.json({ ok: true, database: 'In-Memory Store (Fallback)' });
    }
    await pool.query('SELECT 1');
    return res.json({ ok: true, database: 'QR Code Generator (PostgreSQL)' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'DB error' });
  }
});

// ==================== BOOTSTRAP ====================
apiRouter.get('/bootstrap', async (_req, res) => {
  try {
    if (!isDatabaseReady) {
      return res.json({
        success: true,
        roles: memoryStore.roles.map(mapRoleRow),
        users: memoryStore.users.map((u) => mapUserRow(u, false)),
        categories: [...memoryStore.categories]
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map(mapCategoryRow),
        qrCodes: [...memoryStore.qrCodes]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(mapQRRow),
        scanEvents: memoryStore.scanEvents.slice(0, 300).map(mapScanRow),
        otps: memoryStore.otps.slice(0, 50).map(mapOTPRow),
        notifications: memoryStore.notificationLogs.slice(0, 100).map(mapNotificationRow),
        theme: memoryStore.appSettings.theme || INITIAL_THEMES[0],
        restaurant: memoryStore.appSettings.company_profile || INITIAL_RESTAURANT,
      });
    }

    const [rolesRes, usersRes, catsRes, qrsRes, scansRes, otpsRes, logsRes, settingsRes] =
      await Promise.all([
        pool.query('SELECT * FROM roles ORDER BY created_at ASC'),
        pool.query('SELECT * FROM users ORDER BY created_at ASC'),
        pool.query('SELECT * FROM categories ORDER BY display_order ASC, created_at ASC'),
        pool.query('SELECT * FROM qr_codes ORDER BY created_at DESC'),
        pool.query('SELECT * FROM scan_events ORDER BY timestamp DESC LIMIT 300'),
        pool.query('SELECT * FROM otps ORDER BY created_at DESC LIMIT 50'),
        pool.query('SELECT * FROM notification_logs ORDER BY timestamp DESC LIMIT 100'),
        pool.query('SELECT key, value FROM app_settings'),
      ]);

    const settingsMap: Record<string, any> = {};
    for (const row of settingsRes.rows) {
      settingsMap[row.key] = row.value;
    }

    return res.json({
      success: true,
      roles: rolesRes.rows.map(mapRoleRow),
      users: usersRes.rows.map((u) => mapUserRow(u, false)),
      categories: catsRes.rows.map(mapCategoryRow),
      qrCodes: qrsRes.rows.map(mapQRRow),
      scanEvents: scansRes.rows.map(mapScanRow),
      otps: otpsRes.rows.map(mapOTPRow),
      notifications: logsRes.rows.map(mapNotificationRow),
      theme: settingsMap.theme || INITIAL_THEMES[0],
      restaurant: settingsMap.company_profile || INITIAL_RESTAURANT,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Bootstrap failed' });
  }
});

// ==================== AUTH & OTP ====================
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    const trimmed = String(identifier || '').trim().toLowerCase();
    if (!trimmed || !password) {
      return res.status(400).json({ success: false, error: 'Username/email and password are required.' });
    }

    let userRow: any;
    if (!isDatabaseReady) {
      userRow = memoryStore.users.find(
        (u) => !u.deleted_at && (u.email.toLowerCase() === trimmed || u.name.toLowerCase() === trimmed)
      );
    } else {
      const { rows } = await pool.query(
        `SELECT * FROM users
         WHERE deleted_at IS NULL AND (LOWER(email) = $1 OR LOWER(name) = $1)
         LIMIT 1`,
        [trimmed]
      );
      userRow = rows[0];
    }

    if (!userRow) {
      return res.status(401).json({ success: false, error: 'Invalid username or password. Please verify your credentials.' });
    }
    if (userRow.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'This account has been suspended. Please contact your administrator.' });
    }
    if (userRow.password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid username or password. Please verify your credentials.' });
    }

    const user = mapUserRow(userRow, false);

    if (user.otpEnabled) {
      const code = generate6DigitOTP();
      const otpId = `otp_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      if (!isDatabaseReady) {
        memoryStore.otps.unshift({
          id: otpId,
          user_id: user.id,
          email: user.email,
          phone: user.phone || '',
          code,
          type: 'login',
          sent_via: ['email', 'sms'],
          expires_at: expiresAt,
          used: false,
          created_at: new Date().toISOString(),
        });
      } else {
        await pool.query(
          `INSERT INTO otps (id, user_id, email, phone, code, type, sent_via, expires_at, used, created_at)
           VALUES ($1,$2,$3,$4,$5,'login','["email","sms"]'::jsonb,$6,false,NOW())`,
          [otpId, user.id, user.email, user.phone || '', code, expiresAt]
        );
      }

      await dispatchNotification({
        toEmail: user.email,
        toPhone: user.phone,
        subject: `Your QR Code Generator Verification Code: ${code}`,
        emailBody: `Dear ${user.name},\n\nYour one-time verification code is: ${code}\nThis code expires in 10 minutes.\n\nPowered By Enyew M.`,
        smsBody: `QR Code OTP: ${code}. Valid for 10 mins.`,
        logMessage: `6-digit login OTP dispatched to ${user.email} and ${user.phone || 'registered phone'}.`,
        type: 'otp',
      });

      return res.json({
        success: true,
        step: 'otp',
        user,
        otpPreview: process.env.SMTP_APP_PASSWORD ? undefined : code,
      });
    }

    if (user.mustChangePassword) {
      return res.json({ success: true, step: 'force_password_change', user });
    }

    if (!isDatabaseReady) {
      userRow.last_login_at = new Date().toISOString();
    } else {
      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    }
    return res.json({ success: true, step: 'authenticated', user });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Login failed' });
  }
});

apiRouter.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedCode = String(code || '').trim();

    if (!isDatabaseReady) {
      const otpRow = memoryStore.otps.find(
        (o) =>
          o.email.toLowerCase() === trimmedEmail &&
          o.code === trimmedCode &&
          !o.used &&
          new Date(o.expires_at).getTime() > Date.now()
      );
      if (!otpRow) {
        return res.status(400).json({ success: false, error: 'Invalid or expired OTP code. Please request a new one.' });
      }
      otpRow.used = true;
      const userRow = memoryStore.users.find((u) => !u.deleted_at && u.email.toLowerCase() === trimmedEmail);
      if (!userRow) return res.status(404).json({ success: false, error: 'User account not found.' });
      const user = mapUserRow(userRow, false);
      if (user.mustChangePassword) {
        return res.json({ success: true, step: 'force_password_change', user });
      }
      userRow.last_login_at = new Date().toISOString();
      return res.json({ success: true, step: 'authenticated', user });
    }

    const { rows } = await pool.query(
      `SELECT * FROM otps
       WHERE LOWER(email) = $1 AND code = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [trimmedEmail, trimmedCode]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP code. Please request a new one.' });
    }

    await pool.query('UPDATE otps SET used = true WHERE id = $1', [rows[0].id]);

    const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 AND deleted_at IS NULL LIMIT 1', [trimmedEmail]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }
    const user = mapUserRow(userRes.rows[0], false);

    if (user.mustChangePassword) {
      return res.json({ success: true, step: 'force_password_change', user });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    return res.json({ success: true, step: 'authenticated', user });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'OTP verification failed' });
  }
});

apiRouter.post('/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();

    let userRow: any;
    if (!isDatabaseReady) {
      userRow = memoryStore.users.find((u) => !u.deleted_at && u.email.toLowerCase() === trimmedEmail);
    } else {
      const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 AND deleted_at IS NULL LIMIT 1', [trimmedEmail]);
      userRow = userRes.rows[0];
    }

    if (!userRow) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    const user = mapUserRow(userRow, false);
    const code = generate6DigitOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (!isDatabaseReady) {
      memoryStore.otps.unshift({
        id: `otp_${Date.now()}`,
        user_id: user.id,
        email: user.email,
        phone: user.phone || '',
        code,
        type: 'login',
        sent_via: ['email', 'sms'],
        expires_at: expiresAt,
        used: false,
        created_at: new Date().toISOString(),
      });
    } else {
      await pool.query(
        `INSERT INTO otps (id, user_id, email, phone, code, type, sent_via, expires_at, used, created_at)
         VALUES ($1,$2,$3,$4,$5,'login','["email","sms"]'::jsonb,$6,false,NOW())`,
        [`otp_${Date.now()}`, user.id, user.email, user.phone || '', code, expiresAt]
      );
    }

    await dispatchNotification({
      toEmail: user.email,
      toPhone: user.phone,
      subject: `Your QR Code Generator Verification Code: ${code}`,
      emailBody: `Dear ${user.name},\n\nYour new OTP verification code is: ${code}\nValid for 10 minutes.\n\nPowered By Enyew M.`,
      smsBody: `QR Code OTP: ${code}. Valid for 10 mins.`,
      logMessage: `Resent 6-digit login OTP to ${user.email} and ${user.phone || 'registered phone'}.`,
      type: 'otp',
    });

    return res.json({
      success: true,
      otpPreview: process.env.SMTP_APP_PASSWORD ? undefined : code,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Resend OTP failed' });
  }
});

apiRouter.post('/auth/change-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body || {};
    const strength = validatePasswordStrength(String(newPassword || ''));
    if (!strength.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters and include 1 Capital, 1 Small, 1 Number, and 1 Special character.',
      });
    }

    if (!isDatabaseReady) {
      const userRow = memoryStore.users.find((u) => u.id === userId && !u.deleted_at);
      if (!userRow) return res.status(404).json({ success: false, error: 'User not found.' });
      userRow.password = newPassword;
      userRow.must_change_password = false;
      userRow.last_login_at = new Date().toISOString();
      return res.json({ success: true, user: mapUserRow(userRow, false) });
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET password = $1, must_change_password = false, last_login_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [newPassword, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.json({ success: true, user: mapUserRow(rows[0], false) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Password change failed' });
  }
});

// ==================== USERS MANAGEMENT ====================
apiRouter.post('/users', async (req, res) => {
  try {
    const { name, email, phone, role, otpEnabled } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedName = String(name || '').trim();
    const trimmedPhone = String(phone || '').trim() || '+251943305937';

    if (!trimmedName || !trimmedEmail) {
      return res.status(400).json({ success: false, error: 'Full Name and Email are required.' });
    }

    const tempPassword = generate7DigitMixedPassword();
    const id = `usr_${Date.now()}`;
    const otpFlag = otpEnabled !== undefined ? Boolean(otpEnabled) : true;

    let createdRow: any;
    if (!isDatabaseReady) {
      const existing = memoryStore.users.find((u) => !u.deleted_at && u.email.toLowerCase() === trimmedEmail);
      if (existing) {
        return res.status(409).json({ success: false, error: 'A user with this email already exists in QR Code Generator.' });
      }
      createdRow = {
        id,
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        role_id: role || 'admin',
        password: tempPassword,
        must_change_password: true,
        otp_enabled: otpFlag,
        status: 'active',
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      memoryStore.users.push(createdRow);
    } else {
      const existing = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 AND deleted_at IS NULL',
        [trimmedEmail]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'A user with this email already exists in QR Code Generator.' });
      }
      const { rows } = await pool.query(
        `INSERT INTO users (id, name, email, phone, role_id, password, must_change_password, otp_enabled, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,'active',NOW())
         RETURNING *`,
        [id, trimmedName, trimmedEmail, trimmedPhone, role || 'admin', tempPassword, otpFlag]
      );
      createdRow = rows[0];
    }

    await dispatchNotification({
      toEmail: trimmedEmail,
      toPhone: trimmedPhone,
      subject: 'Welcome to QR Code Generator - Your Account Credentials',
      emailBody: `Dear ${trimmedName},\n\nYour account in QR Code Generator has been created.\n\nUsername / Email: ${trimmedEmail}\nTemporary Password: ${tempPassword}\n\nPlease sign in and set your permanent password immediately.\n\nPowered By Enyew M.`,
      smsBody: `QR Code Account Created. Username: ${trimmedEmail}, Temp Password: ${tempPassword}. Change password after login.`,
      logMessage: `Account credentials dispatched to ${trimmedEmail} & SMS ${trimmedPhone}.`,
      type: 'welcome_credentials',
    });

    return res.json({
      success: true,
      user: mapUserRow(createdRow, false),
      message: 'The user has Created Successfully and sent via that user email address',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create user' });
  }
});

apiRouter.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, status, otpEnabled } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedName = String(name || '').trim();

    if (!trimmedName || !trimmedEmail) {
      return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }

    if (!isDatabaseReady) {
      const dup = memoryStore.users.find((u) => !u.deleted_at && u.email.toLowerCase() === trimmedEmail && u.id !== id);
      if (dup) return res.status(409).json({ success: false, error: 'Another active user already uses this email.' });
      const target = memoryStore.users.find((u) => u.id === id && !u.deleted_at);
      if (!target) return res.status(404).json({ success: false, error: 'User not found.' });
      target.name = trimmedName;
      target.email = trimmedEmail;
      target.phone = String(phone || '').trim();
      target.role_id = role || 'admin';
      target.status = status === 'suspended' ? 'suspended' : 'active';
      target.otp_enabled = Boolean(otpEnabled);
      return res.json({ success: true, user: mapUserRow(target, false) });
    }

    const dup = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 AND deleted_at IS NULL',
      [trimmedEmail, id]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Another active user already uses this email.' });
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET name = $1,
           email = $2,
           phone = $3,
           role_id = $4,
           status = $5,
           otp_enabled = $6
       WHERE id = $7 AND deleted_at IS NULL
       RETURNING *`,
      [
        trimmedName,
        trimmedEmail,
        String(phone || '').trim(),
        role || 'admin',
        status === 'suspended' ? 'suspended' : 'active',
        Boolean(otpEnabled),
        id,
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.json({ success: true, user: mapUserRow(rows[0], false) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update user' });
  }
});

apiRouter.post('/users/:id/toggle-otp', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isDatabaseReady) {
      const target = memoryStore.users.find((u) => u.id === id && !u.deleted_at);
      if (!target) return res.status(404).json({ success: false, error: 'User not found.' });
      target.otp_enabled = !target.otp_enabled;
      return res.json({ success: true, user: mapUserRow(target, false) });
    }
    const { rows } = await pool.query(
      `UPDATE users SET otp_enabled = NOT otp_enabled WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found.' });
    return res.json({ success: true, user: mapUserRow(rows[0], false) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to toggle OTP' });
  }
});

apiRouter.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const tempPassword = generate7DigitMixedPassword();

    let user: any;
    if (!isDatabaseReady) {
      const target = memoryStore.users.find((u) => u.id === id && !u.deleted_at);
      if (!target) return res.status(404).json({ success: false, error: 'User not found.' });
      target.password = tempPassword;
      target.must_change_password = true;
      user = target;
    } else {
      const { rows } = await pool.query(
        `UPDATE users SET password = $1, must_change_password = true WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
        [tempPassword, id]
      );
      if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found.' });
      user = rows[0];
    }

    await dispatchNotification({
      toEmail: user.email,
      toPhone: user.phone,
      subject: 'QR Code Generator - Password Reset',
      emailBody: `Dear ${user.name},\n\nYour password has been reset.\n\nUsername / Email: ${user.email}\nNew Temporary Password: ${tempPassword}\n\nYou will be required to set a strong permanent password on your next sign in.\n\nPowered By Enyew M.`,
      smsBody: `QR Code Password Reset. Username: ${user.email}, Temp Password: ${tempPassword}.`,
      logMessage: `Temporary reset password dispatched to ${user.email} & SMS ${user.phone || 'registered phone'}.`,
      type: 'password_reset',
    });

    return res.json({
      success: true,
      message: 'The password has Reset Successfully and sent via that user email address',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to reset password' });
  }
});

apiRouter.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isDatabaseReady) {
      const target = memoryStore.users.find((u) => u.id === id && !u.deleted_at);
      if (!target) return res.status(404).json({ success: false, error: 'User not found.' });
      if (target.role_id === 'super_admin') {
        const activeSupers = memoryStore.users.filter((u) => u.role_id === 'super_admin' && !u.deleted_at);
        if (activeSupers.length <= 1) {
          return res.status(400).json({ success: false, error: 'Cannot delete the only active Super Admin.' });
        }
      }
      target.deleted_at = new Date().toISOString();
      return res.json({ success: true });
    }

    const targetRes = await pool.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    if (targetRes.rows[0].role_id === 'super_admin') {
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS count FROM users WHERE role_id = 'super_admin' AND deleted_at IS NULL`
      );
      if (countRes.rows[0].count <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot delete the only active Super Admin.' });
      }
    }

    await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to delete user' });
  }
});

apiRouter.post('/users/:id/restore', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      const target = memoryStore.users.find((u) => u.id === req.params.id);
      if (!target) return res.status(404).json({ success: false, error: 'User not found.' });
      target.deleted_at = null;
      return res.json({ success: true, user: mapUserRow(target, false) });
    }
    const { rows } = await pool.query(
      'UPDATE users SET deleted_at = NULL WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found.' });
    return res.json({ success: true, user: mapUserRow(rows[0], false) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Restore failed' });
  }
});

// ==================== ROLES ====================
apiRouter.post('/roles', async (req, res) => {
  try {
    const { name, description, privileges } = req.body || {};
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return res.status(400).json({ success: false, error: 'Role name is required.' });

    if (!isDatabaseReady) {
      const existing = memoryStore.roles.find((r) => !r.deleted_at && r.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) return res.status(409).json({ success: false, error: 'A role with this name already exists.' });
      const created = {
        id: `role_${Date.now()}`,
        name: trimmedName,
        description: description || '',
        is_system: false,
        privileges: privileges || {},
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      memoryStore.roles.push(created);
      return res.json({ success: true, role: mapRoleRow(created) });
    }

    const existing = await pool.query(
      'SELECT id FROM roles WHERE LOWER(name) = $1 AND deleted_at IS NULL',
      [trimmedName.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'A role with this name already exists.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO roles (id, name, description, is_system, privileges, created_at)
       VALUES ($1,$2,$3,false,$4::jsonb,NOW()) RETURNING *`,
      [`role_${Date.now()}`, trimmedName, description || '', JSON.stringify(privileges || {})]
    );
    return res.json({ success: true, role: mapRoleRow(rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Create role failed' });
  }
});

apiRouter.put('/roles/:id', async (req, res) => {
  try {
    const { name, description, privileges } = req.body || {};
    if (!isDatabaseReady) {
      const target = memoryStore.roles.find((r) => r.id === req.params.id && !r.deleted_at);
      if (!target) return res.status(404).json({ success: false, error: 'Role not found.' });
      target.name = String(name || '').trim();
      target.description = description || '';
      target.privileges = privileges || {};
      return res.json({ success: true, role: mapRoleRow(target) });
    }
    const { rows } = await pool.query(
      `UPDATE roles SET name = $1, description = $2, privileges = $3::jsonb
       WHERE id = $4 AND deleted_at IS NULL RETURNING *`,
      [String(name || '').trim(), description || '', JSON.stringify(privileges || {}), req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Role not found.' });
    return res.json({ success: true, role: mapRoleRow(rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Update role failed' });
  }
});

apiRouter.delete('/roles/:id', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      const target = memoryStore.roles.find((r) => r.id === req.params.id && !r.deleted_at);
      if (!target) return res.status(404).json({ success: false, error: 'Role not found.' });
      if (target.is_system || req.params.id === 'super_admin') {
        return res.status(400).json({ success: false, error: 'Cannot delete the Super Admin system role.' });
      }
      target.deleted_at = new Date().toISOString();
      return res.json({ success: true });
    }
    const check = await pool.query('SELECT is_system FROM roles WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: 'Role not found.' });
    if (check.rows[0].is_system || req.params.id === 'super_admin') {
      return res.status(400).json({ success: false, error: 'Cannot delete the Super Admin system role.' });
    }
    await pool.query('UPDATE roles SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Delete role failed' });
  }
});

apiRouter.post('/roles/:id/restore', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      const target = memoryStore.roles.find((r) => r.id === req.params.id);
      if (target) target.deleted_at = null;
      return res.json({ success: true });
    }
    await pool.query('UPDATE roles SET deleted_at = NULL WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Restore role failed' });
  }
});

// ==================== CATEGORIES ====================
apiRouter.post('/categories', async (req, res) => {
  try {
    const { name, icon, description, displayOrder } = req.body || {};
    const trimmed = String(name || '').trim();
    if (!trimmed) return res.status(400).json({ success: false, error: 'Category name is required.' });
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!isDatabaseReady) {
      const existing = memoryStore.categories.find((c) => !c.deleted_at && c.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return res.status(409).json({ success: false, error: 'A category with this name already exists.' });
      const created = {
        id: `cat_${Date.now()}`,
        name: trimmed,
        slug,
        icon: icon || 'Globe',
        description: description || '',
        display_order: displayOrder ?? 1,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      memoryStore.categories.push(created);
      return res.json({ success: true, category: mapCategoryRow(created) });
    }

    const existing = await pool.query(
      'SELECT id FROM categories WHERE LOWER(name) = $1 AND deleted_at IS NULL',
      [trimmed.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'A category with this name already exists.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO categories (id, name, slug, icon, description, display_order, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [`cat_${Date.now()}`, trimmed, slug, icon || 'Globe', description || '', displayOrder ?? 1]
    );
    return res.json({ success: true, category: mapCategoryRow(rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Create category failed' });
  }
});

apiRouter.put('/categories/:id', async (req, res) => {
  try {
    const { name, icon, description, displayOrder } = req.body || {};
    const trimmed = String(name || '').trim();
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!isDatabaseReady) {
      const target = memoryStore.categories.find((c) => c.id === req.params.id && !c.deleted_at);
      if (!target) return res.status(404).json({ success: false, error: 'Category not found.' });
      target.name = trimmed;
      target.slug = slug;
      target.icon = icon || 'Globe';
      target.description = description || '';
      target.display_order = displayOrder ?? 1;
      return res.json({ success: true, category: mapCategoryRow(target) });
    }

    const { rows } = await pool.query(
      `UPDATE categories SET name = $1, slug = $2, icon = $3, description = $4, display_order = $5
       WHERE id = $6 AND deleted_at IS NULL RETURNING *`,
      [trimmed, slug, icon || 'Globe', description || '', displayOrder ?? 1, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Category not found.' });
    return res.json({ success: true, category: mapCategoryRow(rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Update category failed' });
  }
});

apiRouter.delete('/categories/:id', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      const target = memoryStore.categories.find((c) => c.id === req.params.id);
      if (target) target.deleted_at = new Date().toISOString();
      return res.json({ success: true });
    }
    await pool.query('UPDATE categories SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Delete category failed' });
  }
});

apiRouter.post('/categories/:id/restore', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      const target = memoryStore.categories.find((c) => c.id === req.params.id);
      if (target) target.deleted_at = null;
      return res.json({ success: true });
    }
    await pool.query('UPDATE categories SET deleted_at = NULL WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Restore category failed' });
  }
});

// ==================== QR CODES & SCANS ====================
apiRouter.post('/qr-codes', async (req, res) => {
  try {
    const qr = req.body || {};
    if (!isDatabaseReady) {
      const row = {
        id: qr.id || `qr_${Date.now()}`,
        restaurant_id: qr.restaurantId || 'company_qr_01',
        category_id: qr.categoryId || null,
        title: qr.title || 'Dynamic QR Code',
        description: qr.description || '',
        cta_label: qr.ctaLabel || 'See More',
        type: qr.type || 'website',
        target_url: qr.targetUrl || '',
        table_number: qr.tableNumber ?? null,
        short_url: qr.shortUrl || '',
        scans_count: Number(qr.scansCount || 0),
        status: qr.status || 'active',
        created_at: qr.createdAt || new Date().toISOString(),
        expires_at: qr.expiresAt || null,
        styling: qr.styling || {},
        welcome_screen: qr.welcomeScreen || null,
        uploaded_files: Array.isArray(qr.uploadedFiles) ? qr.uploadedFiles : [],
        deleted_at: null,
      };
      memoryStore.qrCodes.unshift(row);
      return res.json({ success: true, qrCode: mapQRRow(row) });
    }

    const { rows } = await pool.query(
      `INSERT INTO qr_codes (id, restaurant_id, category_id, title, description, cta_label, type, target_url, table_number, short_url, scans_count, status, created_at, expires_at, styling, welcome_screen, uploaded_files)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb)
       RETURNING *`,
      [
        qr.id || `qr_${Date.now()}`,
        qr.restaurantId || 'company_qr_01',
        qr.categoryId || null,
        qr.title || 'Dynamic QR Code',
        qr.description || '',
        qr.ctaLabel || 'See More',
        qr.type || 'website',
        qr.targetUrl || '',
        qr.tableNumber ?? null,
        qr.shortUrl || '',
        Number(qr.scansCount || 0),
        qr.status || 'active',
        qr.createdAt || new Date().toISOString(),
        qr.expiresAt || null,
        JSON.stringify(qr.styling || {}),
        qr.welcomeScreen ? JSON.stringify(qr.welcomeScreen) : null,
        JSON.stringify(Array.isArray(qr.uploadedFiles) ? qr.uploadedFiles : []),
      ]
    );
    return res.json({ success: true, qrCode: mapQRRow(rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Create QR failed' });
  }
});

apiRouter.put('/qr-codes/:id', async (req, res) => {
  try {
    const qr = req.body || {};
    if (!isDatabaseReady) {
      const target = memoryStore.qrCodes.find((q) => q.id === req.params.id && !q.deleted_at);
      if (!target) return res.status(404).json({ success: false, error: 'QR Code not found.' });
      target.category_id = qr.categoryId || null;
      target.title = qr.title;
      target.description = qr.description || '';
      target.cta_label = qr.ctaLabel || 'See More';
      target.type = qr.type;
      target.target_url = qr.targetUrl || '';
      target.table_number = qr.tableNumber ?? null;
      target.short_url = qr.shortUrl || '';
      target.status = qr.status || 'active';
      target.expires_at = qr.expiresAt || null;
      target.styling = qr.styling || {};
      target.welcome_screen = qr.welcomeScreen || null;
      target.uploaded_files = Array.isArray(qr.uploadedFiles) ? qr.uploadedFiles : [];
      return res.json({ success: true, qrCode: mapQRRow(target) });
    }

    const { rows } = await pool.query(
      `UPDATE qr_codes
       SET category_id = $1,
           title = $2,
           description = $3,
           cta_label = $4,
           type = $5,
           target_url = $6,
           table_number = $7,
           short_url = $8,
           status = $9,
           expires_at = $10,
           styling = $11::jsonb,
           welcome_screen = $12::jsonb,
           uploaded_files = $13::jsonb
       WHERE id = $14 AND deleted_at IS NULL
       RETURNING *`,
      [
        qr.categoryId || null,
        qr.title,
        qr.description || '',
        qr.ctaLabel || 'See More',
        qr.type,
        qr.targetUrl || '',
        qr.tableNumber ?? null,
        qr.shortUrl || '',
        qr.status || 'active',
        qr.expiresAt || null,
        JSON.stringify(qr.styling || {}),
        qr.welcomeScreen ? JSON.stringify(qr.welcomeScreen) : null,
        JSON.stringify(Array.isArray(qr.uploadedFiles) ? qr.uploadedFiles : []),
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'QR Code not found.' });
    return res.json({ success: true, qrCode: mapQRRow(rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Update QR failed' });
  }
});

apiRouter.delete('/qr-codes/:id', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      const target = memoryStore.qrCodes.find((q) => q.id === req.params.id);
      if (target) target.deleted_at = new Date().toISOString();
      return res.json({ success: true });
    }
    await pool.query('UPDATE qr_codes SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Delete QR failed' });
  }
});

apiRouter.post('/qr-codes/:id/restore', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      const target = memoryStore.qrCodes.find((q) => q.id === req.params.id);
      if (target) target.deleted_at = null;
      return res.json({ success: true });
    }
    await pool.query('UPDATE qr_codes SET deleted_at = NULL WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Restore QR failed' });
  }
});

apiRouter.post('/qr-codes/:id/scan', async (req, res) => {
  try {
    const { device } = req.body || {};
    if (!isDatabaseReady) {
      const qr = memoryStore.qrCodes.find((q) => q.id === req.params.id && !q.deleted_at);
      if (!qr) return res.status(404).json({ success: false, error: 'QR Code not found.' });
      qr.scans_count = Number(qr.scans_count || 0) + 1;
      qr.last_scan_at = new Date().toISOString();
      memoryStore.scanEvents.unshift({
        id: `scan_${Date.now()}`,
        qr_id: qr.id,
        qr_title: qr.title,
        timestamp: new Date().toISOString(),
        device: device || 'Mobile',
        city: 'Addis Ababa, ET',
      });
      memoryStore.scanEvents = memoryStore.scanEvents.slice(0, 300);
      return res.json({ success: true, qrCode: mapQRRow(qr) });
    }

    const { rows } = await pool.query(
      `UPDATE qr_codes
       SET scans_count = scans_count + 1, last_scan_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'QR Code not found.' });

    const qr = rows[0];
    await pool.query(
      `INSERT INTO scan_events (id, qr_id, qr_title, timestamp, device, city)
       VALUES ($1,$2,$3,NOW(),$4,'Addis Ababa, ET')`,
      [`scan_${Date.now()}`, qr.id, qr.title, device || 'Mobile']
    );

    return res.json({ success: true, qrCode: mapQRRow(qr) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Scan recording failed' });
  }
});

// ==================== SETTINGS & RESET ====================
apiRouter.put('/settings/theme', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      memoryStore.appSettings.theme = req.body;
      return res.json({ success: true });
    }
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('theme', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(req.body)]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Save theme failed' });
  }
});

apiRouter.put('/settings/company', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      memoryStore.appSettings.company_profile = req.body;
      return res.json({ success: true });
    }
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('company_profile', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(req.body)]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Save company failed' });
  }
});

apiRouter.post('/admin/reset-defaults', async (_req, res) => {
  try {
    if (!isDatabaseReady) {
      resetMemoryStore();
      return res.json({ success: true });
    }
    await pool.query('TRUNCATE TABLE otps, notification_logs, scan_events, qr_codes, categories, users, roles, app_settings');
    await seedInitialData();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Reset failed' });
  }
});
