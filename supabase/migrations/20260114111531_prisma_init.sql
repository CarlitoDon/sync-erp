-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('INVOICE', 'BILL', 'PAYMENT', 'CREDIT_NOTE', 'ADJUSTMENT', 'CASH_TRANSACTION', 'RENTAL_DEPOSIT', 'RENTAL_RETURN');

-- CreateEnum
CREATE TYPE "PermissionModule" AS ENUM ('COMPANY', 'SALES', 'PURCHASING', 'INVENTORY', 'FINANCE', 'USERS', 'RENTAL');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'VOID');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('ALL', 'OWN');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('SALES', 'PURCHASE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'BILL', 'EXPENSE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'RENTAL');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "BusinessShape" AS ENUM ('PENDING', 'RETAIL', 'MANUFACTURING', 'SERVICE', 'RENTAL');

-- CreateEnum
CREATE TYPE "CostingMethod" AS ENUM ('AVG', 'FIFO');

-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('NET7', 'NET30', 'NET60', 'NET90', 'COD', 'EOM', 'NET_30', 'UPFRONT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID_UPFRONT', 'SETTLED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('RECEIPT', 'SHIPMENT', 'RETURN', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "SequenceType" AS ENUM ('PO', 'GRN', 'SHP', 'BILL', 'PAY', 'SO', 'INV', 'CN', 'JE', 'DN', 'RET', 'PRR', 'RNT');

-- CreateEnum
CREATE TYPE "IdempotencyScope" AS ENUM ('INVOICE_POST', 'PAYMENT_CREATE', 'BILL_CREATE', 'INVOICE_CREATE', 'GRN_CREATE', 'SHIPMENT_CREATE', 'ORDER_CREATE', 'CASH_TRANSACTION_POST');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditLogAction" AS ENUM ('INVOICE_POSTED', 'INVOICE_VOIDED', 'BILL_POSTED', 'BILL_VOIDED', 'PAYMENT_RECORDED', 'ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_CANCELLED', 'GOODS_RECEIVED', 'SHIPMENT_CREATED', 'GRN_POSTED', 'GRN_VOIDED', 'SHIPMENT_VOIDED', 'PAYMENT_VOIDED', 'PRICE_VARIANCE_ACKNOWLEDGED', 'CASH_TRANSACTION_POSTED', 'CASH_TRANSACTION_VOIDED', 'RENTAL_ITEM_CREATED', 'RENTAL_UNIT_ADDED', 'RENTAL_ORDER_CREATED', 'RENTAL_ORDER_CONFIRMED', 'RENTAL_ORDER_RELEASED', 'RENTAL_ORDER_CANCELLED', 'RENTAL_RETURN_PROCESSED', 'RENTAL_RETURN_SETTLED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('INVOICE', 'BILL', 'PAYMENT', 'ORDER', 'SHIPMENT', 'GOODS_RECEIPT', 'BANK_ACCOUNT', 'CASH_TRANSACTION', 'RENTAL_ITEM', 'RENTAL_ITEM_UNIT', 'RENTAL_ORDER', 'RENTAL_RETURN', 'RENTAL_POLICY');

-- CreateEnum
CREATE TYPE "SagaType" AS ENUM ('INVOICE_POST', 'SHIPMENT', 'GOODS_RECEIPT', 'BILL_POST', 'PAYMENT_POST', 'CREDIT_NOTE', 'STOCK_TRANSFER', 'STOCK_RETURN');

-- CreateEnum
CREATE TYPE "SagaStep" AS ENUM ('PENDING', 'STOCK_DONE', 'BALANCE_DONE', 'JOURNAL_DONE', 'COMPLETED', 'FAILED', 'COMPENSATION_FAILED');

-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('SPEND', 'RECEIVE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "CashTransactionStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "DepositPolicyType" AS ENUM ('PERCENTAGE', 'PER_UNIT', 'HYBRID');

-- CreateEnum
CREATE TYPE "UnitCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RENTED', 'RETURNED', 'CLEANING', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "RentalOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalPaymentStatus" AS ENUM ('PENDING', 'AWAITING_CONFIRM', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('ADMIN', 'WEBSITE');

-- CreateEnum
CREATE TYPE "PricingTier" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'COLLECTED', 'REFUNDED', 'FORFEITED', 'PARTIAL_REFUND');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT', 'SETTLED');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('RELEASE', 'RETURN', 'INSPECTION', 'CLEANING');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('MINOR', 'MAJOR', 'UNUSABLE');

-- CreateEnum
CREATE TYPE "CleaningType" AS ENUM ('STANDARD', 'DEEP', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NORMAL', 'WATCHLIST', 'BLACKLISTED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessShape" "BusinessShape" NOT NULL DEFAULT 'PENDING',
    "inviteCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "street" TEXT,
    "kelurahan" TEXT,
    "kecamatan" TEXT,
    "kota" TEXT,
    "provinsi" TEXT,
    "zip" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "averageCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'PCS',
    "costingMethod" "CostingMethod" NOT NULL DEFAULT 'AVG',
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderNumber" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'NET_30',
    "paymentStatus" "PaymentStatus",
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "dpPercent" DECIMAL(5,2),
    "dpAmount" DECIMAL(15,2),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "cost" DECIMAL(15,2),

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "orderId" TEXT,
    "fulfillmentId" TEXT,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT,
    "partnerId" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(15,2) NOT NULL,
    "supplierInvoiceNumber" TEXT,
    "paymentTermsString" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "relatedInvoiceId" TEXT,
    "isDownPayment" BOOLEAN NOT NULL DEFAULT false,
    "dpBillId" TEXT,
    "fulfillmentId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "orderId" TEXT,
    "paymentType" TEXT NOT NULL DEFAULT 'INVOICE',
    "settledAt" TIMESTAMP(3),
    "settlementBillId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "accountId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "sourceType" "JournalSourceType",
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "module" "PermissionModule" NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "scope" "PermissionScope" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "SequenceType" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLayer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "qtyRemaining" INTEGER NOT NULL,
    "unitCost" DECIMAL(15,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scope" "IdempotencyScope" NOT NULL,
    "entityId" TEXT,
    "status" "IdempotencyStatus" NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SagaLog" (
    "id" TEXT NOT NULL,
    "sagaType" "SagaType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "step" "SagaStep" NOT NULL,
    "stepData" JSONB,
    "error" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SagaLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditLogAction" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "payloadSnapshot" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashTransactionId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fulfillment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "FulfillmentType" NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "receivedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentItem" (
    "id" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "costSnapshot" DECIMAL(15,2),

    CONSTRAINT "FulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CashTransactionType" NOT NULL,
    "status" "CashTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "payee" TEXT,
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "sourceBankAccountId" TEXT,
    "destinationBankAccountId" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransactionItem" (
    "id" TEXT NOT NULL,
    "cashTransactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "CashTransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "dailyRate" DECIMAL(15,2) NOT NULL,
    "weeklyRate" DECIMAL(15,2) NOT NULL,
    "monthlyRate" DECIMAL(15,2) NOT NULL,
    "depositPolicyType" "DepositPolicyType" NOT NULL,
    "depositPercentage" DECIMAL(5,2),
    "depositPerUnit" DECIMAL(15,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalBundle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "dailyRate" DECIMAL(15,2) NOT NULL,
    "weeklyRate" DECIMAL(15,2),
    "monthlyRate" DECIMAL(15,2),
    "dimensions" TEXT,
    "capacity" TEXT,
    "imagePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalBundleComponent" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "componentLabel" TEXT NOT NULL,

    CONSTRAINT "RentalBundleComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalItemUnit" (
    "id" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "condition" "UnitCondition" NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "totalRentalDays" INTEGER NOT NULL DEFAULT 0,
    "totalRentalCount" INTEGER NOT NULL DEFAULT 0,
    "lastDeepCleaningAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "retirementReason" TEXT,
    "flaggedForRetirement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalItemUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "rentalStartDate" TIMESTAMP(3) NOT NULL,
    "rentalEndDate" TIMESTAMP(3) NOT NULL,
    "dueDateTime" TIMESTAMP(3) NOT NULL,
    "status" "RentalOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "depositAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "publicToken" TEXT,
    "deliveryFee" DECIMAL(15,2),
    "deliveryAddress" TEXT,
    "street" TEXT,
    "kelurahan" TEXT,
    "kecamatan" TEXT,
    "kota" TEXT,
    "provinsi" TEXT,
    "zip" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "paymentMethod" TEXT,
    "discountAmount" DECIMAL(15,2),
    "discountLabel" TEXT,
    "orderSource" "OrderSource" NOT NULL DEFAULT 'ADMIN',
    "rentalPaymentStatus" "RentalPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentClaimedAt" TIMESTAMP(3),
    "paymentConfirmedAt" TIMESTAMP(3),
    "paymentConfirmedBy" TEXT,
    "paymentReference" TEXT,
    "paymentFailedAt" TIMESTAMP(3),
    "paymentFailReason" TEXT,

    CONSTRAINT "RentalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalOrderExtension" (
    "id" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "extensionNumber" INTEGER NOT NULL,
    "previousEndDate" TIMESTAMP(3) NOT NULL,
    "newEndDate" TIMESTAMP(3) NOT NULL,
    "additionalDays" INTEGER NOT NULL,
    "additionalAmount" DECIMAL(15,2) NOT NULL,
    "additionalDeposit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "RentalOrderExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalOrderItem" (
    "id" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "rentalItemId" TEXT,
    "rentalBundleId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "pricingTier" "PricingTier" NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "RentalOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalOrderUnitAssignment" (
    "id" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "rentalItemUnitId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3),
    "overriddenBy" TEXT,
    "overrideReason" TEXT,

    CONSTRAINT "RentalOrderUnitAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalDeposit" (
    "id" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "policyType" "DepositPolicyType" NOT NULL,
    "status" "DepositStatus" NOT NULL,
    "collectedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "forfeitedAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,

    CONSTRAINT "RentalDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalDepositAllocation" (
    "id" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "maxCoveredAmount" DECIMAL(15,2) NOT NULL,
    "usedAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "RentalDepositAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalReturn" (
    "id" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3) NOT NULL,
    "baseRentalFee" DECIMAL(15,2) NOT NULL,
    "lateFee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "damageCharges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cleaningFee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalCharges" DECIMAL(15,2) NOT NULL,
    "depositDeduction" DECIMAL(15,2) NOT NULL,
    "additionalChargesDue" DECIMAL(15,2) NOT NULL,
    "depositRefund" DECIMAL(15,2) NOT NULL,
    "settlementStatus" "ReturnStatus" NOT NULL,
    "settledAt" TIMESTAMP(3),
    "settledBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedBy" TEXT NOT NULL,

    CONSTRAINT "RentalReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemConditionLog" (
    "id" TEXT NOT NULL,
    "rentalItemUnitId" TEXT NOT NULL,
    "rentalOrderId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conditionType" "ConditionType" NOT NULL,
    "condition" "UnitCondition" NOT NULL,
    "damageSeverity" "DamageSeverity",
    "beforePhotos" TEXT[],
    "afterPhotos" TEXT[],
    "notes" TEXT,
    "assessedBy" TEXT NOT NULL,

    CONSTRAINT "ItemConditionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningLog" (
    "id" TEXT NOT NULL,
    "rentalItemUnitId" TEXT NOT NULL,
    "cleanedAt" TIMESTAMP(3) NOT NULL,
    "cleanedBy" TEXT NOT NULL,
    "cleaningType" "CleaningType" NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "CleaningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRentalRisk" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "notes" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "flaggedBy" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "totalRentals" INTEGER NOT NULL DEFAULT 0,
    "lateReturns" INTEGER NOT NULL DEFAULT 0,
    "damageIncidents" INTEGER NOT NULL DEFAULT 0,
    "depositForfeits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomerRentalRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gracePeriodHours" INTEGER NOT NULL,
    "cleaningFee" DECIMAL(15,2) NOT NULL,
    "lateFeeDailyRate" DECIMAL(15,2) NOT NULL,
    "defaultDepositPolicyType" "DepositPolicyType" NOT NULL,
    "defaultDepositPercentage" DECIMAL(5,2),
    "defaultDepositPerUnit" DECIMAL(15,2),
    "pickupGracePeriodHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "RentalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalDamagePolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" TEXT,
    "rentalItemId" TEXT,
    "severity" "DamageSeverity" NOT NULL,
    "charge" DECIMAL(15,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalDamagePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_inviteCode_key" ON "Company"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CompanyMember_companyId_idx" ON "CompanyMember"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_userId_companyId_key" ON "CompanyMember"("userId", "companyId");

-- CreateIndex
CREATE INDEX "Partner_companyId_idx" ON "Partner"("companyId");

-- CreateIndex
CREATE INDEX "Partner_companyId_type_idx" ON "Partner"("companyId", "type");

-- CreateIndex
CREATE INDEX "Partner_kota_idx" ON "Partner"("kota");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Order_companyId_type_idx" ON "Order"("companyId", "type");

-- CreateIndex
CREATE INDEX "Order_companyId_status_idx" ON "Order"("companyId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "InventoryMovement_companyId_idx" ON "InventoryMovement"("companyId");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_warehouseId_idx" ON "InventoryMovement"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryMovement_companyId_productId_idx" ON "InventoryMovement"("companyId", "productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- CreateIndex
CREATE INDEX "InventoryMovement_fulfillmentId_idx" ON "InventoryMovement"("fulfillmentId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_type_idx" ON "Invoice"("companyId", "type");

-- CreateIndex
CREATE INDEX "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");

-- CreateIndex
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_paymentType_idx" ON "Payment"("paymentType");

-- CreateIndex
CREATE INDEX "Account_companyId_idx" ON "Account"("companyId");

-- CreateIndex
CREATE INDEX "Account_companyId_type_idx" ON "Account"("companyId", "type");

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_companyId_code_key" ON "Account"("companyId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_companyId_idx" ON "JournalEntry"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_companyId_sourceType_sourceId_key" ON "JournalEntry"("companyId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalLine_journalId_idx" ON "JournalLine"("journalId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_module_action_scope_key" ON "Permission"("module", "action", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "SystemConfig_companyId_idx" ON "SystemConfig"("companyId");

-- CreateIndex
CREATE INDEX "DocumentSequence_companyId_idx" ON "DocumentSequence"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_companyId_type_year_month_key" ON "DocumentSequence"("companyId", "type", "year", "month");

-- CreateIndex
CREATE INDEX "Warehouse_companyId_idx" ON "Warehouse"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_code_key" ON "Warehouse"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProductCategory_companyId_idx" ON "ProductCategory"("companyId");

-- CreateIndex
CREATE INDEX "StockLayer_productId_idx" ON "StockLayer"("productId");

-- CreateIndex
CREATE INDEX "StockLayer_warehouseId_idx" ON "StockLayer"("warehouseId");

-- CreateIndex
CREATE INDEX "StockLayer_warehouseId_receivedAt_idx" ON "StockLayer"("warehouseId", "receivedAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_companyId_idx" ON "IdempotencyKey"("companyId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_companyId_scope_entityId_idx" ON "IdempotencyKey"("companyId", "scope", "entityId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_status_updatedAt_idx" ON "IdempotencyKey"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SagaLog_entityId_idx" ON "SagaLog"("entityId");

-- CreateIndex
CREATE INDEX "SagaLog_companyId_sagaType_step_idx" ON "SagaLog"("companyId", "sagaType", "step");

-- CreateIndex
CREATE INDEX "SagaLog_correlationId_idx" ON "SagaLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_action_idx" ON "AuditLog"("companyId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_businessDate_idx" ON "AuditLog"("businessDate");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "Fulfillment_companyId_idx" ON "Fulfillment"("companyId");

-- CreateIndex
CREATE INDEX "Fulfillment_orderId_idx" ON "Fulfillment"("orderId");

-- CreateIndex
CREATE INDEX "Fulfillment_type_idx" ON "Fulfillment"("type");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_companyId_accountId_key" ON "BankAccount"("companyId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CashTransaction_journalEntryId_key" ON "CashTransaction"("journalEntryId");

-- CreateIndex
CREATE INDEX "CashTransaction_companyId_idx" ON "CashTransaction"("companyId");

-- CreateIndex
CREATE INDEX "CashTransaction_companyId_type_idx" ON "CashTransaction"("companyId", "type");

-- CreateIndex
CREATE INDEX "CashTransaction_date_idx" ON "CashTransaction"("date");

-- CreateIndex
CREATE INDEX "CashTransactionItem_cashTransactionId_idx" ON "CashTransactionItem"("cashTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalItem_productId_key" ON "RentalItem"("productId");

-- CreateIndex
CREATE INDEX "RentalItem_companyId_idx" ON "RentalItem"("companyId");

-- CreateIndex
CREATE INDEX "RentalItem_companyId_isActive_idx" ON "RentalItem"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "RentalItem_productId_idx" ON "RentalItem"("productId");

-- CreateIndex
CREATE INDEX "RentalBundle_companyId_idx" ON "RentalBundle"("companyId");

-- CreateIndex
CREATE INDEX "RentalBundle_companyId_isActive_idx" ON "RentalBundle"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBundle_companyId_externalId_key" ON "RentalBundle"("companyId", "externalId");

-- CreateIndex
CREATE INDEX "RentalBundleComponent_bundleId_idx" ON "RentalBundleComponent"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBundleComponent_bundleId_rentalItemId_key" ON "RentalBundleComponent"("bundleId", "rentalItemId");

-- CreateIndex
CREATE INDEX "RentalItemUnit_companyId_idx" ON "RentalItemUnit"("companyId");

-- CreateIndex
CREATE INDEX "RentalItemUnit_rentalItemId_status_idx" ON "RentalItemUnit"("rentalItemId", "status");

-- CreateIndex
CREATE INDEX "RentalItemUnit_companyId_status_idx" ON "RentalItemUnit"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RentalItemUnit_companyId_unitCode_key" ON "RentalItemUnit"("companyId", "unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "RentalOrder_publicToken_key" ON "RentalOrder"("publicToken");

-- CreateIndex
CREATE INDEX "RentalOrder_companyId_idx" ON "RentalOrder"("companyId");

-- CreateIndex
CREATE INDEX "RentalOrder_companyId_status_idx" ON "RentalOrder"("companyId", "status");

-- CreateIndex
CREATE INDEX "RentalOrder_companyId_partnerId_idx" ON "RentalOrder"("companyId", "partnerId");

-- CreateIndex
CREATE INDEX "RentalOrder_dueDateTime_idx" ON "RentalOrder"("dueDateTime");

-- CreateIndex
CREATE INDEX "RentalOrder_orderSource_idx" ON "RentalOrder"("orderSource");

-- CreateIndex
CREATE INDEX "RentalOrder_companyId_rentalPaymentStatus_idx" ON "RentalOrder"("companyId", "rentalPaymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RentalOrder_companyId_orderNumber_key" ON "RentalOrder"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "RentalOrderExtension_rentalOrderId_idx" ON "RentalOrderExtension"("rentalOrderId");

-- CreateIndex
CREATE INDEX "RentalOrderExtension_companyId_idx" ON "RentalOrderExtension"("companyId");

-- CreateIndex
CREATE INDEX "RentalOrderItem_rentalOrderId_idx" ON "RentalOrderItem"("rentalOrderId");

-- CreateIndex
CREATE INDEX "RentalOrderItem_rentalItemId_idx" ON "RentalOrderItem"("rentalItemId");

-- CreateIndex
CREATE INDEX "RentalOrderItem_rentalBundleId_idx" ON "RentalOrderItem"("rentalBundleId");

-- CreateIndex
CREATE INDEX "RentalOrderUnitAssignment_rentalItemUnitId_idx" ON "RentalOrderUnitAssignment"("rentalItemUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalOrderUnitAssignment_rentalOrderId_rentalItemUnitId_key" ON "RentalOrderUnitAssignment"("rentalOrderId", "rentalItemUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalDeposit_rentalOrderId_key" ON "RentalDeposit"("rentalOrderId");

-- CreateIndex
CREATE INDEX "RentalDeposit_companyId_idx" ON "RentalDeposit"("companyId");

-- CreateIndex
CREATE INDEX "RentalDeposit_companyId_status_idx" ON "RentalDeposit"("companyId", "status");

-- CreateIndex
CREATE INDEX "RentalDepositAllocation_depositId_idx" ON "RentalDepositAllocation"("depositId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalDepositAllocation_depositId_unitId_key" ON "RentalDepositAllocation"("depositId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalReturn_rentalOrderId_key" ON "RentalReturn"("rentalOrderId");

-- CreateIndex
CREATE INDEX "RentalReturn_companyId_idx" ON "RentalReturn"("companyId");

-- CreateIndex
CREATE INDEX "RentalReturn_companyId_settlementStatus_idx" ON "RentalReturn"("companyId", "settlementStatus");

-- CreateIndex
CREATE INDEX "ItemConditionLog_rentalItemUnitId_recordedAt_idx" ON "ItemConditionLog"("rentalItemUnitId", "recordedAt");

-- CreateIndex
CREATE INDEX "ItemConditionLog_rentalOrderId_idx" ON "ItemConditionLog"("rentalOrderId");

-- CreateIndex
CREATE INDEX "CleaningLog_rentalItemUnitId_cleanedAt_idx" ON "CleaningLog"("rentalItemUnitId", "cleanedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRentalRisk_partnerId_key" ON "CustomerRentalRisk"("partnerId");

-- CreateIndex
CREATE INDEX "CustomerRentalRisk_companyId_idx" ON "CustomerRentalRisk"("companyId");

-- CreateIndex
CREATE INDEX "CustomerRentalRisk_companyId_riskLevel_idx" ON "CustomerRentalRisk"("companyId", "riskLevel");

-- CreateIndex
CREATE INDEX "RentalPolicy_companyId_idx" ON "RentalPolicy"("companyId");

-- CreateIndex
CREATE INDEX "RentalPolicy_companyId_effectiveFrom_idx" ON "RentalPolicy"("companyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "RentalPolicy_companyId_isActive_idx" ON "RentalPolicy"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "RentalDamagePolicy_companyId_idx" ON "RentalDamagePolicy"("companyId");

-- CreateIndex
CREATE INDEX "RentalDamagePolicy_companyId_isActive_idx" ON "RentalDamagePolicy"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RentalDamagePolicy_companyId_rentalItemId_severity_key" ON "RentalDamagePolicy"("companyId", "rentalItemId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "RentalDamagePolicy_companyId_category_severity_key" ON "RentalDamagePolicy"("companyId", "category", "severity");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dpBillId_fkey" FOREIGN KEY ("dpBillId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLayer" ADD CONSTRAINT "StockLayer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLayer" ADD CONSTRAINT "StockLayer_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SagaLog" ADD CONSTRAINT "SagaLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_destinationBankAccountId_fkey" FOREIGN KEY ("destinationBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_sourceBankAccountId_fkey" FOREIGN KEY ("sourceBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransactionItem" ADD CONSTRAINT "CashTransactionItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransactionItem" ADD CONSTRAINT "CashTransactionItem_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBundle" ADD CONSTRAINT "RentalBundle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBundleComponent" ADD CONSTRAINT "RentalBundleComponent_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "RentalBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBundleComponent" ADD CONSTRAINT "RentalBundleComponent_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItemUnit" ADD CONSTRAINT "RentalItemUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItemUnit" ADD CONSTRAINT "RentalItemUnit_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrder" ADD CONSTRAINT "RentalOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrder" ADD CONSTRAINT "RentalOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderExtension" ADD CONSTRAINT "RentalOrderExtension_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderExtension" ADD CONSTRAINT "RentalOrderExtension_rentalOrderId_fkey" FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderItem" ADD CONSTRAINT "RentalOrderItem_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderItem" ADD CONSTRAINT "RentalOrderItem_rentalBundleId_fkey" FOREIGN KEY ("rentalBundleId") REFERENCES "RentalBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderItem" ADD CONSTRAINT "RentalOrderItem_rentalOrderId_fkey" FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderUnitAssignment" ADD CONSTRAINT "RentalOrderUnitAssignment_rentalItemUnitId_fkey" FOREIGN KEY ("rentalItemUnitId") REFERENCES "RentalItemUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderUnitAssignment" ADD CONSTRAINT "RentalOrderUnitAssignment_rentalOrderId_fkey" FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDeposit" ADD CONSTRAINT "RentalDeposit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDeposit" ADD CONSTRAINT "RentalDeposit_rentalOrderId_fkey" FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDepositAllocation" ADD CONSTRAINT "RentalDepositAllocation_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "RentalDeposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDepositAllocation" ADD CONSTRAINT "RentalDepositAllocation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RentalItemUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturn" ADD CONSTRAINT "RentalReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturn" ADD CONSTRAINT "RentalReturn_rentalOrderId_fkey" FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemConditionLog" ADD CONSTRAINT "ItemConditionLog_rentalItemUnitId_fkey" FOREIGN KEY ("rentalItemUnitId") REFERENCES "RentalItemUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemConditionLog" ADD CONSTRAINT "ItemConditionLog_rentalOrderId_fkey" FOREIGN KEY ("rentalOrderId") REFERENCES "RentalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningLog" ADD CONSTRAINT "CleaningLog_rentalItemUnitId_fkey" FOREIGN KEY ("rentalItemUnitId") REFERENCES "RentalItemUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRentalRisk" ADD CONSTRAINT "CustomerRentalRisk_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRentalRisk" ADD CONSTRAINT "CustomerRentalRisk_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalPolicy" ADD CONSTRAINT "RentalPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDamagePolicy" ADD CONSTRAINT "RentalDamagePolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDamagePolicy" ADD CONSTRAINT "RentalDamagePolicy_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
