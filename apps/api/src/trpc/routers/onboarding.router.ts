import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { prisma, type BusinessShape } from '@sync-erp/database';
import { container, ServiceKeys } from '../../modules/common/di';
import type { CompanyService } from '../../modules/company/company.service';
import type { AccountService } from '../../modules/accounting/services/account.service';
import type { PurchaseOrderService } from '../../modules/procurement/purchase-order.service';
import type { InventoryService } from '../../modules/inventory/inventory.service';
import type { BillService } from '../../modules/accounting/services/bill.service';
import type { PaymentService } from '../../modules/accounting/services/payment.service';
import type { PartnerService } from '../../modules/partner/partner.service';
import type { ProductService } from '../../modules/product/product.service';
import { JournalCoreService } from '../../modules/accounting/services/journal-core.service';
import type { JournalRepository } from '../../modules/accounting/repositories/journal.repository';

const SelectBusinessShapeSchema = z.object({
  shape: z.enum(['RETAIL', 'MANUFACTURING', 'SERVICE']),
});

const SubmitOpeningBalanceSchema = z.object({
  cash: z.number().min(0),
  bank: z.number().min(0),
});

const RunFirstTransactionRetailSchema = z.object({
  supplierName: z.string().min(2),
  productName: z.string().min(2),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  payNow: z.boolean().optional(),
});

function coerceBusinessShape(shape: string): BusinessShape {
  if (shape === 'RETAIL' || shape === 'MANUFACTURING' || shape === 'SERVICE') {
    return shape;
  }
  throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid business shape' });
}

async function getCompanyOrThrow(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      businessShape: true,
      onboardingStatus: true,
      onboardingStep: true,
      onboardingCompletedAt: true,
      onboardingMeta: true,
    },
  });

  if (!company) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found' });
  }

  return company;
}

function computeNextStep(company: {
  businessShape: BusinessShape;
  onboardingStatus: string;
  onboardingStep: string;
}) {
  if (company.onboardingStatus === 'ACTIVE') {
    return { blockedReason: null, nextAction: null };
  }

  if (company.businessShape === 'PENDING') {
    return { blockedReason: 'PENDING_SHAPE', nextAction: 'SELECT_SHAPE' };
  }

  if (company.onboardingStep === 'WELCOME') {
    return { blockedReason: 'ONBOARDING_NOT_STARTED', nextAction: 'START' };
  }

  if (company.onboardingStep === 'OPENING_BALANCE') {
    return { blockedReason: 'OPENING_BALANCE_REQUIRED', nextAction: 'SUBMIT_OPENING_BALANCE' };
  }

  if (company.onboardingStep === 'FIRST_TRANSACTION') {
    return { blockedReason: 'FIRST_TRANSACTION_REQUIRED', nextAction: 'RUN_FIRST_TRANSACTION' };
  }

  if (company.onboardingStep === 'ALIVE_MOMENT') {
    return { blockedReason: 'FINALIZE_REQUIRED', nextAction: 'COMPLETE' };
  }

  return { blockedReason: 'ONBOARDING_IN_PROGRESS', nextAction: 'CONTINUE' };
}

