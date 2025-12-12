import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';
import {
  CreateProductSchema,
  UpdateProductSchema,
} from '@sync-erp/shared';

export class ProductController {
  private service = new ProductService();

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const validated = CreateProductSchema.parse(req.body);
      const product = await this.service.create(companyId, validated);
      res.status(201).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.context.companyId!;
      const products = await this.service.list(companyId);
      res.json({ success: true, data: products });
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
      const product = await this.service.getById(
        req.params.id,
        companyId
      );
      if (!product) {
        return res
          .status(404)
          .json({
            success: false,
            error: { message: 'Product not found' },
          });
      }
      res.json({ success: true, data: product });
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
      const validated = UpdateProductSchema.parse(req.body);
      const product = await this.service.update(
        req.params.id,
        companyId,
        validated
      );
      res.json({ success: true, data: product });
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
      res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
      next(error);
    }
  };

  getStock = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const product = await this.service.getById(
        req.params.id,
        companyId
      );
      if (!product) {
        return res
          .status(404)
          .json({
            success: false,
            error: { message: 'Product not found' },
          });
      }
      res.json({
        success: true,
        data: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          stockQty: product.stockQty,
          averageCost: product.averageCost,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
