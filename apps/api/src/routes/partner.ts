import { Router } from 'express';
import { PartnerController } from '../modules/partner/partner.controller';

export const partnerRouter = Router();
const controller = new PartnerController();

// GET /api/partners - List all partners
partnerRouter.get('/', controller.list);

// GET /api/partners/suppliers - List suppliers only
partnerRouter.get('/suppliers', controller.listSuppliers);

// GET /api/partners/customers - List customers only
partnerRouter.get('/customers', controller.listCustomers);

// GET /api/partners/:id - Get partner by ID
partnerRouter.get('/:id', controller.getById);

// POST /api/partners - Create new partner
partnerRouter.post('/', controller.create);

// PUT /api/partners/:id - Update partner
partnerRouter.put('/:id', controller.update);

// DELETE /api/partners/:id - Delete partner
partnerRouter.delete('/:id', controller.delete);
