import { Router, Request, Response, NextFunction } from 'express';
import { SalesOrderService } from '../services/SalesOrderService';
import { FulfillmentService } from '../services/FulfillmentService';
import { z } from 'zod';

export const salesOrderRouter = Router();
const soService = new SalesOrderService();
const fulfillmentService = new FulfillmentService();

const CreateSOItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

const CreateSOSchema = z.object({
  partnerId: z.string().uuid(),
  items: z.array(CreateSOItemSchema).min(1),
});

// GET /api/sales-orders - List all SOs
salesOrderRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const status = req.query.status as string | undefined;

    const orders = await soService.list(companyId, status);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// GET /api/sales-orders/:id - Get SO by ID
salesOrderRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const order = await soService.getById(req.params.id, companyId);

    if (!order) {
      return res.status(404).json({ success: false, error: { message: 'Sales order not found' } });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales-orders - Create new SO
salesOrderRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const userId = req.context.userId!;
    const validated = CreateSOSchema.parse(req.body);

    const order = await soService.create(companyId, userId, validated);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales-orders/:id/confirm - Confirm SO (checks stock)
salesOrderRouter.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const order = await soService.confirm(req.params.id, companyId);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales-orders/:id/ship - Ship/Deliver SO
salesOrderRouter.post('/:id/ship', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const reference = req.body.reference as string | undefined;

    const movements = await fulfillmentService.processShipment(companyId, {
      orderId: req.params.id,
      reference,
    });
    res.json({ success: true, data: movements });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales-orders/:id/cancel - Cancel SO
salesOrderRouter.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const order = await soService.cancel(req.params.id, companyId);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});
