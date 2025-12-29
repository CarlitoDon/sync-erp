/* eslint-disable @sync-erp/no-hardcoded-enum -- This file DEFINES the known enum values for the rule */
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';

/**
 * Known Prisma enum values that should be imported from @sync-erp/database or @sync-erp/shared.
 * This is a positive-match list to reduce false positives.
 *
 * NOTE: We cannot dynamically import from @sync-erp/database due to circular dependency
 * (eslint-plugin runs during lint of database package itself).
 *
 * When adding new Prisma enums, update this list manually.
 * @see packages/database/prisma/schema.prisma for the source of truth
 */
const KNOWN_PRISMA_ENUMS = new Set([
  // AccountType
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  // JournalSourceType
  'INVOICE',
  'BILL',
  'PAYMENT',
  'CREDIT_NOTE',
  'ADJUSTMENT',
  // PartnerType
  'CUSTOMER',
  'SUPPLIER',
  // OrderType
  'SALES',
  'PURCHASE',
  // OrderStatus
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
  // MovementType
  'IN',
  'OUT',
  // InvoiceType (INVOICE, BILL already included)
  'EXPENSE',
  'DEBIT_NOTE',
  // InvoiceStatus (DRAFT already included)
  'POSTED',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
  'ISSUED',
  // PaymentMethod
  'CASH',
  'BANK_TRANSFER',
  'CREDIT_CARD',
  'CHECK',
  'OTHER',
  // BusinessShape
  'PENDING',
  'RETAIL',
  'MANUFACTURING',
  'SERVICE',
  // CostingMethod
  'AVG',
  'FIFO',
  // PaymentTerms
  'NET7',
  'NET30',
  'NET60',
  'NET90',
  'COD',
  'EOM',
  'NET_30',
  'UPFRONT',
  // PaymentStatus (PENDING, PARTIAL already have meanings elsewhere)
  'PARTIAL',
  'PAID_UPFRONT',
  'SETTLED',
  // DocumentStatus (DRAFT, POSTED already included)
  'VOIDED',
  // FulfillmentType
  'GRN',
  'SHIPMENT',
  // SequenceType
  'PO',
  'SO',
  'INV',
  'BIL',
  'PAY',
  'JE',
  'SHP',
  // IdempotencyStatus
  'PROCESSING',
  'FAILED',
]);

/**
 * Strings that look like enums but should be ignored (false positive patterns).
 * These are framework error codes, route strings, or UI-local types.
 */
const IGNORED_PATTERNS = new Set([
  // Prisma error codes
  'P2002',
  'P2003',
  'P2025',
  'P1001',
  'P1002',
  'P2021',
  'P2022',
  // tRPC error codes
  'CONFLICT',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INTERNAL_SERVER_ERROR',
  'PARSE_ERROR',
  'TIMEOUT',
  // HTTP methods
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  // Common UI/framework types that look like enums
  'BS',
  'IS', // Report types
]);

/**
 * Strings that should be ignored because they're clearly NOT enums
 * (lowercase or mixed case route/label strings)
 */
const IGNORED_LOWERCASE_PATTERNS = new Set([
  'purchase',
  'sales',
  'suppliers',
  'customers',
  'purchase-orders',
  'sales-orders',
  'invoices',
  'bills',
  'overview',
  'reports',
  'journals',
  'history',
  'inbound',
  'outbound',
  'all',
  'left',
  'center',
  'right', // align values
  'asc',
  'desc', // sort order
]);

