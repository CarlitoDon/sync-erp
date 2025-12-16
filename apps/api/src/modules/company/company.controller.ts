import { Request, Response, NextFunction } from 'express';
import { CompanyService } from './company.service';
import { SelectShapeSchema, DomainError } from '@sync-erp/shared';
import { BusinessShape } from '@sync-erp/database';

export class CompanyController {
  private service = new CompanyService();

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { name } = req.body;
      const userId = req.context?.userId; // Optional userId if authenticated
      const company = await this.service.create({ name }, userId);
      res.status(201).json({ success: true, data: company });
    } catch (error) {
      next(error);
    }
  };

  join = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { inviteCode } = req.body;
      const userId = req.context?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Unauthorized' },
        });
      }
      const company = await this.service.join({ inviteCode }, userId);
      res.json({ success: true, data: company });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context?.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'userId is required' },
        });
      }
      const companies = await this.service.listForUser(userId);
      res.json({ success: true, data: companies });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const company = await this.service.getById(req.params.id);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: { message: 'Company not found' },
        });
      }
      res.json({ success: true, data: company });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/company/select-shape
   * Select business shape for a company (one-time, immutable after selection).
   */
  selectShape = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context?.companyId;
      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: { message: 'x-company-id header required' },
        });
      }

      // Fetch company from service (optionalAuthMiddleware doesn't load req.company)
      const existingCompany = await this.service.getById(companyId);
      if (!existingCompany) {
        return res.status(404).json({
          success: false,
          error: { message: 'Company not found' },
        });
      }

      const currentShape = existingCompany.businessShape as BusinessShape;

      // Validate input
      const validated = SelectShapeSchema.parse(req.body);
      const newShape = validated.shape as BusinessShape;

      const company = await this.service.selectShape(
        companyId,
        newShape,
        currentShape
      );

      res.json({
        success: true,
        data: company,
        message: `Business shape set to ${newShape}. Configuration seeded.`,
      });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  /**
   * GET /api/company/shape
   * Get current business shape for the company.
   */
  getShape = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context?.companyId;
      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: { message: 'x-company-id header required' },
        });
      }

      // Fetch company from service (optionalAuthMiddleware doesn't load req.company)
      const company = await this.service.getById(companyId);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: { message: 'Company not found' },
        });
      }

      res.json({
        success: true,
        data: {
          id: company.id,
          name: company.name,
          businessShape: company.businessShape,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}


