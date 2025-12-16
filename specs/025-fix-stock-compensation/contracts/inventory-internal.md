# API Contracts: Stock Compensation

**Feature**: Stock Compensation for Saga Rollback (B2)

_No external API changes. This feature is purely internal backend logic._

## Internal Service Contracts

### `InventoryService.processReturn`

We rely on this existing contract:

```typescript
async processReturn(
  companyId: string,
  orderId: string,
  items: { productId: string; quantity: number }[],
  reference?: string
): Promise<InventoryMovement[]>
```

**Usage in Saga**:

- **orderId**: Retrieved from failed transaction context.
- **items**: Mapped from original Order Items (implies full return).
- **reference**: "Saga compensation for Invoice [ID]"
