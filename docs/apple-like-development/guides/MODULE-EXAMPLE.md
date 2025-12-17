# Inventory Module: Concrete Reference Implementation

> **Assumption**: Node.js + Express, TypeScript, Prisma (or any ORM), Clean-ish Layered Architecture.

We will dissect the **Inventory Module end-to-end**, from entity to controller, ensuring it is **complete and consistent**.

---

## 1. `inventory.constants.ts`

This is the place for values that **must not be hard-coded**.

```ts
// modules/inventory/inventory.constants.ts

export const STOCK_MOVEMENT_TYPE = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  RESERVE: 'RESERVE',
  RELEASE: 'RELEASE',
} as const;

export type StockMovementType =
  (typeof STOCK_MOVEMENT_TYPE)[keyof typeof STOCK_MOVEMENT_TYPE];
```

---

## 2. Entities (Domain Representation)

### 2.1 `stockItem.entity.ts`

```ts
// modules/inventory/entities/stockItem.entity.ts

export interface StockItem {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `stockMovement.entity.ts`

```ts
// modules/inventory/entities/stockMovement.entity.ts

import { StockMovementType } from '../inventory.constants';

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  source: string;
  referenceId?: string;
  note?: string;
  createdAt: Date;
}
```

### 2.3 `warehouse.entity.ts`

```ts
// modules/inventory/entities/warehouse.entity.ts

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
}
```

---

## 3. Input Types (Schema-First API Contract)

> **Note**: We use **Zod schemas** in `packages/shared/src/validators/` instead of traditional DTO folders. This follows Constitution Principle IX: Schema-First Development.

### Why Schema-First?

1. **Single Source of Truth** — Zod schema defines both validation AND TypeScript type
2. **Runtime Validation** — Automatic validation in controllers
3. **No Duplication** — Frontend and backend share the same types

### Location: `packages/shared/src/validators/index.ts`

```ts
// packages/shared/src/validators/index.ts

import { z } from 'zod';

// 1. Define Zod Schema (validation + type in one)
export const CreateWarehouseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  address: z.string().optional(),
});

export const AdjustStockSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number(),
  note: z.string().optional(),
});

export const MoveStockSchema = z.object({
  productId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.number().positive(),
  note: z.string().optional(),
});

// 2. Export inferred types (replaces manual DTO interfaces)
export type CreateWarehouseInput = z.infer<
  typeof CreateWarehouseSchema
>;
export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;
export type MoveStockInput = z.infer<typeof MoveStockSchema>;
```

### Usage in Controller

```ts
// modules/inventory/inventory.controller.ts
import { AdjustStockSchema } from '@sync-erp/shared';

async adjustStock(req: Request, res: Response) {
  const validated = AdjustStockSchema.parse(req.body); // Runtime validation!
  await this.service.adjustStock(validated);
  res.json({ success: true });
}
```

> ⚠️ **Forbidden**: Do NOT create manual `interface` for API request/response types. Always use `z.infer<typeof Schema>`.

## 4. Rules (Pure Business Logic)

This is the **Core of the ERP**. It must not know about the database, requests, or express.

### 4.1 `stockRule.ts`

```ts
// modules/inventory/rules/stockRule.ts

export class StockRule {
  static ensureAvailableStock(
    availableQty: number,
    requestedQty: number
  ): void {
    if (requestedQty <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    if (availableQty < requestedQty) {
      throw new Error('Insufficient stock');
    }
  }
}
```

### 4.2 `reservationRule.ts`

```ts
// modules/inventory/rules/reservationRule.ts

export class ReservationRule {
  static ensureReservable(
    availableQty: number,
    requestedQty: number
  ): void {
    if (availableQty - requestedQty < 0) {
      throw new Error('Not enough stock to reserve');
    }
  }
}
```

---

## 5. Repository (Data Access)

Repository handles **only CRUD and DB transactions**.

### `inventory.repository.ts`

```ts
// modules/inventory/inventory.repository.ts

import { StockMovementType } from './inventory.constants';

export class InventoryRepository {
  async findStock(productId: string, warehouseId: string) {
    // prisma.stockItem.findFirst(...)
    return null;
  }

  async createStockMovement(data: {
    productId: string;
    warehouseId: string;
    quantity: number;
    type: StockMovementType;
    source: string;
    referenceId?: string;
    note?: string;
  }) {
    // prisma.stockMovement.create(...)
  }

