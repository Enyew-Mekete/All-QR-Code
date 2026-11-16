import pg from 'pg';
import { INITIAL_ROLES, INITIAL_CATEGORIES, INITIAL_THEMES } from '../src/data/systemDefaults.ts';
import { INITIAL_RESTAURANT } from '../src/data/initialData.ts';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: connectionString.includes('sslmode=require')
          ? { rejectUnauthorized: false }
          : undefined,
      }
    : undefined
);

export let isDatabaseReady = false;

export async function initDatabase(): Promise<boolean> {
  if (!connectionString) {
    console.warn('[DB] DATABASE_URL is not configured in .env; running in local fallback mode.');
    return false;
  }

  try {
    await pool.query('SELECT 1');

    // Create PostgreSQL tables inside the connected database ("QR Code Generator")
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        is_system BOOLEAN DEFAULT false,
        privileges JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT DEFAULT '',
        role_id TEXT NOT NULL,
        password TEXT NOT NULL,
        must_change_password BOOLEAN DEFAULT false,
        otp_enabled BOOLEAN DEFAULT true,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        icon TEXT DEFAULT 'Globe',
        description TEXT DEFAULT '',
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS qr_codes (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT,
        category_id TEXT,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        target_url TEXT NOT NULL,
        table_number INTEGER,
        short_url TEXT,
        scans_count INTEGER DEFAULT 0,
        last_scan_at TIMESTAMPTZ,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        styling JSONB NOT NULL,
        welcome_screen JSONB,
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS scan_events (
        id TEXT PRIMARY KEY,
        qr_id TEXT NOT NULL,
        qr_title TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        device TEXT DEFAULT 'Desktop',
        city TEXT DEFAULT 'Addis Ababa, ET',
        referrer TEXT
      );

      CREATE TABLE IF NOT EXISTS otps (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT DEFAULT '',
        code TEXT NOT NULL,
        type TEXT DEFAULT 'login',
        sent_via JSONB DEFAULT '["email","sms"]',
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notification_logs (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        from_email TEXT,
        from_phone TEXT,
        to_email TEXT NOT NULL,
        to_phone TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'sent'
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await seedInitialData();
    isDatabaseReady = true;
    console.log('[DB] Connected to PostgreSQL ("QR Code Generator") and ensured schema tables.');
    return true;
  } catch (err) {
    console.error('[DB] PostgreSQL initialization failed:', err);
    isDatabaseReady = false;
    return false;
  }
}

export async function seedInitialData(): Promise<void> {
  // 1. Seed Roles
  const roleCount = await pool.query('SELECT COUNT(*)::int AS count FROM roles');
  if (roleCount.rows[0].count === 0) {
    for (const r of INITIAL_ROLES) {
      await pool.query(
        `INSERT INTO roles (id, name, description, is_system, privileges, created_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.name,
          r.description,
          Boolean(r.isSystem),
          JSON.stringify(r.privileges),
          r.createdAt || new Date().toISOString(),
          r.deletedAt || null,
        ]
      );
    }
  }

  // 2. Seed Users
  const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCount.rows[0].count === 0) {
    const initialUsers = [
      {
        id: 'user_super_admin',
        name: 'Enyew Mekete',
        email: 'enyewmekete65@gmail.com',
        phone: '+251943305937',
        role_id: 'super_admin',
        password: 'SuperAdmin@2026',
        must_change_password: false,
        otp_enabled: false,
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
        last_login_at: '2026-11-12T08:00:00Z',
      },
      {
        id: 'user_admin_demo',
        name: 'Hermela B.',
        email: 'admin@qrcodegenerator.io',
        phone: '+251911223344',
        role_id: 'admin',
        password: 'Admin@2026',
        must_change_password: false,
        otp_enabled: true,
        status: 'active',
        created_at: '2026-02-01T00:00:00Z',
        last_login_at: '2026-11-10T12:00:00Z',
      },
    ];

    for (const u of initialUsers) {
      await pool.query(
        `INSERT INTO users (id, name, email, phone, role_id, password, must_change_password, otp_enabled, status, created_at, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          u.id,
          u.name,
          u.email,
          u.phone,
          u.role_id,
          u.password,
          u.must_change_password,
          u.otp_enabled,
          u.status,
          u.created_at,
          u.last_login_at,
        ]
      );
    }
  }

  // 3. Seed Categories
  const catCount = await pool.query('SELECT COUNT(*)::int AS count FROM categories');
  if (catCount.rows[0].count === 0) {
    for (const c of INITIAL_CATEGORIES) {
      await pool.query(
        `INSERT INTO categories (id, name, slug, icon, description, display_order, created_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name, c.slug, c.icon, c.description, c.displayOrder, c.createdAt, null]
      );
    }
  }

  // 4. Seed QR Codes
  const qrCount = await pool.query('SELECT COUNT(*)::int AS count FROM qr_codes');
  if (qrCount.rows[0].count === 0) {
    const initialQRs = [
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
        welcomeScreen: null,
      },
      {
        id: 'qr_menu_01',
        restaurantId: 'company_qr_01',
        categoryId: 'cat_restaurant',
        title: 'Table 04 Contactless Dine-In',
        type: 'table_standee',
        tableNumber: 4,
        targetUrl: 'https://qrcodegenerator.io/menu',
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
          size: 280,
        },
        welcomeScreen: null,
      },
    ];

    for (const q of initialQRs) {
      await pool.query(
        `INSERT INTO qr_codes (id, restaurant_id, category_id, title, type, target_url, table_number, short_url, scans_count, last_scan_at, status, created_at, styling, welcome_screen)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          q.id,
          q.restaurantId,
          q.categoryId,
          q.title,
          q.type,
          q.targetUrl,
          q.tableNumber ?? null,
          q.shortUrl,
          q.scansCount,
          q.lastScanAt,
          q.status,
          q.createdAt,
          JSON.stringify(q.styling),
          q.welcomeScreen ? JSON.stringify(q.welcomeScreen) : null,
        ]
      );
    }
  }

  // 5. Seed Scan Events
  const scanCount = await pool.query('SELECT COUNT(*)::int AS count FROM scan_events');
  if (scanCount.rows[0].count === 0) {
    const seeded = [
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
    for (const ev of seeded) {
      await pool.query(
        `INSERT INTO scan_events (id, qr_id, qr_title, timestamp, device, city)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [ev.id, ev.qrId, ev.qrTitle, ev.timestamp, ev.device, ev.city]
      );
    }
  }

  // 6. Seed App Settings (theme & company profile)
  await pool.query(
    `INSERT INTO app_settings (key, value)
     VALUES ('theme', $1::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(INITIAL_THEMES[0])]
  );
  await pool.query(
    `INSERT INTO app_settings (key, value)
     VALUES ('company_profile', $1::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(INITIAL_RESTAURANT)]
  );
}
