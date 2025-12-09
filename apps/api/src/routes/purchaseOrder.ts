import { Router, Request, Response, NextFunction } from 'express';
import { PurchaseOrderService } from '../services/PurchaseOrderService';
import { z } from 'zod';

export const purchaseOrderRouter = Router();
const poService = new PurchaseOrderService();

const CreatePOItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

const CreatePOSchema = z.object({
  partnerId: z.string().uuid(),
  items: z.array(CreatePOItemSchema).min(1),
});

// GET /api/purchase-orders - List all POs
purchaseOrderRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const status = req.query.status as string | undefined;

    const orders = await poService.list(companyId, status);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// GET /api/purchase-orders/:id - Get PO by ID
purchaseOrderRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const order = await poService.getById(req.params.id, companyId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Purchase order not found' } });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// POST /api/purchase-orders - Create new PO
purchaseOrderRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const userId = req.context.userId!;
    const validated = CreatePOSchema.parse(req.body);

    const order = await poService.create(companyId, userId, validated);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// POST /api/purchase-orders/:id/confirm - Confirm PO
purchaseOrderRouter.post(
  '/:id/confirm',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const order = await poService.confirm(req.params.id, companyId);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/purchase-orders/:id/cancel - Cancel PO
purchaseOrderRouter.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const order = await poService.cancel(req.params.id, companyId);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});
