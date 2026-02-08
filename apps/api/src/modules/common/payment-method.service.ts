/**
 * Payment Method Service
 *
 * Business logic for payment method configuration
 */
import { PaymentMethodType } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import * as paymentMethodRepo from './payment-method.repository';

// ============================================
// Queries
// ============================================

export interface ListInput {
  companyId: string;
  includeInactive?: boolean;
}

export async function list(input: ListInput) {
  return paymentMethodRepo.findMany({
    companyId: input.companyId,
    includeInactive: input.includeInactive,
  });
}

export interface GetByIdInput {
  id: string;
  companyId: string;
}

export async function getById(input: GetByIdInput) {
  const method = await paymentMethodRepo.findById(
    input.id,
    input.companyId
  );

  if (!method) {
    throw new DomainError(
      'Payment method not found',
      404,
      DomainErrorCodes.ORDER_NOT_FOUND
    );
  }

  return method;
}

// ============================================
// Commands
// ============================================

export interface CreateInput {
  companyId: string;
  code: string;
  name: string;
  type: PaymentMethodType;
  accountId?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
}

export async function create(input: CreateInput) {
  // Check for duplicate code
  const existing = await paymentMethodRepo.findByCode(
    input.code,
    input.companyId
  );

  if (existing) {
    throw new DomainError(
      `Payment method with code "${input.code}" already exists`,
      400,
      DomainErrorCodes.ALREADY_EXISTS
    );
  }

  // If this is set as default, unset other defaults of same type
  if (input.isDefault) {
    await paymentMethodRepo.unsetDefaultsByType(
      input.companyId,
      input.type
    );
  }

  return paymentMethodRepo.create({
    companyId: input.companyId,
    code: input.code,
    name: input.name,
    type: input.type,
    accountId: input.accountId ?? null,
    isDefault: input.isDefault ?? false,
    sortOrder: input.sortOrder ?? 0,
  });
}

export interface UpdateInput {
  id: string;
  companyId: string;
  data: {
    code?: string;
    name?: string;
    type?: PaymentMethodType;
    accountId?: string | null;
    isActive?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
  };
}

export async function update(input: UpdateInput) {
  const method = await paymentMethodRepo.findById(
    input.id,
    input.companyId
  );

  if (!method) {
    throw new DomainError(
      'Payment method not found',
      404,
      DomainErrorCodes.ORDER_NOT_FOUND
    );
  }

  // Check for duplicate code if changing
  if (input.data.code && input.data.code !== method.code) {
    const existing = await paymentMethodRepo.findByCodeExcluding(
      input.data.code,
      input.companyId,
      input.id
    );

    if (existing) {
      throw new DomainError(
        `Payment method with code "${input.data.code}" already exists`,
        400,
        DomainErrorCodes.ALREADY_EXISTS
      );
    }
  }

  // If setting as default, unset other defaults of same type
  if (input.data.isDefault === true) {
    const type = input.data.type ?? method.type;
    await paymentMethodRepo.unsetDefaultsByType(
      input.companyId,
      type,
      input.id
    );
  }

  return paymentMethodRepo.update(input.id, input.data);
}

export interface DeleteInput {
  id: string;
  companyId: string;
}

export async function remove(input: DeleteInput) {
  const method = await paymentMethodRepo.findById(
    input.id,
    input.companyId
  );

  if (!method) {
    throw new DomainError(
      'Payment method not found',
      404,
      DomainErrorCodes.ORDER_NOT_FOUND
    );
  }

  await paymentMethodRepo.remove(input.id);

  return { success: true };
}

export interface SeedDefaultsInput {
  companyId: string;
}

export async function seedDefaults(input: SeedDefaultsInput) {
  const existingCount = await paymentMethodRepo.count(
    input.companyId
  );

  if (existingCount > 0) {
    throw new DomainError(
      'Company already has payment methods configured',
      400,
      DomainErrorCodes.ALREADY_EXISTS
    );
  }

  // Get cash account (1100) and bank account (1200) if they exist
  const [cashAccount, bankAccount] = await Promise.all([
    paymentMethodRepo.findAccountByCode('1100', input.companyId),
    paymentMethodRepo.findAccountByCode('1200', input.companyId),
  ]);

  const defaults = [
    {
      companyId: input.companyId,
      code: 'CASH',
      name: 'Tunai',
      type: PaymentMethodType.CASH,
      accountId: cashAccount?.id,
      isDefault: true,
      sortOrder: 1,
    },
    {
      companyId: input.companyId,
      code: 'BANK_TRANSFER',
      name: 'Transfer Bank',
      type: PaymentMethodType.BANK,
      accountId: bankAccount?.id,
      isDefault: true,
      sortOrder: 2,
    },
    {
      companyId: input.companyId,
      code: 'QRIS',
      name: 'QRIS',
      type: PaymentMethodType.QRIS,
      accountId: bankAccount?.id,
      isDefault: true,
      sortOrder: 3,
    },
  ];

  const result = await paymentMethodRepo.createMany(defaults);

  return { count: result.count };
}
