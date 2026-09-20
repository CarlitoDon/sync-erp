import { z } from 'zod';

export const OrderCreatedWebhookPayloadSchema = z.object({
  orderNumber: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  totalAmount: z.number().nonnegative(),
  token: z.string().min(1),
});

export type OrderCreatedWebhookPayload = z.infer<
  typeof OrderCreatedWebhookPayloadSchema
>;

export const OrderCreatedWebhookOutputSchema = z.object({
  action: z.literal('new_order'),
  orderNumber: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  totalAmount: z.number(),
});

export type OrderCreatedWebhookOutput = z.infer<
  typeof OrderCreatedWebhookOutputSchema
>;

export const PaymentStatusChangedWebhookPayloadSchema = z.object({
  action: z.string().min(1),
  paymentReference: z.string().optional(),
  failReason: z.string().optional(),
  paymentMethod: z.string().optional(),
  token: z.string().min(1),
});

export type PaymentStatusChangedWebhookPayload = z.infer<
  typeof PaymentStatusChangedWebhookPayloadSchema
>;

export const PaymentStatusChangedWebhookOutputSchema = z.object({
  action: z.string(),
  paymentReference: z.string().optional(),
  failReason: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export type PaymentStatusChangedWebhookOutput = z.infer<
  typeof PaymentStatusChangedWebhookOutputSchema
>;

export const WebhookPathsConfigSchema = z
  .object({
    newOrder: z.string().optional(),
    paymentStatus: z.string().optional(),
  })
  .passthrough();

export type WebhookPathsConfig = z.infer<typeof WebhookPathsConfigSchema>;

export function buildWebhookPayload(
  event: string,
  payload: unknown,
  _config: Record<string, unknown>
): unknown {
  if (event === 'order.created') {
    const parsed = OrderCreatedWebhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn(
        '[santi-living:buildWebhookPayload] Invalid order.created payload schema:',
        parsed.error.format()
      );
      return payload;
    }

    const input = parsed.data;
    const result: OrderCreatedWebhookOutput = {
      action: 'new_order',
      orderNumber: input.orderNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      totalAmount: input.totalAmount,
    };
    return result;
  }

  if (event === 'payment.status.changed') {
    const parsed = PaymentStatusChangedWebhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn(
        '[santi-living:buildWebhookPayload] Invalid payment.status.changed payload schema:',
        parsed.error.format()
      );
      return payload;
    }

    const input = parsed.data;
    const result: PaymentStatusChangedWebhookOutput = {
      action: input.action,
      paymentReference: input.paymentReference,
      failReason: input.failReason,
      paymentMethod: input.paymentMethod,
    };
    return result;
  }

  return payload;
}

export function getWebhookPath(
  event: string,
  token: string,
  pathsConfig?: unknown
): string {
  const parsedPaths = WebhookPathsConfigSchema.safeParse(pathsConfig);
  const paths = parsedPaths.success ? parsedPaths.data : undefined;

  if (event === 'order.created') {
    const pathTemplate =
      typeof paths?.newOrder === 'string'
        ? paths.newOrder
        : '/api/orders/{token}/notify-admin';
    return pathTemplate.replace('{token}', token);
  }

  if (event === 'payment.status.changed') {
    const pathTemplate =
      typeof paths?.paymentStatus === 'string'
        ? paths.paymentStatus
        : '/api/orders/{token}/notify-payment';
    return pathTemplate.replace('{token}', token);
  }

  return '/api/webhook';
}
