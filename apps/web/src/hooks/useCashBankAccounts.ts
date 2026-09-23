import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';

/**
 * Standard Chart of Accounts (COA) Header and Clearing Accounts to exclude:
 * - 1000: Cash Header (Indonesian Standard)
 * - 1050: Bank Header (Indonesian Standard)
 * - 1100: Cash (Group Header in default seeder / AR in Indonesian COA)
 * - 1200: Bank (Group Header in default seeder / Inventory in Indonesian COA)
 * - 1210: Goods in Transit (Inventory clearing asset, not a liquid bank account)
 */
export const CASH_BANK_HEADER_CODES: readonly string[] = [
  '1000',
  '1050',
  '1100',
  '1200',
  '1210',
] as const;
const CASH_BANK_HEADER_SET = new Set<string>(CASH_BANK_HEADER_CODES);

/**
 * Account interface matching Chart of Accounts returned by trpc.finance.listAccounts
 */
export interface CashBankAccount {
  id: string;
  code: string;
  name: string;
  isGroup: boolean;
  type?: string;
}

/**
 * Dropdown Select option representation
 */
export interface CashBankAccountOption {
  value: string;
  label: string;
}

export interface UseCashBankAccountsOptions {
  /**
   * Whether the underlying query should be enabled.
   * Useful to defer execution until a modal is open (e.g., { enabled: isOpen }).
   * Defaults to true.
   */
  enabled?: boolean;
}

export interface UseCashBankAccountsReturn {
  /**
   * Filtered Cash & Bank accounts list (primary name per PROJECT.md)
   */
  accounts: CashBankAccount[];
  /**
   * Alias matching the variable name used across existing consumers
   */
  cashBankAccounts: CashBankAccount[];
  /**
   * Pre-formatted options ready for <Select options={options} />
   */
  options: CashBankAccountOption[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown> | void;
}

/**
 * Pure predicate to filter Cash & Bank accounts:
 * 1. Exclude group accounts (isGroup === true)
 * 2. Exclude headers/clearing accounts (1000, 1050, 1100, 1200, 1210)
 * 3. Include codes in range 1000..1099 (Cash & Bank in Indonesian COA e.g. Santi Living),
 *    1100..1199 (Cash in Standard COA), and 1200..1299 (Bank in Standard COA)
 */
export function isCashBankAccount(account: {
  code: string;
  isGroup?: boolean | null;
}): boolean {
  if (account.isGroup) return false;
  if (CASH_BANK_HEADER_SET.has(account.code)) return false;
  return (
    (account.code >= '1000' && account.code <= '1099') ||
    (account.code >= '1100' && account.code <= '1199') ||
    (account.code >= '1200' && account.code <= '1299')
  );
}

/**
 * Format account into <Select> option label: "1101 — Kas Toko"
 */
export function formatCashBankAccountOption(
  account: Pick<CashBankAccount, 'id' | 'code' | 'name'>
): CashBankAccountOption {
  return {
    value: account.id,
    label: `${account.code} — ${account.name}`,
  };
}

/**
 * Custom hook to fetch and filter active Cash & Bank accounts for payment/refund selections.
 */
export function useCashBankAccounts(
  options: UseCashBankAccountsOptions = {}
): UseCashBankAccountsReturn {
  const { enabled = true } = options;

  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.finance.listAccounts.useQuery(undefined, { enabled });

  const { accounts, selectOptions } = useMemo(() => {
    const filtered: CashBankAccount[] = data.filter(isCashBankAccount);
    const opts: CashBankAccountOption[] = filtered.map(formatCashBankAccountOption);
    return { accounts: filtered, selectOptions: opts };
  }, [data]);

  return {
    accounts,
    cashBankAccounts: accounts,
    options: selectOptions,
    isLoading,
    isError,
    error,
    refetch,
  };
}
