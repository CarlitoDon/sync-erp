import { SHUTDOWN_TIMEOUT_MS } from '@sync-erp/shared';
import { createApp } from './app';
import { startTenantWebhookOutboxWorker } from './services/tenant-webhook-outbox.service';

const PORT = Number(process.env.PORT || 3001);
const app = createApp();
const stopTenantWebhookOutboxWorker =
  startTenantWebhookOutboxWorker();

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.warn(`🚀 Sync ERP API running on port ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.warn(`\n[${signal}] Shutting down gracefully...`);
  stopTenantWebhookOutboxWorker();
  server.close(() => {
    console.warn('[API] Server closed successfully.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
