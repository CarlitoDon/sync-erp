import { Router, Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';
import { z } from 'zod';

export const productRouter = Router();
const productService = new ProductService();

const CreateProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(2),
  price: z.number().positive(),
});

const UpdateProductSchema = z.object({
  name: z.string().min(2).optional(),
  price: z.number().positive().optional(),
});

// GET /api/products - List all products
productRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const products = await productService.list(companyId);

    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - Get product by ID
productRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const product = await productService.getById(req.params.id, companyId);

    if (!product) {
      return res.status(404).json({ success: false, error: { message: 'Product not found' } });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// POST /api/products - Create new product
productRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = CreateProductSchema.parse(req.body);

    const product = await productService.create(companyId, validated);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - Update product
productRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = UpdateProductSchema.parse(req.body);

    const product = await productService.update(req.params.id, companyId, validated);
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id - Delete product
productRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    await productService.delete(req.params.id, companyId);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id/stock - Check stock level
productRouter.get('/:id/stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const product = await productService.getById(req.params.id, companyId);

    if (!product) {
      return res.status(404).json({ success: false, error: { message: 'Product not found' } });
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
});
