import { Router, type Request, type Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import {
  IdempotencyScope,
  Prisma,
} from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import {
  apiKeyService,
  type ApiKeyValidationResult,
} from '../services/api-key.service';
import { IdempotencyService } from '../modules/common/services/idempotency.service';
import { RentalExternalOrderService } from '../modules/rental/rental-external-order.service';
import {
  RentalIntegrationCancelOrderSchema,
  RentalIntegrationClaimPaymentSchema,
  RentalIntegrationConfirmPaymentSchema,
  RentalIntegrationCreateOrderSchema,
  RentalIntegrationCustomerSchema,
  RentalIntegrationRejectPaymentSchema,
  RentalIntegrationUpdateOrderSchema,
} from '../modules/rental/rental-integration.schemas';
import {
  toIntegrationCustomerDto,
  toIntegrationOrderDto,
  toIntegrationOrderSummaryDto,
} from '../modules/rental/rental-integration.dto';

type AuthedRequest = Request & {
  integrationAuth?: ApiKeyValidationResult;
};

const idSchema = RentalIntegrationUpdateOrderSchema.shape.id.unwrap();
const tokenSchema = RentalIntegrationClaimPaymentSchema.shape.token;
const service = new RentalExternalOrderService();
const idempotencyService = new IdempotencyService();

export const integrationV1HttpRouter = Router();

const sendError = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues,
      },
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  console.error('[IntegrationV1] Unhandled error:', error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
};

const parseBody = <T>(schema: ZodType<T>, body: unknown): T => {
  return schema.parse(body);
};

const parseParam = <T>(schema: ZodType<T>, value: unknown): T => {
  return schema.parse(value);
};

const requireAuth = (req: AuthedRequest) => {
  if (!req.integrationAuth) {
    throw new DomainError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  return req.integrationAuth;
};

const requirePermission = (
  auth: ApiKeyValidationResult,
  permission: string
) => {
  if (!auth.permissions.includes(permission)) {
    throw new DomainError(
      `Missing required permission: ${permission}`,
      403,
      'FORBIDDEN'
    );
  }
};

const toJsonObject = (value: unknown): Prisma.InputJsonObject => {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
};

const withIdempotency = async <T>(
  req: Request,
  auth: ApiKeyValidationResult,
  scope: IdempotencyScope,
  operation: () => Promise<T>
): Promise<T> => {
  const rawKey = req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

  if (!idempotencyKey) {
    return operation();
  }

  const cached = await idempotencyService.acquireLock(
    idempotencyKey,
    auth.companyId,
    scope,
    `${req.method}:${req.originalUrl}`
  );

  if (cached !== null) {
    return cached as T;
  }

  try {
    const result = await operation();
    await idempotencyService.complete(
      idempotencyKey,
      toJsonObject(result)
    );
    return result;
  } catch (error) {
    await idempotencyService.fail(idempotencyKey, error);
    throw error;
  }
};

integrationV1HttpRouter.use(async (req: AuthedRequest, res, next) => {
  if (
    req.method === 'GET' &&
    req.path.startsWith('/rental/orders/by-token/')
  ) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message:
          'Missing or invalid Authorization header. Expected: Bearer <api_key>',
      },
    });
    return;
  }

  const rawKey = authHeader.replace('Bearer ', '');
  const result = await apiKeyService.validateKey(rawKey);

  if (!result) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired API key',
      },
    });
    return;
  }

  req.integrationAuth = result;
  next();
});

