import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock Services
const mockAccountService = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  seedDefaultAccounts: vi.fn(),
}));

const mockJournalService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  createEntry: vi.fn(),
  getEntryById: vi.fn(),
  listEntries: vi.fn(),
  reverseEntry: vi.fn(),
}));

const mockReportService = vi.hoisted(() => ({
  getBalanceSheet: vi.fn(),
  getIncomeStatement: vi.fn(),
  getTrialBalance: vi.fn(),
  getGeneralLedger: vi.fn(),
}));

// Mock AuthMiddleware
const mockAuthMiddleware = vi.fn();
// Mock RBAC Middleware
const mockRbacMiddleware = vi.fn();

vi.mock('@modules/accounting/services/account.service', () => ({
  AccountService: function () {
    return mockAccountService;
  },
}));

vi.mock('@modules/accounting/services/journal.service', () => ({
  JournalService: function () {
    return mockJournalService;
  },
}));

vi.mock('@modules/accounting/services/report.service', () => ({
  ReportService: function () {
    return mockReportService;
  },
}));

vi.mock('../../../src/middlewares/auth', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../../src/middlewares/rbac', () => ({
  checkPermissions: () => mockRbacMiddleware,
}));

// Import after mocking
import { financeRouter } from '../../../src/routes/finance';
import { errorHandler } from '../../../src/middlewares/errorHandler';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
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

    // Configure mock return values
    mockAccountService.list.mockResolvedValue([]);
    mockAccountService.seedDefaultAccounts.mockResolvedValue([
      { id: 'acc-1', code: '1000', name: 'Cash', type: 'ASSET' },
      {
        id: 'acc-2',
        code: '2000',
        name: 'Accounts Payable',
        type: 'LIABILITY',
      },
    ]);

    mockJournalService.list.mockResolvedValue([]);
    mockJournalService.getById.mockResolvedValue({
      id: 'je-1',
      date: new Date(),
      reference: 'JE-001',
      description: 'Test Journal',
      entries: [],
    });
    mockJournalService.create.mockResolvedValue({
      id: 'je-new',
      reference: 'JE-NEW',
    });

    mockReportService.getTrialBalance.mockResolvedValue({
      asOfDate: new Date(),
      accounts: [],
      totalDebits: 0,
      totalCredits: 0,
    });
    mockReportService.getGeneralLedger.mockResolvedValue({
      account: { id: 'acc-1', code: '1000', name: 'Cash' },
      entries: [],
      balance: 0,
    });
    mockReportService.getIncomeStatement.mockResolvedValue({
      revenues: [],
      expenses: [],
      netIncome: 0,
    });

    app = createTestApp();
  });

  describe('Account endpoints', () => {
    it('GET /api/finance/accounts should list accounts', async () => {
      const response = await request(app).get(
        '/api/finance/accounts'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/accounts should filter by type', async () => {
      const response = await request(app).get(
        '/api/finance/accounts?type=ASSET'
      );
      expect(response.status).toBe(200);
    });

    it('POST /api/finance/accounts should create account', async () => {
      const response = await request(app)
        .post('/api/finance/accounts')
        .send({ code: '1001', name: 'Bank', type: 'ASSET' });
      expect(response.status).toBe(201);
    });

    it('POST /api/finance/accounts should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/finance/accounts')
        .send({ code: '10' }); // Too short
      expect(response.status).toBe(400);
    });

    it('POST /api/finance/accounts/seed should seed default accounts', async () => {
      const response = await request(app).post(
        '/api/finance/accounts/seed'
      );
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Mocked to return 2 accounts
    });
  });

  describe('Journal endpoints', () => {
    it('GET /api/finance/journals should list journals', async () => {
      const response = await request(app).get(
        '/api/finance/journals'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/journals should filter by date range', async () => {
      const response = await request(app).get(
        '/api/finance/journals?startDate=2024-01-01&endDate=2024-12-31'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/journals/:id should get journal', async () => {
      const response = await request(app).get(
        '/api/finance/journals/je-1'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/journals/:id should return 404 for non-existent', async () => {
      mockJournalService.getById.mockResolvedValue(null);
      const response = await request(app).get(
        '/api/finance/journals/not-found'
      );
      expect(response.status).toBe(404);
    });

    it('POST /api/finance/journals should create journal', async () => {
      const response = await request(app)
        .post('/api/finance/journals')
        .send({
          memo: 'Manual entry',
          lines: [
            {
              accountId: '123e4567-e89b-12d3-a456-426614174000',
              debit: 100,
              credit: 0,
            },
            {
              accountId: '123e4567-e89b-12d3-a456-426614174001',
              debit: 0,
              credit: 100,
            },
          ],
        });
      expect(response.status).toBe(201);
    });
  });

  describe('Report endpoints', () => {
    it('GET /api/finance/reports/trial-balance should get trial balance', async () => {
      const response = await request(app).get(
        '/api/finance/reports/trial-balance'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/reports/trial-balance should accept asOfDate', async () => {
      const response = await request(app).get(
        '/api/finance/reports/trial-balance?asOfDate=2024-12-31'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/reports/general-ledger/:accountId should get general ledger', async () => {
      const response = await request(app).get(
        '/api/finance/reports/general-ledger/acc-1'
      );
      expect(response.status).toBe(200);
    });

    it('GET /api/finance/reports/income-statement should get income statement', async () => {
      const response = await request(app).get(
        '/api/finance/reports/income-statement'
      );
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
