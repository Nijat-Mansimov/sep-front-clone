import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGeminiRouter } from './server/gemini-routes.ts';
import { createSepRouter } from './server/sep-contract-store.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SEP_BACKEND_URL = process.env.SEP_BACKEND_URL?.replace(/\/$/, '') || '';

async function createProxyMiddleware(targetBase: string): Promise<express.RequestHandler> {
  return async (req, res) => {
    try {
      const targetUrl = `${targetBase}${req.originalUrl}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (k.toLowerCase() === 'host' || k.toLowerCase() === 'content-length') continue;
        if (typeof v === 'string') headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(',');
      }
      const chunks: Buffer[] = [];
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      }
      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      });
      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, value);
        }
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (err) {
      res.status(502).json({
        error: {
          code: 'BAD_GATEWAY',
          message: err instanceof Error ? err.message : 'Upstream backend unreachable',
          requestId: '',
        },
      });
    }
  };
}

async function startServer() {
  const app = express();

  app.use('/api/gemini', createGeminiRouter());

  if (SEP_BACKEND_URL) {
    const proxy = await createProxyMiddleware(SEP_BACKEND_URL);
    app.use('/api/v1', proxy);
    app.use('/git', proxy);
  } else {
    app.use('/api/v1', createSepRouter());
  }

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.get('/{*splat}', async (req, res, next) => {
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Security Engineering Platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
