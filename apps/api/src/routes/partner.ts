import { Router, Request, Response, NextFunction } from 'express';
import { PartnerService } from '../services/PartnerService';
import { PartnerType } from '@sync-erp/database';
import { z } from 'zod';

export const partnerRouter = Router();
const partnerService = new PartnerService();

const CreatePartnerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(['CUSTOMER', 'SUPPLIER']),
});

const UpdatePartnerSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// GET /api/partners - List all partners
partnerRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const typeParam = req.query.type as string | undefined;
    const type =
      typeParam === 'CUSTOMER'
        ? PartnerType.CUSTOMER
        : typeParam === 'SUPPLIER'
          ? PartnerType.SUPPLIER
          : undefined;

    const partners = await partnerService.list(companyId, type);
    res.json({ success: true, data: partners });
  } catch (error) {
    next(error);
  }
});

// GET /api/partners/suppliers - List suppliers only
partnerRouter.get('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const suppliers = await partnerService.listSuppliers(companyId);
    res.json({ success: true, data: suppliers });
  } catch (error) {
    next(error);
  }
});

// GET /api/partners/customers - List customers only
partnerRouter.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const customers = await partnerService.listCustomers(companyId);
    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
});

// GET /api/partners/:id - Get partner by ID
partnerRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const partner = await partnerService.getById(req.params.id, companyId);

    if (!partner) {
      return res.status(404).json({ success: false, error: { message: 'Partner not found' } });
    }

    res.json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

// POST /api/partners - Create new partner
partnerRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = CreatePartnerSchema.parse(req.body);

    const partner = await partnerService.create(companyId, {
      name: validated.name,
      email: validated.email,
      phone: validated.phone,
      address: validated.address,
      type: validated.type === 'CUSTOMER' ? PartnerType.CUSTOMER : PartnerType.SUPPLIER,
    });
    res.status(201).json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

// PUT /api/partners/:id - Update partner
partnerRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = UpdatePartnerSchema.parse(req.body);

    const partner = await partnerService.update(req.params.id, companyId, validated);
    res.json({ success: true, data: partner });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/partners/:id - Delete partner
partnerRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    await partnerService.delete(req.params.id, companyId);
    res.json({ success: true, message: 'Partner deleted' });
  } catch (error) {
    next(error);
  }
});
