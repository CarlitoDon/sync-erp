import { Request, Response, NextFunction } from 'express';
import { PartnerService } from './partner.service';
import {
  CreatePartnerSchema,
  UpdatePartnerSchema,
  PartnerTypeSchema,
} from '@sync-erp/shared';
import { PartnerType } from '@sync-erp/database';

export class PartnerController {
  private service = new PartnerService();

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const validated = CreatePartnerSchema.parse(req.body);
      const partner = await this.service.create(companyId, validated);
      res.status(201).json({ success: true, data: partner });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const typeParam = req.query.type as string | undefined;

      // Validate type param if present
      let type: PartnerType | undefined;
      if (typeParam) {
        const result = PartnerTypeSchema.safeParse(typeParam);
        if (result.success) {
          type = result.data as PartnerType;
        }
      }

      const partners = await this.service.list(companyId, type);
      res.json({ success: true, data: partners });
    } catch (error) {
      next(error);
    }
  };

  listSuppliers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const suppliers = await this.service.listSuppliers(companyId);
      res.json({ success: true, data: suppliers });
    } catch (error) {
      next(error);
    }
  };

  listCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const customers = await this.service.listCustomers(companyId);
      res.json({ success: true, data: customers });
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
      const companyId = req.context.companyId!;
      const partner = await this.service.getById(
        req.params.id,
        companyId
      );
      if (!partner) {
        return res
          .status(404)
          .json({
            success: false,
            error: { message: 'Partner not found' },
          });
      }
      res.json({ success: true, data: partner });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const validated = UpdatePartnerSchema.parse(req.body);
      const partner = await this.service.update(
        req.params.id,
        companyId,
        validated
      );
      res.json({ success: true, data: partner });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      await this.service.delete(req.params.id, companyId);
      res.json({ success: true, message: 'Partner deleted' });
    } catch (error) {
      next(error);
    }
  };
}
