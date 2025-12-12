import { Router } from 'express';
import { SalesController } from '../modules/sales/sales.controller';

export const salesOrderRouter = Router();
const controller = new SalesController();

// GET /api/sales-orders - List all SOs
salesOrderRouter.get('/', controller.list);

// GET /api/sales-orders/:id - Get SO by ID
salesOrderRouter.get('/:id', controller.getById);

// POST /api/sales-orders - Create new SO
salesOrderRouter.post('/', controller.create);

// POST /api/sales-orders/:id/confirm - Confirm SO (checks stock)
salesOrderRouter.post('/:id/confirm', controller.confirm);

// POST /api/sales-orders/:id/ship - Ship/Deliver SO (formerly in FulfillmentService)
salesOrderRouter.post('/:id/ship', controller.ship);

// POST /api/sales-orders/:id/cancel - Cancel SO
salesOrderRouter.post('/:id/cancel', controller.cancel);
