import path from 'path';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { authenticateApiKey } from './middleware/auth';
import { getQrDataUrl } from './bot/baileys';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve inbound downloaded media (e.g. proof of payment photos)
const mediaDir = path.resolve(process.cwd(), 'storage/inbound-media');
app.use('/media', express.static(mediaDir));

// Helper to determine start time
const startTime = new Date();

// Health check endpoint
app.get('/', (_req, res) => {
  res.status(200).send('Bot is running!');
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    startedAt: startTime.toISOString(),
    service: 'sync-erp-whatsapp-connector',
  });
});

app.get('/qr', (_req, res) => {
  const qr = getQrDataUrl();
  if (qr) {
    res.status(200).send(`<!DOCTYPE html><html><head><title>WhatsApp QR</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#111;"><img src="${qr}" style="max-width:320px;border-radius:8px;background:#fff;padding:16px;"/><script>setTimeout(()=>location.reload(), 10000);</script></body></html>`);
  } else {
    res.status(200).send(`<!DOCTYPE html><html><head><title>WhatsApp QR</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;background:#111;color:#fff;"><h2>WhatsApp Bot Connected (or initializing)</h2><script>setTimeout(()=>location.reload(), 10000);</script></body></html>`);
  }
});

import { getStatus } from './api/status';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './trpc';
import { createContext } from './trpc/trpc';

app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Status contains the pairing QR and is only for the API service.
app.get('/status', authenticateApiKey, getStatus);

import { sendOrder } from './api/send-order';
import { sendMessage } from './api/send-message';
import { sendImage } from './api/send-image';
import { ping } from './api/ping';

app.post('/send-order', authenticateApiKey, sendOrder);
app.post('/send-message', authenticateApiKey, sendMessage);
app.post('/send-image', authenticateApiKey, sendImage);
app.post('/ping', authenticateApiKey, ping);

import { logout } from './api/logout';
app.post('/logout', authenticateApiKey, logout);

// Start server function (to be called from index.ts)
export const startServer = () => {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);

    // Initialize Bot
    // We import dynamically or normally here, but we need circular dep handling
    // For now, let's assume index.ts handles the wiring or we do it here if deps are clean
  });
  return app;
};

export default app;
