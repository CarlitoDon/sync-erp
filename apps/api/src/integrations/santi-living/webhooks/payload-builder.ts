export function buildWebhookPayload(
  event: string,
  payload: unknown,
  _config: Record<string, unknown>
) {
  if (event === 'order.created') {
    const input = payload as {
      orderNumber: string;
      customerName: string;
      customerPhone: string;
      totalAmount: number;
      token: string;
    };

    return {
      action: 'new_order',
      orderNumber: input.orderNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      totalAmount: input.totalAmount,
    };
  }

  if (event === 'payment.status.changed') {
    const input = payload as {
      action: string;
      paymentReference?: string;
      failReason?: string;
      paymentMethod?: string;
      token: string;
    };

    return {
      action: input.action,
      paymentReference: input.paymentReference,
      failReason: input.failReason,
      paymentMethod: input.paymentMethod,
    };
  }

  return payload;
}

export function getWebhookPath(
  event: string,
  token: string,
  pathsConfig?: Record<string, unknown>
): string {
  if (event === 'order.created') {
    const pathTemplate =
      typeof pathsConfig?.newOrder === 'string'
        ? pathsConfig.newOrder
        : '/api/orders/{token}/notify-admin';
    return pathTemplate.replace('{token}', token);
  }

  if (event === 'payment.status.changed') {
    const pathTemplate =
      typeof pathsConfig?.paymentStatus === 'string'
        ? pathsConfig.paymentStatus
        : '/api/orders/{token}/notify-payment';
    return pathTemplate.replace('{token}', token);
  }

  return '/api/webhook';
}
