import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  userId: string;
  companyId: string;
  correlationId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}
