import { Router } from 'express';
import { ProcurementController } from '../modules/procurement/procurement.controller';

export const purchaseOrderRouter = Router();
const controller = new ProcurementController();

// GET /api/purchase-orders - List all POs
purchaseOrderRouter.get('/', controller.list);

// GET /api/purchase-orders/:id - Get PO by ID
purchaseOrderRouter.get('/:id', controller.getById);

// POST /api/purchase-orders - Create new PO
purchaseOrderRouter.post('/', controller.create);

// POST /api/purchase-orders/:id/confirm - Confirm PO
purchaseOrderRouter.post('/:id/confirm', controller.confirm);

// POST /api/purchase-orders/:id/cancel - Cancel PO
purchaseOrderRouter.post('/:id/cancel', controller.cancel);
