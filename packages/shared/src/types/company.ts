// ============================================
// Business Shape (Apple-Like Core)
// ============================================

/**
 * BusinessShape determines the operational mode of a company.
 * PENDING: Initial state, all business operations blocked until shape selected.
 * RETAIL: Trading business, stock tracking enabled, AVG costing.
 * MANUFACTURING: Full inventory with WIP, FIFO costing.
 * SERVICE: No physical stock, service-only operations.
 * RENTAL: Rental operations with rentable items and returns.
 */
export enum BusinessShape {
  PENDING = 'PENDING',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  SERVICE = 'SERVICE',
  RENTAL = 'RENTAL',
}

export enum CompanyOnboardingStatus {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  IN_PROGRESS = 'IN_PROGRESS',
  ACTIVE = 'ACTIVE',
}

export enum CompanyOnboardingStep {
  WELCOME = 'WELCOME',
  BUSINESS_SHAPE = 'BUSINESS_SHAPE',
  CONFIGURE_SYSTEM = 'CONFIGURE_SYSTEM',
  OPENING_BALANCE = 'OPENING_BALANCE',
  FIRST_TRANSACTION = 'FIRST_TRANSACTION',
  ALIVE_MOMENT = 'ALIVE_MOMENT',
  DONE = 'DONE',
}

// CostingMethod moved to constants/inventory.ts

// ============================================
// Company Types
// ============================================

export interface CompanyData {
  id: string;
  name: string;
  businessShape: BusinessShape;
  inviteCode?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CreateCompanyDto {
  name: string;
}

export interface JoinCompanyDto {
  inviteCode: string;
}

/**
 * DTO for selecting business shape. Used by POST /company/select-shape.
 */
export interface SelectShapeDto {
  shape:
    | BusinessShape.RETAIL
    | BusinessShape.MANUFACTURING
    | BusinessShape.SERVICE
    | BusinessShape.RENTAL;
}
