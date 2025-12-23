# Data Model: Purchase & Sales Orders

**Context**: This feature relies on existing models but changes how Types are generated.

## Core Enums (Schema Source)

These enums will now be the Single Source of Truth for Zod schemas.

### PaymentTerms

```prisma
enum PaymentTerms {
  NET7
  NET30
  NET60
  NET90
  COD
  EOM
  NET_30 // Legacy
  PARTIAL // Partial upfront
  UPFRONT // Full payment before delivery
}
```

### OrderStatus

```prisma
enum OrderStatus {
  DRAFT
  CONFIRMED
  PARTIALLY_RECEIVED
  RECEIVED
  PARTIALLY_SHIPPED
  SHIPPED
  COMPLETED
  CANCELLED
}
```

## Generated Schemas

`zod-prisma-types` will generate:

- `PaymentTermsSchema`: `z.nativeEnum(PaymentTerms)`
- `OrderStatusSchema`: `z.nativeEnum(OrderStatus)`
- `OrderSchema`: Full model validation
