export const STOCK_ADJUSTMENT_TYPES = {
  INCREMENT: 'INCREMENT',
  DECREMENT: 'DECREMENT',
} as const;

export type StockAdjustmentType =
  (typeof STOCK_ADJUSTMENT_TYPES)[keyof typeof STOCK_ADJUSTMENT_TYPES];

export const STOCK_ADJUSTMENT_OPTIONS = [
  { value: STOCK_ADJUSTMENT_TYPES.INCREMENT, label: 'Increment (+)' },
  { value: STOCK_ADJUSTMENT_TYPES.DECREMENT, label: 'Decrement (-)' },
];
