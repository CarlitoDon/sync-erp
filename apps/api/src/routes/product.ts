import { Router } from 'express';
import { ProductController } from '../modules/product/product.controller';

export const productRouter = Router();
const controller = new ProductController();

// GET /api/products - List all products
productRouter.get('/', controller.list);

// GET /api/products/:id/stock - Check stock level (Specific route before generic :id)
productRouter.get('/:id/stock', controller.getStock);

// GET /api/products/:id - Get product by ID
productRouter.get('/:id', controller.getById);

// POST /api/products - Create new product
productRouter.post('/', controller.create);

// PUT /api/products/:id - Update product
productRouter.put('/:id', controller.update);

// DELETE /api/products/:id - Delete product
productRouter.delete('/:id', controller.delete);
