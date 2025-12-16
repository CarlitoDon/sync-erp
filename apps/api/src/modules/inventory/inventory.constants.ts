/**
 * Inventory Module Constants
 * 
 * Movement types and other inventory-related constants.
 */

/**
 * Movement types for inventory transactions.
 */
export const MovementType = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
  WIP_CONSUME: 'WIP_CONSUME',
  WIP_OUTPUT: 'WIP_OUTPUT',
} as const;

export type MovementType = (typeof MovementType)[keyof typeof MovementType];

/**
 * Movement operation categories.
 */
export const MovementCategory = {
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  PRODUCTION: 'PRODUCTION',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
} as const;

export type MovementCategory = (typeof MovementCategory)[keyof typeof MovementCategory];

/**
 * Default unit of measure for new products.
 */
export const DEFAULT_UNIT_OF_MEASURE = 'PCS';

/**
 * Costing methods supported by the system.
 */
export const CostingMethod = {
  AVG: 'AVG',
  FIFO: 'FIFO',
} as const;

export type CostingMethod = (typeof CostingMethod)[keyof typeof CostingMethod];