integrationV1HttpRouter.post(
  '/rental/customers',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const input = parseBody(
        RentalIntegrationCustomerSchema,
        req.body
      );
      const customer = await service.findOrCreateCustomer(
        auth.companyId,
        input
      );

      res.status(201).json(toIntegrationCustomerDto(customer));
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.post(
  '/rental/orders',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const input = parseBody(
        RentalIntegrationCreateOrderSchema,
        req.body
      );
      const order = await withIdempotency(
        req,
        auth,
        IdempotencyScope.ORDER_CREATE,
        () =>
          service.createOrder({
            ...input,
            companyId: auth.companyId,
            createdByApiKeyId: auth.keyId,
          })
      );

      res.status(201).json(toIntegrationOrderSummaryDto(order));
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.get(
  '/rental/orders/by-token/:publicToken',
  async (req, res) => {
    try {
      const token = parseParam(tokenSchema, req.params.publicToken);
      const order = await service.getByToken(token);
      res.json(toIntegrationOrderDto(order));
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.get(
  '/rental/orders/by-number/:orderNumber',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:read');
      const order = await service.getByOrderNumber(
        auth.companyId,
        req.params.orderNumber
      );
      res.json(toIntegrationOrderDto(order));
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.get(
  '/rental/orders/:id',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:read');
      const id = parseParam(idSchema, req.params.id);
      const order = await service.getById(auth.companyId, id);
      res.json(toIntegrationOrderDto(order));
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.patch(
  '/rental/orders/:id',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const id = parseParam(idSchema, req.params.id);
      const input = parseBody(
        RentalIntegrationUpdateOrderSchema.omit({ id: true, token: true }),
        req.body
      );
      const current = await service.getById(auth.companyId, id);
      const updated = await service.updateOrder(
        {
          ...input,
          token: current.publicToken || current.id,
        },
        auth.companyId
      );

      res.json(toIntegrationOrderSummaryDto(updated));
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.post(
  '/rental/orders/:id/cancel',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const id = parseParam(idSchema, req.params.id);
      const input = parseBody(
        RentalIntegrationCancelOrderSchema,
        req.body
      );
      const cancelled = await service.cancelOrder({
        id,
        companyId: auth.companyId,
        reason: input.reason,
      });

      res.json(toIntegrationOrderSummaryDto(cancelled));
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.post(
  '/rental/orders/by-number/:orderNumber/payments/confirm',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const input = parseBody(
        RentalIntegrationConfirmPaymentSchema.omit({ orderNumber: true }),
        req.body
      );
      const result = await service.confirmPaymentByOrderNumber(
        auth.companyId,
        {
          ...input,
          orderNumber: req.params.orderNumber,
        }
      );

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.post(
  '/rental/orders/by-number/:orderNumber/payments/reject',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const input = parseBody(
        RentalIntegrationRejectPaymentSchema.omit({ orderNumber: true }),
        req.body
      );
      const result = await service.rejectPaymentByOrderNumber(
        auth.companyId,
        {
          ...input,
          orderNumber: req.params.orderNumber,
        }
      );

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.post(
  '/rental/orders/:id/payments/claim',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const id = parseParam(idSchema, req.params.id);
      const input = parseBody(
        RentalIntegrationClaimPaymentSchema.omit({ token: true }),
        req.body
      );
      const current = await service.getById(auth.companyId, id);
      const result = await withIdempotency(
        req,
        auth,
        IdempotencyScope.PAYMENT_CREATE,
        () =>
          service.claimPayment(auth.companyId, {
            ...input,
            token: current.publicToken || current.id,
          })
      );

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.post(
  '/rental/orders/:id/payments/confirm',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const id = parseParam(idSchema, req.params.id);
      const input = parseBody(
        RentalIntegrationConfirmPaymentSchema.omit({ orderNumber: true }),
        req.body
      );
      const current = await service.getById(auth.companyId, id);
      const result = await service.confirmPaymentByOrderNumber(
        auth.companyId,
        {
          ...input,
          orderNumber: current.orderNumber,
        }
      );

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

integrationV1HttpRouter.post(
  '/rental/orders/:id/payments/reject',
  async (req: AuthedRequest, res) => {
    try {
      const auth = requireAuth(req);
      requirePermission(auth, 'rental:write');
      const id = parseParam(idSchema, req.params.id);
      const input = parseBody(
        RentalIntegrationRejectPaymentSchema.omit({ orderNumber: true }),
        req.body
      );
      const current = await service.getById(auth.companyId, id);
      const result = await service.rejectPaymentByOrderNumber(
        auth.companyId,
        {
          ...input,
          orderNumber: current.orderNumber,
        }
      );

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);
