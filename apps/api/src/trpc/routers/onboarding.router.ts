import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import {
  prisma,
  BusinessShape,
  PartnerType,
  CompanyOnboardingStatus,
  CompanyOnboardingStep,
  PaymentTerms,
  PaymentMethodType,
  AccountType,
} from '@sync-erp/database';
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
  shape: z
    .nativeEnum(BusinessShape)
    .refine((shape) => shape !== BusinessShape.PENDING),
});

const AccountItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Nama akun wajib diisi'),
  type: z.enum(['CASH', 'BANK']),
  accountNumber: z.string().trim().optional(),
  balance: z.number().min(0, 'Saldo tidak boleh negatif'),
});

const SubmitOpeningBalanceSchema = z.object({
  cash: z.number().min(0).optional(),
  bank: z.number().min(0).optional(),
  accounts: z.array(AccountItemSchema).optional(),
});

const RunFirstTransactionRetailSchema = z.object({
  supplierName: z.string().min(2),
  productName: z.string().min(2),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  payNow: z.boolean().optional(),
});

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
  onboardingStatus: CompanyOnboardingStatus;
  onboardingStep: CompanyOnboardingStep;
}) {
  if (company.onboardingStatus === CompanyOnboardingStatus.ACTIVE) {
    return { blockedReason: null, nextAction: null };
  }

  if (company.businessShape === BusinessShape.PENDING) {
    return { blockedReason: 'PENDING_SHAPE', nextAction: 'SELECT_SHAPE' };
  }

  if (company.onboardingStep === CompanyOnboardingStep.WELCOME) {
    return { blockedReason: 'ONBOARDING_NOT_STARTED', nextAction: 'START' };
  }

  if (company.onboardingStep === CompanyOnboardingStep.OPENING_BALANCE) {
    return { blockedReason: 'OPENING_BALANCE_REQUIRED', nextAction: 'SUBMIT_OPENING_BALANCE' };
  }

  if (
    company.onboardingStep === CompanyOnboardingStep.FIRST_TRANSACTION ||
    company.onboardingStep === CompanyOnboardingStep.ALIVE_MOMENT
  ) {
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

    if (company.onboardingStatus === CompanyOnboardingStatus.ACTIVE) {
      return company;
    }

    const nextStep =
      company.businessShape === BusinessShape.PENDING
        ? CompanyOnboardingStep.BUSINESS_SHAPE
        : CompanyOnboardingStep.OPENING_BALANCE;

    return prisma.company.update({
      where: { id: companyId },
      data: {
        onboardingStatus: CompanyOnboardingStatus.IN_PROGRESS,
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

      if (company.onboardingStatus === CompanyOnboardingStatus.ACTIVE) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Company onboarding already completed',
        });
      }

      if (company.businessShape !== BusinessShape.PENDING) {
        if (company.businessShape === input.shape) {
          return prisma.company.update({
            where: { id: companyId },
            data: {
              onboardingStatus: CompanyOnboardingStatus.IN_PROGRESS,
              onboardingStep: CompanyOnboardingStep.OPENING_BALANCE,
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

        // Shape is being changed during onboarding: verify no journal entries exist
        const journalCount = await prisma.journalEntry.count({
          where: { companyId },
        });

        if (journalCount > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              'Tipe bisnis tidak dapat diubah karena jurnal transaksi sudah tercatat.',
          });
        }

        const companyService = container.resolve<CompanyService>(
          ServiceKeys.COMPANY_SERVICE
        );

        await companyService.selectShape(
          companyId,
          input.shape,
          company.businessShape,
          true
        );

        return prisma.company.update({
          where: { id: companyId },
          data: {
            onboardingStatus: CompanyOnboardingStatus.IN_PROGRESS,
            onboardingStep: CompanyOnboardingStep.OPENING_BALANCE,
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
        input.shape,
        company.businessShape
      );

      return prisma.company.update({
        where: { id: companyId },
        data: {
          onboardingStatus: CompanyOnboardingStatus.IN_PROGRESS,
          onboardingStep: CompanyOnboardingStep.OPENING_BALANCE,
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

      if (company.onboardingStatus === CompanyOnboardingStatus.ACTIVE) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Company onboarding already completed',
        });
      }

      if (company.businessShape === BusinessShape.PENDING) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Select business shape before continuing onboarding',
        });
      }

      const allowedOpeningSteps: CompanyOnboardingStep[] = [
        CompanyOnboardingStep.OPENING_BALANCE,
        CompanyOnboardingStep.FIRST_TRANSACTION,
        CompanyOnboardingStep.ALIVE_MOMENT,
      ];
      if (!allowedOpeningSteps.includes(company.onboardingStep)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Onboarding step mismatch',
        });
      }

      // Cleanup existing opening balance journal if re-running opening balance
      const existingJournal = await prisma.journalEntry.findFirst({
        where: {
          companyId,
          reference: 'ONBOARDING_OPENING_BALANCE',
        },
        select: { id: true },
      });

      if (existingJournal) {
        await prisma.journalLine.deleteMany({
          where: { journalId: existingJournal.id },
        });
        await prisma.journalEntry.delete({
          where: { id: existingJournal.id },
        });
      }

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

      let openingJournalId: string | null = null;
      let total = 0;
      let totalCash = 0;
      let totalBank = 0;
      const accountMetaList: Array<{
        name: string;
        type: 'CASH' | 'BANK';
        code: string;
        balance: number;
        accountId: string;
      }> = [];

      if (input.accounts && input.accounts.length > 0) {
        // Ensure Cash parent account (1000) exists
        let cashParent = await prisma.account.findUnique({
          where: { companyId_code: { companyId, code: '1000' } },
        });
        if (!cashParent) {
          cashParent = await prisma.account.create({
            data: {
              companyId,
              code: '1000',
              name: 'Kas',
              type: AccountType.ASSET,
              isGroup: true,
            },
          });
        } else if (!cashParent.isGroup) {
          await prisma.account.update({
            where: { id: cashParent.id },
            data: { isGroup: true },
          });
        }

        // Ensure Bank parent account (1050) exists
        let bankParent = await prisma.account.findUnique({
          where: { companyId_code: { companyId, code: '1050' } },
        });
        if (!bankParent) {
          bankParent = await prisma.account.create({
            data: {
              companyId,
              code: '1050',
              name: 'Rekening Bank',
              type: AccountType.ASSET,
              isGroup: true,
            },
          });
        } else if (!bankParent.isGroup) {
          await prisma.account.update({
            where: { id: bankParent.id },
            data: { isGroup: true },
          });
        }

        // Ensure Capital account (3200) exists
        const capitalAccount = await prisma.account.findUnique({
          where: { companyId_code: { companyId, code: '3200' } },
        });
        if (!capitalAccount) {
          await prisma.account.create({
            data: {
              companyId,
              code: '3200',
              name: 'Modal Pemilik',
              type: AccountType.EQUITY,
            },
          });
        }

        const debitLines: Array<{
          accountCode: string;
          debit: number;
          credit: number;
          description: string;
        }> = [];

        for (let i = 0; i < input.accounts.length; i++) {
          const accItem = input.accounts[i];
          const isCash = accItem.type === 'CASH';
          const prefix = isCash ? '100' : '105';
          const parentId = isCash ? cashParent.id : bankParent.id;

          if (isCash) totalCash += accItem.balance;
          else totalBank += accItem.balance;

          // Find existing account with same name or create new
          let glAccount = await prisma.account.findFirst({
            where: {
              companyId,
              name: accItem.name,
              type: AccountType.ASSET,
            },
          });

          if (!glAccount) {
            const maxCode = await prisma.account.findFirst({
              where: {
                companyId,
                code: { startsWith: prefix },
                NOT: { code: isCash ? '1000' : '1050' },
              },
              orderBy: { code: 'desc' },
              select: { code: true },
            });

            let nextNum = isCash ? 1001 : 1051;
            if (maxCode) {
              const parsed = parseInt(maxCode.code, 10);
              if (!isNaN(parsed) && parsed >= nextNum) {
                nextNum = parsed + 1;
              }
            }

            glAccount = await prisma.account.create({
              data: {
                companyId,
                code: nextNum.toString(),
                name: accItem.name,
                type: AccountType.ASSET,
                parentId,
                isGroup: false,
              },
            });
          }

          accountMetaList.push({
            name: accItem.name,
            type: accItem.type,
            code: glAccount.code,
            balance: accItem.balance,
            accountId: glAccount.id,
          });

          // If BANK, link BankAccount
          if (!isCash) {
            const existingBankAcc = await prisma.bankAccount.findFirst({
              where: { companyId, accountId: glAccount.id },
            });
            if (!existingBankAcc) {
              await prisma.bankAccount.create({
                data: {
                  companyId,
                  accountId: glAccount.id,
                  bankName: accItem.name,
                  accountNumber: accItem.accountNumber || '',
                  currency: 'IDR',
                },
              });
            }
          }

          // Register payment method
          const methodCode = `${accItem.type}_${glAccount.code}`;
          const existingMethod = await prisma.companyPaymentMethod.findFirst({
            where: { companyId, code: methodCode },
          });
          if (!existingMethod) {
            await prisma.companyPaymentMethod.create({
              data: {
                companyId,
                code: methodCode,
                name: accItem.name,
                type: isCash ? PaymentMethodType.CASH : PaymentMethodType.BANK,
                accountId: glAccount.id,
                isActive: true,
                isDefault: i === 0,
                sortOrder: i,
              },
            });
          }

          if (accItem.balance > 0) {
            debitLines.push({
              accountCode: glAccount.code,
              debit: accItem.balance,
              credit: 0,
              description: `Saldo awal: ${accItem.name}`,
            });
          }
        }

        total = totalCash + totalBank;

        if (total > 0 && debitLines.length > 0) {
          const lines = [
            ...debitLines,
            {
              accountCode: '3200',
              debit: 0,
              credit: total,
              description: 'Modal awal pemilik (onboarding)',
            },
          ];

          const created = await journalCoreService.resolveAndCreate(
            companyId,
            {
              date: new Date(),
              reference: 'ONBOARDING_OPENING_BALANCE',
              memo: 'Saldo awal kas & bank (onboarding)',
              lines,
            }
          );
          openingJournalId = created.id;
        }
      } else {
        // Legacy fallback
        totalCash = input.cash || 0;
        totalBank = input.bank || 0;
        total = totalCash + totalBank;

        if (total > 0) {
          const debitLines = [
            ...(totalCash > 0
              ? [
                  {
                    accountCode: '1000',
                    debit: totalCash,
                    credit: 0,
                    description: 'Opening cash',
                  },
                ]
              : []),
            ...(totalBank > 0
              ? [
                  {
                    accountCode: '1050',
                    debit: totalBank,
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
          onboardingStep: CompanyOnboardingStep.ALIVE_MOMENT,
          onboardingMeta: {
            ...baseMeta,
            openingBalance: {
              cash: totalCash,
              bank: totalBank,
              total,
              journalId: openingJournalId,
              accounts: accountMetaList,
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

      if (company.onboardingStatus === CompanyOnboardingStatus.ACTIVE) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Company onboarding already completed',
        });
      }

      if (company.businessShape === BusinessShape.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Pilih tipe bisnis terlebih dahulu sebelum mencatat transaksi',
        });
      }

      if (company.onboardingStep !== CompanyOnboardingStep.FIRST_TRANSACTION) {
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
          type: PartnerType.SUPPLIER,
          name: input.supplierName,
        },
      });

      const supplierId = supplier
        ? supplier.id
        : (
            await partnerService.create(companyId, {
              name: input.supplierName,
              type: PartnerType.SUPPLIER,
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
        paymentTerms: PaymentTerms.NET30,
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

        const defaultMethod = await prisma.companyPaymentMethod.findFirst({
          where: { companyId, isActive: true },
          orderBy: { sortOrder: 'asc' },
        });

        const payment = await paymentService.create(companyId, {
          invoiceId: postedBill.id,
          amount: Number(postedBill.amount),
          businessDate: new Date(),
          method: defaultMethod?.type ?? PaymentMethodType.CASH,
          paymentMethodId: defaultMethod?.id,
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
          onboardingStep: CompanyOnboardingStep.ALIVE_MOMENT,
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

    if (company.onboardingStatus === CompanyOnboardingStatus.ACTIVE) {
      return company;
    }

    const allowedCompleteSteps: CompanyOnboardingStep[] = [
      CompanyOnboardingStep.ALIVE_MOMENT,
      CompanyOnboardingStep.FIRST_TRANSACTION,
    ];
    if (!allowedCompleteSteps.includes(company.onboardingStep)) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Onboarding step mismatch',
      });
    }

    return prisma.company.update({
      where: { id: companyId },
      data: {
        onboardingStatus: CompanyOnboardingStatus.ACTIVE,
        onboardingStep: CompanyOnboardingStep.DONE,
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
