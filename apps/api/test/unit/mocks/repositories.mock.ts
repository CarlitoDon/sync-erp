/**
 * Repository Mocks for Unit Tests
 * This file provides mock implementations for all repository classes
 * allowing service tests to be isolated from the database layer.
 */

import { vi } from 'vitest';

// ==================== Product Repository ====================
export const mockProductRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySku: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  incrementStock: vi.fn(),
};

// ==================== Partner Repository ====================
export const mockPartnerRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// ==================== Account Repository ====================
export const mockAccountRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
};

// ==================== Invoice Repository ====================
export const mockInvoiceRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  findOrder: vi.fn(),
};

// ==================== Journal Repository ====================
export const mockJournalRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  aggregateAccountSum: vi.fn(),
  aggregateAccountSumRange: vi.fn(),
  getOpeningBalanceSum: vi.fn(),
  findLinesByAccount: vi.fn(),
  aggregateTypeSum: vi.fn(),
};

// ==================== Payment Repository ====================
export const mockPaymentRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
};

// ==================== Inventory Repository ====================
export const mockInventoryRepository = {
  createMovement: vi.fn(),
  findMovements: vi.fn(),
  findById: vi.fn(),
  countByReferencePatterns: vi.fn().mockResolvedValue(1), // Default: GRN exists
};

// ==================== Sales Repository ====================
export const mockSalesRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  updateStatus: vi.fn(),
  count: vi.fn(),
  findItems: vi.fn(),
};

// ==================== Procurement Repository ====================
export const mockProcurementRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  updateStatus: vi.fn(),
  count: vi.fn(),
  findItems: vi.fn(),
};

// ==================== User Repository ====================
export const mockUserRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findMembersByCompany: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
};

// ==================== Auth Repository ====================
export const mockAuthRepository = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
  deleteUserSessions: vi.fn(),
};

// ==================== Company Repository ====================
export const mockCompanyRepository = {
  create: vi.fn(),
  findByInviteCode: vi.fn(),
  findById: vi.fn(),
  findMembership: vi.fn(),
  addMember: vi.fn(),
  findMemberships: vi.fn(),
};

// ==================== Reset Function ====================
const allMocks = [
  mockProductRepository,
  mockPartnerRepository,
  mockAccountRepository,
  mockInvoiceRepository,
  mockJournalRepository,
  mockPaymentRepository,
  mockInventoryRepository,
  mockSalesRepository,
  mockProcurementRepository,
  mockUserRepository,
  mockAuthRepository,
  mockCompanyRepository,
];

export const resetRepositoryMocks = () => {
  allMocks.forEach((mockRepo) => {
    Object.values(mockRepo).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        fn.mockReset();
      }
    });
  });
};

// ==================== Class Constructors for Vitest 4.x ====================
// Vitest 4.x requires 'function' or 'class' syntax for mocks
export function MockProductRepository() {
  return mockProductRepository;
}
export function MockPartnerRepository() {
  return mockPartnerRepository;
}
export function MockAccountRepository() {
  return mockAccountRepository;
}
export function MockInvoiceRepository() {
  return mockInvoiceRepository;
}
export function MockJournalRepository() {
  return mockJournalRepository;
}
export function MockPaymentRepository() {
  return mockPaymentRepository;
}
export function MockInventoryRepository() {
  return mockInventoryRepository;
}
export function MockSalesRepository() {
  return mockSalesRepository;
}
export function MockProcurementRepository() {
  return mockProcurementRepository;
}
export function MockUserRepository() {
  return mockUserRepository;
}
export function MockAuthRepository() {
  return mockAuthRepository;
}
export function MockCompanyRepository() {
  return mockCompanyRepository;
}
