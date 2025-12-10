import { Router, Request, Response, NextFunction } from 'express';
import { CreateCompanySchema, JoinCompanySchema } from '@sync-erp/shared';
import { CompanyService } from '../services/CompanyService';

export const companyRouter = Router();
const companyService = new CompanyService();

// GET /api/companies - List companies for current user
companyRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.context.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'User ID required' },
      });
    }

    const companies = await companyService.listForUser(userId);
    res.json({ success: true, data: companies });
  } catch (error) {
    next(error);
  }
});

// POST /api/companies - Create a new company
companyRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateCompanySchema.parse(req.body);
    const userId = req.context.userId;

    const company = await companyService.create(validated, userId);
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
});

// POST /api/companies/join - Join existing company via invite code
companyRouter.post('/join', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = JoinCompanySchema.parse(req.body);
    const userId = req.context.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const company = await companyService.join(validated, userId);
    res.json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
});

// GET /api/companies/:id - Get company by ID
companyRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await companyService.getById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Company not found' },
      });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
});
