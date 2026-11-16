import express from 'express';
import { pool, isDatabaseReady, seedInitialData } from './db.ts';
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

// Middleware to guard DB availability
function requireDb(_req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isDatabaseReady) {
    return res.status(503).json({ success: false, error: 'PostgreSQL database is unavailable.' });
  }
  next();
}

apiRouter.get('/health', async (_req, res) => {
  try {
    if (!isDatabaseReady) {
      return res.status(503).json({ ok: false, database: 'disconnected' });
    }
    await pool.query('SELECT 1');
    return res.json({ ok: true, database: 'QR Code Generator (PostgreSQL)' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'DB error' });
  }
});

// ==================== BOOTSTRAP ====================
apiRouter.get('/bootstrap', requireDb, async (_req, res) => {
  try {
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
apiRouter.post('/auth/login', requireDb, async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    const trimmed = String(identifier || '').trim().toLowerCase();
    if (!trimmed || !password) {
      return res.status(400).json({ success: false, error: 'Username/email and password are required.' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM users
       WHERE deleted_at IS NULL AND (LOWER(email) = $1 OR LOWER(name) = $1)
       LIMIT 1`,
      [trimmed]
    );

    const userRow = rows[0];
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
      await pool.query(
        `INSERT INTO otps (id, user_id, email, phone, code, type, sent_via, expires_at, used, created_at)
         VALUES ($1,$2,$3,$4,$5,'login','["email","sms"]'::jsonb,$6,false,NOW())`,
        [otpId, user.id, user.email, user.phone || '', code, expiresAt]
      );

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

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    return res.json({ success: true, step: 'authenticated', user });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Login failed' });
  }
});

apiRouter.post('/auth/verify-otp', requireDb, async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedCode = String(code || '').trim();

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

apiRouter.post('/auth/resend-otp', requireDb, async (req, res) => {
  try {
    const { email } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 AND deleted_at IS NULL LIMIT 1', [trimmedEmail]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    const user = mapUserRow(userRes.rows[0], false);
    const code = generate6DigitOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await pool.query(
      `INSERT INTO otps (id, user_id, email, phone, code, type, sent_via, expires_at, used, created_at)
       VALUES ($1,$2,$3,$4,$5,'login','["email","sms"]'::jsonb,$6,false,NOW())`,
      [`otp_${Date.now()}`, user.id, user.email, user.phone || '', code, expiresAt]
    );

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

apiRouter.post('/auth/change-password', requireDb, async (req, res) => {
  try {
    const { userId, newPassword } = req.body || {};
    const strength = validatePasswordStrength(String(newPassword || ''));
    if (!strength.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters and include 1 Capital, 1 Small, 1 Number, and 1 Special character.',
      });
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

// ==================== USERS MANAGEMENT (CREATE, EDIT, RESET, OTP TOGGLE, SOFT DELETE, RESTORE) ====================
apiRouter.post('/users', requireDb, async (req, res) => {
  try {
    const { name, email, phone, role, otpEnabled } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedName = String(name || '').trim();
    const trimmedPhone = String(phone || '').trim() || '+251943305937';

    if (!trimmedName || !trimmedEmail) {
      return res.status(400).json({ success: false, error: 'Full Name and Email are required.' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1 AND deleted_at IS NULL',
      [trimmedEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'A user with this email already exists in QR Code Generator.' });
    }

    const tempPassword = generate7DigitMixedPassword();
    const id = `usr_${Date.now()}`;
    const otpFlag = otpEnabled !== undefined ? Boolean(otpEnabled) : true;

    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, phone, role_id, password, must_change_password, otp_enabled, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,'active',NOW())
       RETURNING *`,
      [id, trimmedName, trimmedEmail, trimmedPhone, role || 'admin', tempPassword, otpFlag]
    );

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
      user: mapUserRow(rows[0], false),
      message: 'The user has Created Successfully and sent via that user email address',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create user' });
  }
});

apiRouter.put('/users/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, status, otpEnabled } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedName = String(name || '').trim();

    if (!trimmedName || !trimmedEmail) {
      return res.status(400).json({ success: false, error: 'Name and email are required.' });
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

apiRouter.post('/users/:id/toggle-otp', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
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

apiRouter.post('/users/:id/reset-password', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const tempPassword = generate7DigitMixedPassword();

    const { rows } = await pool.query(
      `UPDATE users SET password = $1, must_change_password = true WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [tempPassword, id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found.' });

    const user = rows[0];
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

apiRouter.delete('/users/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
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

apiRouter.post('/users/:id/restore', requireDb, async (req, res) => {
  try {
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
apiRouter.post('/roles', requireDb, async (req, res) => {
  try {
    const { name, description, privileges } = req.body || {};
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return res.status(400).json({ success: false, error: 'Role name is required.' });

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

apiRouter.put('/roles/:id', requireDb, async (req, res) => {
  try {
    const { name, description, privileges } = req.body || {};
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

apiRouter.delete('/roles/:id', requireDb, async (req, res) => {
  try {
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

apiRouter.post('/roles/:id/restore', requireDb, async (req, res) => {
  try {
    await pool.query('UPDATE roles SET deleted_at = NULL WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Restore role failed' });
  }
});

// ==================== CATEGORIES ====================
apiRouter.post('/categories', requireDb, async (req, res) => {
  try {
    const { name, icon, description, displayOrder } = req.body || {};
    const trimmed = String(name || '').trim();
    if (!trimmed) return res.status(400).json({ success: false, error: 'Category name is required.' });

    const existing = await pool.query(
      'SELECT id FROM categories WHERE LOWER(name) = $1 AND deleted_at IS NULL',
      [trimmed.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'A category with this name already exists.' });
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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

apiRouter.put('/categories/:id', requireDb, async (req, res) => {
  try {
    const { name, icon, description, displayOrder } = req.body || {};
    const trimmed = String(name || '').trim();
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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

apiRouter.delete('/categories/:id', requireDb, async (req, res) => {
  try {
    await pool.query('UPDATE categories SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Delete category failed' });
  }
});

apiRouter.post('/categories/:id/restore', requireDb, async (req, res) => {
  try {
    await pool.query('UPDATE categories SET deleted_at = NULL WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Restore category failed' });
  }
});

// ==================== QR CODES & SCANS ====================
apiRouter.post('/qr-codes', requireDb, async (req, res) => {
  try {
    const qr = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO qr_codes (id, restaurant_id, category_id, title, type, target_url, table_number, short_url, scans_count, status, created_at, expires_at, styling, welcome_screen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
       RETURNING *`,
      [
        qr.id || `qr_${Date.now()}`,
        qr.restaurantId || 'company_qr_01',
        qr.categoryId || null,
        qr.title || 'Dynamic QR Code',
        qr.type || 'website',
        qr.targetUrl || 'https://qrcodegenerator.io',
        qr.tableNumber ?? null,
        qr.shortUrl || '',
        Number(qr.scansCount || 0),
        qr.status || 'active',
        qr.createdAt || new Date().toISOString(),
        qr.expiresAt || null,
        JSON.stringify(qr.styling || {}),
        qr.welcomeScreen ? JSON.stringify(qr.welcomeScreen) : null,
      ]
    );
    return res.json({ success: true, qrCode: mapQRRow(rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Create QR failed' });
  }
});

apiRouter.put('/qr-codes/:id', requireDb, async (req, res) => {
  try {
    const qr = req.body || {};
    const { rows } = await pool.query(
      `UPDATE qr_codes
       SET category_id = $1,
           title = $2,
           type = $3,
           target_url = $4,
           table_number = $5,
           short_url = $6,
           status = $7,
           expires_at = $8,
           styling = $9::jsonb,
           welcome_screen = $10::jsonb
       WHERE id = $11 AND deleted_at IS NULL
       RETURNING *`,
      [
        qr.categoryId || null,
        qr.title,
        qr.type,
        qr.targetUrl,
        qr.tableNumber ?? null,
        qr.shortUrl || '',
        qr.status || 'active',
        qr.expiresAt || null,
        JSON.stringify(qr.styling || {}),
        qr.welcomeScreen ? JSON.stringify(qr.welcomeScreen) : null,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'QR Code not found.' });
    return res.json({ success: true, qrCode: mapQRRow(rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Update QR failed' });
  }
});

apiRouter.delete('/qr-codes/:id', requireDb, async (req, res) => {
  try {
    await pool.query('UPDATE qr_codes SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Delete QR failed' });
  }
});

apiRouter.post('/qr-codes/:id/restore', requireDb, async (req, res) => {
  try {
    await pool.query('UPDATE qr_codes SET deleted_at = NULL WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Restore QR failed' });
  }
});

apiRouter.post('/qr-codes/:id/scan', requireDb, async (req, res) => {
  try {
    const { device } = req.body || {};
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
apiRouter.put('/settings/theme', requireDb, async (req, res) => {
  try {
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

apiRouter.put('/settings/company', requireDb, async (req, res) => {
  try {
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

apiRouter.post('/admin/reset-defaults', requireDb, async (_req, res) => {
  try {
    await pool.query('TRUNCATE TABLE otps, notification_logs, scan_events, qr_codes, categories, users, roles, app_settings');
    await seedInitialData();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Reset failed' });
  }
});
