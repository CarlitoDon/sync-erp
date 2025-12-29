import { useState, useMemo, useCallback } from 'react';
import { PaymentTermsSchema } from '@sync-erp/shared';

/**
 * Represents a single order line item
 */
export interface OrderItemForm {
  productId: string;
  quantity: number;
  price: number;
}

/**
 * UI-level payment mode
 */
export type PaymentMode =
  | 'TEMPO'
  | typeof PaymentTermsSchema.enum.UPFRONT
  | typeof PaymentTermsSchema.enum.COD;

/**
 * Payment configuration for orders
 */
export interface PaymentConfig {
  mode: PaymentMode;
  paymentTerms: string;
  withDP: boolean;
  dpPercent: number;
  dpAmount: number;
}

/**
 * Calculated totals for an order
 */
export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  taxRate: number;
}

/**
 * Configuration options for the useOrderForm hook
 */
export interface UseOrderFormOptions {
  /** Default tax rate percentage (e.g., 11 for 11%) */
  defaultTaxRate?: number;
  /** Default payment terms (e.g., 'NET30') */
  defaultPaymentTerms?: string;
}

/**
 * Return type for the useOrderForm hook
 */
export interface UseOrderFormReturn {
  // Form state
  partnerId: string;
  setPartnerId: (id: string) => void;
  items: OrderItemForm[];
  taxRate: number;
  setTaxRate: (rate: number) => void;
  paymentConfig: PaymentConfig;
  setPaymentConfig: React.Dispatch<
    React.SetStateAction<PaymentConfig>
  >;

  // Current item being edited
  currentItem: OrderItemForm;
  setCurrentItem: React.Dispatch<React.SetStateAction<OrderItemForm>>;

  // Actions
  addItem: () => void;
  removeItem: (index: number) => void;
  resetForm: () => void;

  // Computed values (memoized)
  totals: OrderTotals;

  // Validation
  isValid: boolean;
}

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  mode: 'TEMPO',
  paymentTerms: PaymentTermsSchema.enum.NET30,
  withDP: false,
  dpPercent: 0,
  dpAmount: 0,
};

const DEFAULT_ITEM: OrderItemForm = {
  productId: '',
  quantity: 1,
  price: 0,
};

/**
 * Shared hook for order form state management.
 * Used by both Purchase Orders and Sales Orders.
 *
 * Features:
 * - Partner selection state
 * - Line items management (add/remove)
 * - Current item being edited
 * - Tax rate and payment configuration
 * - Memoized total calculations
 * - Form validation
 *
 * @example
 * ```tsx
 * const {
 *   partnerId, setPartnerId,
 *   items, currentItem, setCurrentItem,
 *   addItem, removeItem,
 *   paymentConfig, setPaymentConfig,
 *   totals, isValid,
 *   resetForm
 * } = useOrderForm({ defaultTaxRate: 11 });
 * ```
 */
export function useOrderForm(
  options: UseOrderFormOptions = {}
): UseOrderFormReturn {
  const {
    defaultTaxRate = 0,
    defaultPaymentTerms = PaymentTermsSchema.enum.NET30,
  } = options;

  // Core form state
  const [partnerId, setPartnerId] = useState('');
  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [taxRate, setTaxRate] = useState(defaultTaxRate);

  // Payment configuration
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    ...DEFAULT_PAYMENT_CONFIG,
    paymentTerms: defaultPaymentTerms,
  });

  // Current item being edited (before adding to items array)
  const [currentItem, setCurrentItem] =
    useState<OrderItemForm>(DEFAULT_ITEM);

  // Memoized total calculations
  const totals = useMemo<OrderTotals>(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxAmount;

    return { subtotal, taxAmount, grandTotal, taxRate };
  }, [items, taxRate]);

  // Action: Add current item to items list
  const addItem = useCallback(() => {
    if (!currentItem.productId || currentItem.quantity <= 0) return;

    setItems((prev) => [...prev, currentItem]);
    setCurrentItem(DEFAULT_ITEM);
  }, [currentItem]);

  // Action: Remove item at index
  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Action: Reset entire form
  const resetForm = useCallback(() => {
    setPartnerId('');
    setItems([]);
    setTaxRate(defaultTaxRate);
    setPaymentConfig({
      ...DEFAULT_PAYMENT_CONFIG,
      paymentTerms: defaultPaymentTerms,
    });
    setCurrentItem(DEFAULT_ITEM);
  }, [defaultTaxRate, defaultPaymentTerms]);

  // Validation: form is valid if partner selected and at least one item
  const isValid = useMemo(() => {
    return partnerId !== '' && items.length > 0;
  }, [partnerId, items.length]);

  return {
    // State
    partnerId,
    setPartnerId,
    items,
    taxRate,
    setTaxRate,
    paymentConfig,
    setPaymentConfig,
    currentItem,
    setCurrentItem,

    // Actions
    addItem,
    removeItem,
    resetForm,

    // Computed
    totals,
    isValid,
  };
}

export default useOrderForm;
