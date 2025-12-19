import { Router } from 'express';
import { PurchaseOrderController } from '../modules/procurement/purchase-order.controller';
import { requireActiveShape } from '../middlewares/shapeGuard';

export const purchaseOrderRouter = Router();
const controller = new PurchaseOrderController();

// GET /api/purchase-orders - List all POs
purchaseOrderRouter.get('/', controller.list);

// GET /api/purchase-orders/:id - Get PO by ID
purchaseOrderRouter.get('/:id', controller.getById);

// POST /api/purchase-orders - Create new PO
purchaseOrderRouter.post(
  '/',
  requireActiveShape(),
  controller.create
);

// POST /api/purchase-orders/:id/confirm - Confirm PO
purchaseOrderRouter.post(
  '/:id/confirm',
  requireActiveShape(),
  controller.confirm
);

// POST /api/purchase-orders/:id/cancel - Cancel PO
purchaseOrderRouter.post(
  '/:id/cancel',
  requireActiveShape(),
  controller.cancel
);
