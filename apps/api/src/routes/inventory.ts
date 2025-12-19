import { Router } from 'express';
import { InventoryController } from '../modules/inventory/inventory.controller';
import { requireActiveShape } from '../middlewares/shapeGuard';

export const inventoryRouter = Router();
const controller = new InventoryController();

// GET /api/inventory/stock - Get all stock levels
inventoryRouter.get('/stock', controller.getStockLevels);

// GET /api/inventory/movements - Get inventory movements
inventoryRouter.get('/movements', controller.getMovements);

// POST /api/inventory/adjust - Manual stock adjustment
inventoryRouter.post(
  '/adjust',
  requireActiveShape(),
  controller.adjustStock
);

// ==========================================
// GRN Routes (034-grn-fullstack)
// ==========================================

inventoryRouter.get('/receipts', controller.listReceipts);
inventoryRouter.get('/receipts/:id', controller.getReceipt);
inventoryRouter.post(
  '/receipts',
  requireActiveShape(),
  controller.createReceipt
);
inventoryRouter.post(
  '/receipts/:id/post',
  requireActiveShape(),
  controller.postReceipt
);

// ==========================================
// Shipment Routes (034-grn-fullstack)
// ==========================================

inventoryRouter.get('/shipments', controller.listShipments);
inventoryRouter.get('/shipments/:id', controller.getShipment);
inventoryRouter.post(
  '/shipments',
  requireActiveShape(),
  controller.createShipment
);
inventoryRouter.post(
  '/shipments/:id/post',
  requireActiveShape(),
  controller.postShipment
);
