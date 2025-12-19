import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { StockAdjustmentSchema, DomainError } from '@sync-erp/shared';

/**
 * InventoryController
 *
 * A "dumb adapter" that only:
 * 1. Extracts data from req.body/query
 * 2. Validates with Zod schemas
 * 3. Calls the service layer
 * 4. Returns the response
 *
 * NO business logic. All logic lives in Service/Policy/Rules.
 */
export class InventoryController {
  private service = new InventoryService();

  // GET /api/inventory/stock - Get all stock levels
  getStockLevels = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const stockLevels =
        await this.service.getStockLevels(companyId);
      res.json({ success: true, data: stockLevels });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // GET /api/inventory/movements - Get inventory movements
  getMovements = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const productId = req.query.productId as string | undefined;

      const movements = await this.service.getMovements(
        companyId,
        productId
      );
      res.json({ success: true, data: movements });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // POST /api/inventory/adjust - Manual stock adjustment
  adjustStock = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const company = req.company!; // Company context with businessShape
      const validated = StockAdjustmentSchema.parse(req.body);

      const movement = await this.service.adjustStock(
        companyId,
        validated,
        company.businessShape,
        company.configs
      );
      res.status(201).json({ success: true, data: movement });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // ==========================================
  // GRN Endpoints (034-grn-fullstack)
  // ==========================================

  // GET /api/inventory/receipts
  listReceipts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const receipts = await this.service.listGRN(companyId);
      res.json({ success: true, data: receipts });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // GET /api/inventory/receipts/:id
  getReceipt = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const { id } = req.params;
      const receipt = await this.service.getGRN(companyId, id);
      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, error: 'Receipt not found' });
      }
      res.json({ success: true, data: receipt });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // POST /api/inventory/receipts
  createReceipt = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const receipt = await this.service.createGRN(
        companyId,
        req.body
      );
      res.status(201).json({ success: true, data: receipt });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // POST /api/inventory/receipts/:id/post
  postReceipt = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const { id } = req.params;
      const receipt = await this.service.postGRN(companyId, id);
      res.json({ success: true, data: receipt });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // ==========================================
  // Shipment Endpoints (034-grn-fullstack)
  // ==========================================

  // GET /api/inventory/shipments
  listShipments = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const shipments = await this.service.listShipments(companyId);
      res.json({ success: true, data: shipments });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // GET /api/inventory/shipments/:id
  getShipment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const { id } = req.params;
      const shipment = await this.service.getShipment(companyId, id);
      if (!shipment) {
        return res
          .status(404)
          .json({ success: false, error: 'Shipment not found' });
      }
      res.json({ success: true, data: shipment });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // POST /api/inventory/shipments
  createShipment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const shipment = await this.service.createShipment(
        companyId,
        req.body
      );
      res.status(201).json({ success: true, data: shipment });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };

  // POST /api/inventory/shipments/:id/post
  postShipment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const { id } = req.params;
      const shipment = await this.service.postShipment(companyId, id);
      res.json({ success: true, data: shipment });
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };
}
