import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './backend/db.ts';
import { apiRouter } from './backend/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';
  console.log('DATABASE_URL=', process.env.DATABASE_URL);
  console.log('NODE_ENV=', process.env.NODE_ENV);


  // Initialize Neon PostgreSQL schema & initial seed data
  await initDatabase();

  // Body parsers (50mb supports HD uploaded welcome logos, images & PDFs)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Backend REST API routes
  app.use('/api', apiRouter);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] QR Code Generator listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
