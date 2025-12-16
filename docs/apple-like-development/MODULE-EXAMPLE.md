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

## 3. DTO (API Contract)

### 3.1 `createWarehouse.dto.ts`

```ts
// modules/inventory/dto/createWarehouse.dto.ts

export interface CreateWarehouseDTO {
  code: string;
  name: string;
  address?: string;
}
```

### 3.2 `adjustStock.dto.ts`

```ts
// modules/inventory/dto/adjustStock.dto.ts

export interface AdjustStockDTO {
  productId: string;
  warehouseId: string;
  quantity: number;
  note?: string;
}
```

### 3.3 `moveStock.dto.ts`

```ts
// modules/inventory/dto/moveStock.dto.ts

export interface MoveStockDTO {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  note?: string;
}
```

---

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

Service **combines Rules + Repository**.

### `inventory.service.ts`

```ts
// modules/inventory/inventory.service.ts

import { InventoryRepository } from './inventory.repository';
import { STOCK_MOVEMENT_TYPE } from './inventory.constants';
import { StockRule } from './rules/stockRule';
import { ReservationRule } from './rules/reservationRule';
import { AdjustStockDTO } from './dto/adjustStock.dto';
import { MoveStockDTO } from './dto/moveStock.dto';
import { CreateWarehouseDTO } from './dto/createWarehouse.dto';

export class InventoryService {
  constructor(
    private readonly inventoryRepo = new InventoryRepository()
  ) {}

  async createWarehouse(dto: CreateWarehouseDTO) {
    return this.inventoryRepo.createWarehouse(dto);
  }

  async adjustStock(dto: AdjustStockDTO) {
    const stock = await this.inventoryRepo.findStock(
      dto.productId,
      dto.warehouseId
    );

    const currentQty = stock?.quantity ?? 0;
    const newQty = currentQty + dto.quantity;

    if (newQty < 0) {
      StockRule.ensureAvailableStock(
        currentQty,
        Math.abs(dto.quantity)
      );
    }

    await this.inventoryRepo.createStockMovement({
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      quantity: dto.quantity,
      type: STOCK_MOVEMENT_TYPE.ADJUSTMENT,
      source: 'MANUAL_ADJUSTMENT',
      note: dto.note,
    });

    if (stock) {
      await this.inventoryRepo.updateStockQuantity(stock.id, newQty);
    }
  }

  async moveStock(dto: MoveStockDTO) {
    const fromStock = await this.inventoryRepo.findStock(
      dto.productId,
      dto.fromWarehouseId
    );

    StockRule.ensureAvailableStock(fromStock.quantity, dto.quantity);

    await this.adjustStock({
      productId: dto.productId,
      warehouseId: dto.fromWarehouseId,
      quantity: -dto.quantity,
      note: dto.note,
    });

    await this.adjustStock({
      productId: dto.productId,
      warehouseId: dto.toWarehouseId,
      quantity: dto.quantity,
      note: dto.note,
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
