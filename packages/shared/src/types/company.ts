// ============================================
// Business Shape (Apple-Like Core)
// ============================================

/**
 * BusinessShape determines the operational mode of a company.
 * PENDING: Initial state, all business operations blocked until shape selected.
 * RETAIL: Trading business, stock tracking enabled, AVG costing.
 * MANUFACTURING: Full inventory with WIP, FIFO costing.
 * SERVICE: No physical stock, service-only operations.
 */
export enum BusinessShape {
  PENDING = 'PENDING',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  SERVICE = 'SERVICE',
}

/**
 * CostingMethod determines how cost of goods sold (HPP) is calculated.
 * AVG: Weighted Average Cost (default for Retail).
 * FIFO: First-In First-Out (default for Manufacturing).
 */
export enum CostingMethod {
  AVG = 'AVG',
  FIFO = 'FIFO',
}

// ============================================
// Company Types
// ============================================

export interface Company {
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
  shape: BusinessShape.RETAIL | BusinessShape.MANUFACTURING | BusinessShape.SERVICE;
}

