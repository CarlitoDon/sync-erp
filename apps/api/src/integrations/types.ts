import { z } from 'zod';

export interface IntegrationManifest {
  appId: string;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  defaultConfig: Record<string, unknown>;
}

export interface IntegrationComponentItem {
  quantity: number;
  label: string;
}

export const IntegrationOrderItemSchema = z
  .object({
    rentalItemId: z.string().optional(),
    rentalBundleId: z.string().optional(),
    name: z.string().optional(),
    productName: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    pricePerDay: z.number().nonnegative().optional(),
    lineTotal: z.number().nonnegative().optional(),
    category: z.enum(['package', 'mattress', 'accessory']).optional(),
    components: z
      .union([
        z.array(z.string()),
        z.array(
          z.object({
            quantity: z.number().int().positive(),
            label: z.string(),
          })
        ),
      ])
      .optional(),
  })
  .passthrough();

export type IntegrationOrderItemInput = z.infer<
  typeof IntegrationOrderItemSchema
>;

export const IntegrationOrderInputSchema = z
  .object({
    items: z.array(IntegrationOrderItemSchema),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().optional(),
    rentalStartDate: z.union([z.date(), z.string()]).optional(),
    rentalEndDate: z.union([z.date(), z.string()]).optional(),
    deliveryFee: z.number().nonnegative().optional(),
    notes: z.string().optional(),
    companyId: z.string().optional(),
    partnerId: z.string().optional(),
    createdBy: z.string().optional(),
    skuPrefix: z.string().optional(),
  })
  .passthrough();

export type IntegrationOrderInput = z.infer<typeof IntegrationOrderInputSchema>;

export interface IntegrationOrderContext {
  companyId: string;
  user?: unknown;
}

export interface OrderServicePort {
  createOrder(
    input: unknown,
    context?: IntegrationOrderContext
  ): Promise<unknown>;
}

export interface IntegrationOrderAdapter {
  skuPrefix?: string;
  createdBy?: string;
  parseComponents?(raw: string[]): IntegrationComponentItem[];
  createOrder?(
    orderService: OrderServicePort,
    input: IntegrationOrderInput,
    context?: IntegrationOrderContext
  ): Promise<unknown>;
}

export interface IntegrationPlugin {
  manifest: IntegrationManifest;
  buildWebhookPayload?(
    event: string,
    payload: unknown,
    config: Record<string, unknown>
  ): unknown;
  getWebhookPath?(
    event: string,
    orderPublicToken: string,
    config: Record<string, unknown>
  ): string;
  getOrderAdapter?(): IntegrationOrderAdapter;
  registerRoutes?(routerBuilder: unknown): void;
}