export const noHardcodedEnum = ESLintUtils.RuleCreator(
  (name) => `https://internal/${name}`
)({
  name: 'no-hardcoded-enum',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded Prisma enum values. Import from @sync-erp/database or @sync-erp/shared instead.',
    },
    messages: {
      hardcodedEnum:
        'Hardcoded enum detected: "{{value}}". Import from @sync-erp/database or use schema from @sync-erp/shared.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    // Get string value from literal node
    function getStringValue(node: TSESTree.Node): string | null {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
      }
      return null;
    }

    // Check if a string value is a known Prisma enum that should be imported
    function isKnownPrismaEnum(value: string): boolean {
      // Skip ignored patterns (error codes, UI types)
      if (IGNORED_PATTERNS.has(value)) {
        return false;
      }

      // Skip lowercase patterns (routes, labels)
      if (IGNORED_LOWERCASE_PATTERNS.has(value.toLowerCase())) {
        return false;
      }

      // Only flag if it's a known Prisma enum value
      return KNOWN_PRISMA_ENUMS.has(value);
    }

    // Check if node is inside a type definition that's clearly a local type
    function isInLocalTypeContext(node: TSESTree.Node): boolean {
      let parent = node.parent;
      while (parent) {
        // Skip if inside a type alias that doesn't reference Prisma types
        if (parent.type === 'TSTypeAliasDeclaration') {
          const name = (parent as TSESTree.TSTypeAliasDeclaration).id
            .name;
          // Common local type patterns
          if (
            /^(Filter|Tab|View|Mode|Direction|Align)/.test(name) ||
            name.endsWith('Type') ||
            name.endsWith('Filter')
          ) {
            return true;
          }
        }
        // Skip if inside interface property that's clearly local
        if (parent.type === 'TSPropertySignature') {
          const propParent = parent.parent;
          if (propParent?.type === 'TSInterfaceBody') {
            const interfaceNode = propParent.parent as
              | TSESTree.TSInterfaceDeclaration
              | undefined;
            if (interfaceNode?.id?.name) {
              // Props interfaces are usually local
              if (interfaceNode.id.name.endsWith('Props')) {
                return true;
              }
            }
          }
        }
        parent = parent.parent as TSESTree.Node | undefined;
      }
      return false;
    }

    return {
      // x === 'ENUM_VALUE' or x !== 'ENUM_VALUE'
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==') {
          return;
        }

        // Check if either side is a known Prisma enum
        const leftValue = getStringValue(node.left);
        const rightValue = getStringValue(node.right);

        if (leftValue && isKnownPrismaEnum(leftValue)) {
          context.report({
            node: node.left,
            messageId: 'hardcodedEnum',
            data: { value: leftValue },
          });
        }

        if (rightValue && isKnownPrismaEnum(rightValue)) {
          context.report({
            node: node.right,
            messageId: 'hardcodedEnum',
            data: { value: rightValue },
          });
        }
      },

      // ['CONFIRMED', 'PARTIALLY_RECEIVED', ...] - only flag if contains known enums
      ArrayExpression(node) {
        if (node.elements.length <= 1) {
          return;
        }

        // Count how many elements are known Prisma enums
        let knownEnumCount = 0;
        const knownEnums: string[] = [];

        for (const el of node.elements) {
          if (!el) continue;
          const value = getStringValue(el);
          if (value && isKnownPrismaEnum(value)) {
            knownEnumCount++;
            knownEnums.push(value);
          }
        }

        // Only flag if majority are known enums (reduces false positives for misc arrays)
        if (
          knownEnumCount > 0 &&
          knownEnumCount >= node.elements.length / 2
        ) {
          context.report({
            node,
            messageId: 'hardcodedEnum',
            data: { value: knownEnums.join(', ') },
          });
        }
      },

      // condition ? 'ENUM_A' : 'ENUM_B'
      ConditionalExpression(node) {
        const consequentValue = getStringValue(node.consequent);
        const alternateValue = getStringValue(node.alternate);

        // Flag if BOTH branches are known Prisma enums
        if (
          consequentValue &&
          isKnownPrismaEnum(consequentValue) &&
          alternateValue &&
          isKnownPrismaEnum(alternateValue)
        ) {
          context.report({
            node,
            messageId: 'hardcodedEnum',
            data: { value: `${consequentValue}, ${alternateValue}` },
          });
        }
      },

      // type X = 'A' | 'B' - only flag if contains known enums
      TSUnionType(node) {
        if (node.types.length <= 1) {
          return;
        }

        // Skip if in local type context
        if (isInLocalTypeContext(node)) {
          return;
        }

        // Check if union contains known Prisma enums
        const knownEnums: string[] = [];
        for (const t of node.types) {
          if (
            t.type === 'TSLiteralType' &&
            t.literal.type === 'Literal' &&
            typeof t.literal.value === 'string'
          ) {
            if (isKnownPrismaEnum(t.literal.value)) {
              knownEnums.push(t.literal.value);
            }
          }
        }

        // Only flag if at least one known enum is found
        if (knownEnums.length > 0) {
          context.report({
            node,
            messageId: 'hardcodedEnum',
            data: { value: knownEnums.join(', ') },
          });
        }
      },
    };
  },
});
