import { z } from 'zod';

// ============================================
// BusinessShape Zod Schema (Apple-Like Core)
// ============================================

/**
 * Zod enum for BusinessShape validation.
 * Must be kept in sync with BusinessShape enum in types/company.ts
 */
export const BusinessShapeSchema = z.enum([
  'PENDING',
  'RETAIL',
  'MANUFACTURING',
  'SERVICE',
]);

export type BusinessShapeInput = z.infer<typeof BusinessShapeSchema>;

/**
 * Zod enum for CostingMethod validation.
 */
export const CostingMethodSchema = z.enum(['AVG', 'FIFO']);

export type CostingMethodInput = z.infer<typeof CostingMethodSchema>;

/**
 * Schema for POST /company/select-shape
 * Note: PENDING is not allowed as a selection value (only RETAIL, MANUFACTURING, SERVICE)
 */
export const SelectShapeSchema = z.object({
  shape: z.enum(['RETAIL', 'MANUFACTURING', 'SERVICE'], {
    errorMap: () => ({
      message: 'Shape must be one of: RETAIL, MANUFACTURING, SERVICE',
    }),
  }),
});

export type SelectShapeInput = z.infer<typeof SelectShapeSchema>;

// ============================================
// Company Schemas
// ============================================

export const CreateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(100),
});

export const JoinCompanySchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type JoinCompanyInput = z.infer<typeof JoinCompanySchema>;

export const InviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name is required'),
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;