  async updateStockQuantity(
    stockItemId: string,
    quantity: number,
    reservedQuantity?: number
  ) {
    // prisma.stockItem.update(...)
  }

  async createWarehouse(data: {
    code: string;
    name: string;
    address?: string;
  }) {
    // prisma.warehouse.create(...)
  }
}
```

---

## 6. Service (Orchestrator)

Service **combines Policy + Rules + Repository**.

### `inventory.service.ts`

```ts
// modules/inventory/inventory.service.ts

import { InventoryRepository } from './inventory.repository';
import { InventoryPolicy } from './inventory.policy';
import { STOCK_MOVEMENT_TYPE } from './inventory.constants';
import { StockRule } from './rules/stockRule';
import { ReservationRule } from './rules/reservationRule';
import {
  AdjustStockInput,
  MoveStockInput,
  CreateWarehouseInput,
  BusinessShape,
} from '@sync-erp/shared';

export class InventoryService {
  constructor(
    private readonly inventoryRepo = new InventoryRepository(),
    private readonly policy = new InventoryPolicy()
  ) {}

  async createWarehouse(
    input: CreateWarehouseInput,
    shape: BusinessShape
  ) {
    // Policy check FIRST
    this.policy.ensureCanManageWarehouse(shape);
    return this.inventoryRepo.createWarehouse(input);
  }

  async adjustStock(input: AdjustStockInput) {
    const stock = await this.inventoryRepo.findStock(
      input.productId,
      input.warehouseId
    );

    const currentQty = stock?.quantity ?? 0;
    const newQty = currentQty + input.quantity;

    if (newQty < 0) {
      StockRule.ensureAvailableStock(
        currentQty,
        Math.abs(input.quantity)
      );
    }

    await this.inventoryRepo.createStockMovement({
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      type: STOCK_MOVEMENT_TYPE.ADJUSTMENT,
      source: 'MANUAL_ADJUSTMENT',
      note: input.note,
    });

    if (stock) {
      await this.inventoryRepo.updateStockQuantity(stock.id, newQty);
    }
  }

  async moveStock(input: MoveStockInput) {
    const fromStock = await this.inventoryRepo.findStock(
      input.productId,
      input.fromWarehouseId
    );

    StockRule.ensureAvailableStock(
      fromStock.quantity,
      input.quantity
    );

    await this.adjustStock({
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      quantity: -input.quantity,
      note: input.note,
    });

    await this.adjustStock({
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      quantity: input.quantity,
      note: input.note,
    });
  }

  async reserveStock(params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    source: string;
    referenceId?: string;
  }) {
    const stock = await this.inventoryRepo.findStock(
      params.productId,
      params.warehouseId
    );

    ReservationRule.ensureReservable(
      stock.quantity - stock.reservedQuantity,
      params.quantity
    );

    await this.inventoryRepo.createStockMovement({
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity: params.quantity,
      type: STOCK_MOVEMENT_TYPE.RESERVE,
      source: params.source,
      referenceId: params.referenceId,
    });

    await this.inventoryRepo.updateStockQuantity(
      stock.id,
      stock.quantity,
      stock.reservedQuantity + params.quantity
    );
  }
}
```

---

## 7. Controller (HTTP Boundary)

Controller **must not have business logic**.

### `inventory.controller.ts`

```ts
// modules/inventory/inventory.controller.ts

import { Request, Response } from 'express';
import { InventoryService } from './inventory.service';

const inventoryService = new InventoryService();

export class InventoryController {
  static async createWarehouse(req: Request, res: Response) {
    result = await inventoryService.createWarehouse(req.body);
    res.status(201).json(result);
  }

  static async adjustStock(req: Request, res: Response) {
    await inventoryService.adjustStock(req.body);
    res.status(200).json({ success: true });
  }

  static async moveStock(req: Request, res: Response) {
    await inventoryService.moveStock(req.body);
    res.status(200).json({ success: true });
  }
}
```

---

## 8. Why This Structure Matters for Apple-Style Onboarding

Because now you can:

- Enable/Disable:
  - Reservation
  - Multi-warehouse
  - WIP
- **Without changing the service or controller**.
- Just by using:
  - Config
  - Rule switches

Inventory becomes the **engine**, and onboarding becomes the **control panel**.
