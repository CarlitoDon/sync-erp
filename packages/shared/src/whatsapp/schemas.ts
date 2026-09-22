import { z } from 'zod';

/**
 * Payload schema for the POST /send-message endpoint on apps/bot.
 * Used by apps/mcp when calling whatsapp_send_message tool.
 */
export const SendMessagePayloadSchema = z.object({
  phone: z.string(),
  message: z.string(),
  source: z.string().optional(),
});
export type SendMessagePayload = z.infer<typeof SendMessagePayloadSchema>;

/**
 * Schema for escalate_to_owner MCP tool arguments.
 */
export const EscalateArgsSchema = z.object({
  customerPhone: z.string().min(1),
  customerName: z.string().min(1),
  productInterest: z.string().min(1).optional(),
  escalationReason: z.string().min(1).optional(),
  leadSummary: z.string().min(1).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  
  // Compatibility with user prompt properties
  issue: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high']).default('medium').optional(),
  context: z.string().optional(),
});
export type EscalateArgs = z.infer<typeof EscalateArgsSchema>;
