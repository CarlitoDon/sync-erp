import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Helper to determine start time
const startTime = new Date();

// Health check endpoint
// Health check endpoint
app.get('/', (_req, res) => {
  res.status(200).send('Bot is running!');
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    startedAt: startTime.toISOString(),
    service: 'santi-living-bot',
  });
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

app.get('/status', getStatus);

import { sendOrder } from './api/send-order';
import { sendMessage } from './api/send-message';
import { ping } from './api/ping';
import { authenticateApiKey } from './middleware/auth';

app.post('/send-order', authenticateApiKey, sendOrder);
app.post('/send-message', authenticateApiKey, sendMessage);
app.post('/ping', authenticateApiKey, ping);

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
