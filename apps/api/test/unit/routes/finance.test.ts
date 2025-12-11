import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock services
vi.mock('../../../src/services/AccountService', () => ({
  AccountService: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([{ id: 'acc-1', code: '1000', name: 'Cash' }]),
    create: vi.fn().mockResolvedValue({ id: 'acc-new', code: '1001' }),
    seedDefaultAccounts: vi.fn().mockResolvedValue([{ id: 'acc-1' }, { id: 'acc-2' }]),
  })),
}));

vi.mock('../../../src/services/JournalService', () => ({
  JournalService: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([{ id: 'je-1', entryNumber: 'JE-001' }]),
    getById: vi.fn().mockImplementation((id: string) => {
      if (id === 'not-found') return Promise.resolve(null);
      return Promise.resolve({ id: 'je-1', entryNumber: 'JE-001' });
    }),
    create: vi.fn().mockResolvedValue({ id: 'je-new' }),
  })),
}));

vi.mock('../../../src/services/ReportService', () => ({
  ReportService: vi.fn().mockImplementation(() => ({
    getTrialBalance: vi.fn().mockResolvedValue({ accounts: [], totals: { debit: 0, credit: 0 } }),
    getGeneralLedger: vi.fn().mockResolvedValue({ entries: [], balance: 0 }),
    getIncomeStatement: vi.fn().mockResolvedValue({ revenue: [], expenses: [], netIncome: 0 }),
  })),
}));

// Import after mocking
import { financeRouter } from '../../../src/routes/finance';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = { userId: 'test-user', companyId: 'test-company' };
    next();
  });
  app.use('/api/finance', financeRouter);
  app.use(errorHandler);
  return app;
};

describe('Finance Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('Account endpoints', () => {
    it('GET /api/finance/accounts should list accounts', async () => {
      const response = await request(app).get('/api/finance/accounts');
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/accounts should filter by type', async () => {
      const response = await request(app).get('/api/finance/accounts?type=ASSET');
      expect(response.status).toBe(200);
    });

    it('POST /api/finance/accounts should create account', async () => {
      const response = await request(app)
        .post('/api/finance/accounts')
        .send({ code: '1001', name: 'Bank', type: 'ASSET' });
      expect(response.status).toBe(201);
    });

    it('POST /api/finance/accounts should return 400 for invalid input', async () => {
      const response = await request(app).post('/api/finance/accounts').send({ code: '10' }); // Too short
      expect(response.status).toBe(400);
    });

    it('POST /api/finance/accounts/seed should seed default accounts', async () => {
      const response = await request(app).post('/api/finance/accounts/seed');
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('accounts created');
    });
  });

  describe('Journal endpoints', () => {
    it('GET /api/finance/journals should list journals', async () => {
      const response = await request(app).get('/api/finance/journals');
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/journals should filter by date range', async () => {
      const response = await request(app).get(
        '/api/finance/journals?startDate=2024-01-01&endDate=2024-12-31'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/journals/:id should get journal', async () => {
      const response = await request(app).get('/api/finance/journals/je-1');
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/journals/:id should return 404 for non-existent', async () => {
      const response = await request(app).get('/api/finance/journals/not-found');
      expect(response.status).toBe(404);
    });

    it('POST /api/finance/journals should create journal', async () => {
      const response = await request(app)
        .post('/api/finance/journals')
        .send({
          memo: 'Manual entry',
          lines: [
            { accountId: '123e4567-e89b-12d3-a456-426614174000', debit: 100, credit: 0 },
            { accountId: '123e4567-e89b-12d3-a456-426614174001', debit: 0, credit: 100 },
          ],
        });
      expect(response.status).toBe(201);
    });
  });

  describe('Report endpoints', () => {
    it('GET /api/finance/reports/trial-balance should get trial balance', async () => {
      const response = await request(app).get('/api/finance/reports/trial-balance');
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/reports/trial-balance should accept asOfDate', async () => {
      const response = await request(app).get(
        '/api/finance/reports/trial-balance?asOfDate=2024-12-31'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/reports/general-ledger/:accountId should get general ledger', async () => {
      const response = await request(app).get('/api/finance/reports/general-ledger/acc-1');
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/reports/income-statement should get income statement', async () => {
      const response = await request(app).get('/api/finance/reports/income-statement');
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/reports/income-statement should accept date range', async () => {
      const response = await request(app).get(
        '/api/finance/reports/income-statement?startDate=2024-01-01&endDate=2024-12-31'
      );
      expect(response.status).toBe(200);
    });
  });
});
