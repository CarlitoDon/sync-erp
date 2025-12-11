import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { healthRouter } from '../../../src/routes/health';

describe('Health Routes', () => {
  const app = express();
  app.use('/health', healthRouter);

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.version).toBe('0.0.1');
      expect(response.body.data.timestamp).toBeDefined();
    });
  });
});
