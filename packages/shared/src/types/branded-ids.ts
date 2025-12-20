/**
 * Branded Types for Type-Safe IDs
 *
 * These types prevent mixing up different ID types at compile time.
 * A CorrelationId cannot be accidentally passed as a UserId, etc.
 *
 * @example
 * ```typescript
 * const userId: UserId = 'abc'; // ❌ Error
 * const userId: UserId = createUserId(); // ✅
 * const corrId: CorrelationId = createCorrelationId(); // ✅
 * ```
 */

// Brand symbol for type uniqueness
declare const __brand: unique symbol;

/**
 * Branded type helper - makes a string type that can't be mixed with others
 */
type Brand<T, B> = T & { readonly [__brand]: B };

// ============================================
// Branded ID Types
// ============================================

/**
 * Correlation ID - used for request tracing and idempotency
 */
export type CorrelationId = Brand<string, 'CorrelationId'>;

/**
 * User ID - identifies a user
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * Company ID - identifies a company/tenant
 */
export type CompanyId = Brand<string, 'CompanyId'>;

/**
 * Entity ID - generic entity identifier
 */
export type EntityId = Brand<string, 'EntityId'>;

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new CorrelationId (uses crypto.randomUUID)
 * Use this for idempotency keys and request tracing
 */
export function createCorrelationId(): CorrelationId {
  return crypto.randomUUID() as CorrelationId;
}

/**
 * Cast an existing UUID string to CorrelationId
 * Use when you already have a valid UUID (e.g., from API response)
 */
export function asCorrelationId(id: string): CorrelationId {
  return id as CorrelationId;
}

/**
 * Cast a string to UserId (use when receiving from auth context)
 */
export function asUserId(id: string): UserId {
  return id as UserId;
}

/**
 * Cast a string to CompanyId (use when receiving from company context)
 */
export function asCompanyId(id: string): CompanyId {
  return id as CompanyId;
}

/**
 * Cast a string to EntityId
 */
export function asEntityId(id: string): EntityId {
  return id as EntityId;
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if a value is a valid UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}