export const onboardingRouter = router({
  getState: protectedProcedure.query(async ({ ctx }) => {
    const companyId = ctx.companyId!;
    const company = await getCompanyOrThrow(companyId);
    const { blockedReason, nextAction } = computeNextStep(company);

    return {
      companyId,
      businessShape: company.businessShape,
      onboardingStatus: company.onboardingStatus,
      onboardingStep: company.onboardingStep,
      onboardingCompletedAt: company.onboardingCompletedAt,
      onboardingMeta: company.onboardingMeta,
      blockedReason,
      nextAction,
    };
  }),

  start: protectedProcedure.mutation(async ({ ctx }) => {
    const companyId = ctx.companyId!;
    const company = await getCompanyOrThrow(companyId);

    if (company.onboardingStatus === 'ACTIVE') {
      return company;
    }

    const nextStep =
      company.businessShape === 'PENDING' ? 'BUSINESS_SHAPE' : 'OPENING_BALANCE';

    return prisma.company.update({
      where: { id: companyId },
      data: {
        onboardingStatus: 'IN_PROGRESS',
        onboardingStep: nextStep,
      },
      select: {
        id: true,
        businessShape: true,
        onboardingStatus: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
        onboardingMeta: true,
      },
    });
  }),

  selectBusinessShape: protectedProcedure
    .input(SelectBusinessShapeSchema)
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.companyId!;
      const company = await getCompanyOrThrow(companyId);

      if (company.onboardingStatus === 'ACTIVE') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Company onboarding already completed',
        });
      }

      if (company.businessShape !== 'PENDING') {
        return prisma.company.update({
          where: { id: companyId },
          data: {
            onboardingStatus: 'IN_PROGRESS',
            onboardingStep: 'OPENING_BALANCE',
          },
          select: {
            id: true,
            businessShape: true,
            onboardingStatus: true,
            onboardingStep: true,
            onboardingCompletedAt: true,
            onboardingMeta: true,
          },
        });
      }

      const companyService = container.resolve<CompanyService>(
        ServiceKeys.COMPANY_SERVICE
      );

      await companyService.selectShape(
        companyId,
        coerceBusinessShape(input.shape),
        company.businessShape
      );

      return prisma.company.update({
        where: { id: companyId },
        data: {
          onboardingStatus: 'IN_PROGRESS',
          onboardingStep: 'OPENING_BALANCE',
        },
        select: {
          id: true,
          businessShape: true,
          onboardingStatus: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
          onboardingMeta: true,
        },
      });
    }),

  submitOpeningBalance: protectedProcedure
    .input(SubmitOpeningBalanceSchema)
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.companyId!;
      const company = await getCompanyOrThrow(companyId);

      if (company.onboardingStatus === 'ACTIVE') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Company onboarding already completed',
        });
      }

      if (company.businessShape === 'PENDING') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Select business shape before continuing onboarding',
        });
      }

      if (company.onboardingStep !== 'OPENING_BALANCE') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Onboarding step mismatch',
        });
      }

      const total = input.cash + input.bank;
      let openingJournalId: string | null = null;

      if (total > 0) {
        const existing = await prisma.journalEntry.findFirst({
          where: {
            companyId,
            reference: 'ONBOARDING_OPENING_BALANCE',
          },
          select: { id: true },
        });

        if (existing) {
          openingJournalId = existing.id;
        } else {
          const accountService = container.resolve<AccountService>(
            ServiceKeys.ACCOUNT_SERVICE
          );
          const journalRepository = container.resolve<JournalRepository>(
            ServiceKeys.JOURNAL_REPOSITORY
          );
          const journalCoreService = new JournalCoreService(
            journalRepository,
            accountService
          );

          const debitLines = [
            ...(input.cash > 0
              ? [
                  {
                    accountCode: '1100',
                    debit: input.cash,
                    credit: 0,
                    description: 'Opening cash',
                  },
                ]
              : []),
            ...(input.bank > 0
              ? [
                  {
                    accountCode: '1200',
                    debit: input.bank,
                    credit: 0,
                    description: 'Opening bank',
                  },
                ]
              : []),
          ];

          const lines = [
            ...debitLines,
            {
              accountCode: '3200',
              debit: 0,
              credit: total,
              description: 'Opening capital',
            },
          ];

          const created = await journalCoreService.resolveAndCreate(
            companyId,
            {
              date: new Date(),
              reference: 'ONBOARDING_OPENING_BALANCE',
              memo: 'Opening balance (onboarding)',
              lines,
            }
          );

          openingJournalId = created.id;
        }
      }

      const baseMeta =
        company.onboardingMeta &&
        typeof company.onboardingMeta === 'object' &&
        !Array.isArray(company.onboardingMeta)
          ? (company.onboardingMeta as Record<string, unknown>)
          : {};

      return prisma.company.update({
        where: { id: companyId },
        data: {
          onboardingStep: 'FIRST_TRANSACTION',
          onboardingMeta: {
            ...baseMeta,
            openingBalance: {
              cash: input.cash,
              bank: input.bank,
              total,
              journalId: openingJournalId,
            },
          },
        },
        select: {
          id: true,
          businessShape: true,
          onboardingStatus: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
          onboardingMeta: true,
        },
      });
    }),

  runFirstTransactionRetail: protectedProcedure
    .input(RunFirstTransactionRetailSchema)
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.companyId!;
      const company = await getCompanyOrThrow(companyId);

      if (company.onboardingStatus === 'ACTIVE') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Company onboarding already completed',
        });
      }

      if (company.businessShape !== 'RETAIL') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'First transaction v1 only supports Retail',
        });
      }

      if (company.onboardingStep !== 'FIRST_TRANSACTION') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Onboarding step mismatch',
        });
      }

      const existing = (company.onboardingMeta as Record<string, unknown> | null)
        ?.firstTransaction as Record<string, unknown> | undefined;

      if (
        existing &&
        typeof existing.purchaseOrderId === 'string' &&
        typeof existing.grnId === 'string'
      ) {
        return {
          purchaseOrderId: existing.purchaseOrderId,
          grnId: existing.grnId,
          billId: existing.billId ?? null,
          paymentId: existing.paymentId ?? null,
        };
      }

      const partnerService = container.resolve<PartnerService>(
        ServiceKeys.PARTNER_SERVICE
      );
      const productService = container.resolve<ProductService>(
        ServiceKeys.PRODUCT_SERVICE
      );
      const purchaseOrderService = container.resolve<PurchaseOrderService>(
        ServiceKeys.PURCHASE_ORDER_SERVICE
      );
      const inventoryService = container.resolve<InventoryService>(
        ServiceKeys.INVENTORY_SERVICE
      );
      const billService = container.resolve<BillService>(ServiceKeys.BILL_SERVICE);
      const paymentService = container.resolve<PaymentService>(
        ServiceKeys.PAYMENT_SERVICE
      );

      const supplier = await prisma.partner.findFirst({
        where: {
          companyId,
          type: 'SUPPLIER',
          name: input.supplierName,
        },
      });

      const supplierId = supplier
        ? supplier.id
        : (
            await partnerService.create(companyId, {
              name: input.supplierName,
              type: 'SUPPLIER',
            })
          ).id;

      const sku = input.productName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 12);

      const existingProduct = await prisma.product.findFirst({
        where: {
          companyId,
          name: input.productName,
        },
      });

      const productId = existingProduct
        ? existingProduct.id
        : (
            await productService.create(companyId, {
              sku: sku.length >= 3 ? sku : `SKU-${Date.now()}`,
              name: input.productName,
              price: input.unitPrice,
            })
          ).id;

      const reference = `ONB-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '')}`;

      const createdPo = await purchaseOrderService.create(companyId, {
        type: 'PURCHASE',
        partnerId: supplierId,
        paymentTerms: 'NET30',
        items: [
          {
            productId,
            quantity: input.quantity,
            price: input.unitPrice,
          },
        ],
      });

      const confirmedPo = await purchaseOrderService.confirm(
        createdPo.id,
        companyId,
        ctx.userId
      );

      const createdGrn = await inventoryService.createGRN(companyId, {
        purchaseOrderId: confirmedPo.id,
        date: new Date().toISOString(),
        notes: 'Onboarding first transaction',
        items: [
          {
            productId,
            quantity: input.quantity,
          },
        ],
      });

      const postedGrn = await inventoryService.postGRN(
        companyId,
        createdGrn.id,
        undefined,
        ctx.userId
      );

      let billId: string | null = null;
      let paymentId: string | null = null;

      if (input.payNow) {
        const bill = await billService.createFromPurchaseOrder(companyId, {
          orderId: confirmedPo.id,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          supplierInvoiceNumber: `${reference}-SUP`,
          businessDate: new Date(),
        });

        const postedBill = await billService.post(bill.id, companyId);
        billId = postedBill.id;

        const payment = await paymentService.create(companyId, {
          invoiceId: postedBill.id,
          amount: Number(postedBill.amount),
          businessDate: new Date(),
          method: 'CASH',
          reference: `${reference}-PAY`,
          correlationId: `${reference}-PAY`,
        });

        paymentId = payment.id;
      }

      const baseMeta =
        company.onboardingMeta &&
        typeof company.onboardingMeta === 'object' &&
        !Array.isArray(company.onboardingMeta)
          ? (company.onboardingMeta as Record<string, unknown>)
          : {};

      await prisma.company.update({
        where: { id: companyId },
        data: {
          onboardingStep: 'ALIVE_MOMENT',
          onboardingMeta: {
            ...baseMeta,
            firstTransaction: {
              purchaseOrderId: confirmedPo.id,
              grnId: postedGrn.id,
              billId,
              paymentId,
              productId,
              supplierId,
            },
          },
        },
      });

      return {
        purchaseOrderId: confirmedPo.id,
        grnId: postedGrn.id,
        billId,
        paymentId,
      };
    }),

  complete: protectedProcedure.mutation(async ({ ctx }) => {
    const companyId = ctx.companyId!;
    const company = await getCompanyOrThrow(companyId);

    if (company.onboardingStatus === 'ACTIVE') {
      return company;
    }

    if (company.onboardingStep !== 'ALIVE_MOMENT') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Onboarding step mismatch',
      });
    }

    return prisma.company.update({
      where: { id: companyId },
      data: {
        onboardingStatus: 'ACTIVE',
        onboardingStep: 'DONE',
        onboardingCompletedAt: new Date(),
      },
      select: {
        id: true,
        businessShape: true,
        onboardingStatus: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
        onboardingMeta: true,
      },
    });
  }),
});
