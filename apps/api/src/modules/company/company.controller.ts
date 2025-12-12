import { Request, Response, NextFunction } from 'express';
import { CompanyService } from './company.service';

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
        return res
          .status(401)
          .json({
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
        return res
          .status(400)
          .json({
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
}
