/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IntegrationManifest {
  appId: string;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  defaultConfig: Record<string, unknown>;
}

export interface IntegrationOrderAdapter {
  skuPrefix?: string;
  createdBy?: string;
  parseComponents?(
    raw: string[]
  ): { quantity: number; label: string }[];
  createOrder?(
    orderService: any, // will be typed as PublicOrderService later
    input: any,
    context: any
  ): Promise<any>;
}

export interface IntegrationPlugin {
  manifest: IntegrationManifest;
  buildWebhookPayload?(
    event: string,
    payload: unknown,
    config: Record<string, unknown>
  ): unknown;
  getOrderAdapter?(): IntegrationOrderAdapter;
  registerRoutes?(router: any): void; // Can be used to inject additional tRPC routers
}
