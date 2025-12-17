import { Router } from 'express';
import { SalesController } from '../modules/sales/sales.controller';
import { requireActiveShape } from '../middlewares/shapeGuard';

export const salesOrderRouter = Router();
const controller = new SalesController();

// GET /api/sales-orders - List all SOs
salesOrderRouter.get('/', controller.list);

// GET /api/sales-orders/:id - Get SO by ID
salesOrderRouter.get('/:id', controller.getById);

// POST /api/sales-orders - Create new SO
salesOrderRouter.post('/', requireActiveShape(), controller.create);

// POST /api/sales-orders/:id/confirm - Confirm SO (checks stock)
salesOrderRouter.post(
  '/:id/confirm',
  requireActiveShape(),
  controller.confirm
);

// POST /api/sales-orders/:id/ship - Ship/Deliver SO (formerly in FulfillmentService)
salesOrderRouter.post(
  '/:id/ship',
  requireActiveShape(),
  controller.ship
);

// POST /api/sales-orders/:id/cancel - Cancel SO
salesOrderRouter.post(
  '/:id/cancel',
  requireActiveShape(),
  controller.cancel
);
