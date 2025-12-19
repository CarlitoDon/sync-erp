import { vi } from 'vitest';

export const mockUserService = {
  listByCompany: vi.fn(),
  create: vi.fn(),
  getByEmail: vi.fn(),
  getById: vi.fn(),
  assignToCompany: vi.fn(),
  removeFromCompany: vi.fn(),
};

export const mockSalesService = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  ship: vi.fn(),
};

export const mockFulfillmentService = {
  processShipment: vi.fn(),
};

export const mockSessionService = {
  createSession: vi.fn(),
  verifySession: vi.fn(),
  revokeSession: vi.fn(),
};

export const mockAuthService = {
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  validateUser: vi.fn(),
  getSession: vi.fn(),
};

export const mockAuthUtil = {
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
  generateToken: vi.fn(),
  verifyToken: vi.fn(),
};

export const mockBillService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  post: vi.fn(),
};

export const mockCompanyService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  addUser: vi.fn(),
  removeUser: vi.fn(),
};

export const mockAccountService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
};

export const mockJournalService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  post: vi.fn(),
  postGoodsReceipt: vi.fn(),
  postBill: vi.fn(),
};

export const mockReportService = {
  getTrialBalance: vi.fn(),
  getIncomeStatement: vi.fn(),
  getBalanceSheet: vi.fn(),
};

export const mockInventoryService = {
  processGoodsReceipt: vi.fn(),
  processShipment: vi.fn(),
  processReturn: vi.fn(),
  adjustStock: vi.fn(),
  getStockLevel: vi.fn(),
};

export const mockInvoiceService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  post: vi.fn(),
  receivePayment: vi.fn(),
};

export const mockPartnerService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
};

export const mockPaymentService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  processPayment: vi.fn(),
};

export const mockProductService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  updateStock: vi.fn(),
  updateAverageCost: vi.fn(),
};

export const mockPurchaseOrderService = {
  create: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  receive: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
};

const allMocks = [
  mockUserService,
  mockSalesService,
  mockFulfillmentService,
  mockSessionService,
  mockAuthService,
  mockAuthUtil,
  mockBillService,
  mockCompanyService,
  mockAccountService,
  mockJournalService,
  mockReportService,
  mockInventoryService,
  mockInvoiceService,
  mockPartnerService,
  mockPaymentService,
  mockProductService,
  mockPurchaseOrderService,
];

export const resetServiceMocks = () => {
  allMocks.forEach((mockService) => {
    Object.values(mockService).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        fn.mockReset();
      }
    });
  });
};
