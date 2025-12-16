import { Router } from 'express';
import { CompanyController } from '../modules/company/company.controller';
import { z } from 'zod';

export const companyRouter = Router();
const controller = new CompanyController();

const CreateCompanySchema = z.object({
  name: z.string().min(3),
});

const JoinCompanySchema = z.object({
  inviteCode: z.string().min(5),
});

// POST /api/companies - Create new company
companyRouter.post('/', async (req, res, next) => {
  try {
    CreateCompanySchema.parse(req.body);
    await controller.create(req, res, next);
  } catch (e) {
    next(e);
  }
});

// POST /api/companies/join - Join existing company
companyRouter.post('/join', async (req, res, next) => {
  try {
    JoinCompanySchema.parse(req.body);
    await controller.join(req, res, next);
  } catch (e) {
    next(e);
  }
});

// GET /api/companies - List user's companies
companyRouter.get('/', controller.list);

// ============================================
// Business Shape Endpoints (Apple-Like Core)
// MUST be before /:id to prevent :id from catching these paths
// ============================================

// GET /api/companies/shape - Get current business shape
companyRouter.get('/shape', controller.getShape);

// POST /api/companies/select-shape - Select business shape (one-time)
companyRouter.post('/select-shape', controller.selectShape);

// GET /api/companies/:id - Get company by ID (MUST be last due to param matching)
companyRouter.get('/:id', controller.getById);


