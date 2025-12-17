# Quickstart: Parallel Saga Safety

**Goal**: Implement concurrency locking in Sagas using Transaction Injection.

## 1. Repositories

Update your repository methods to accept an optional `tx` parameter.

```typescript
// BEFORE
async update(id: string, data: any) {
  return prisma.invoice.update(...);
}

// AFTER
async update(id: string, data: any, tx?: Prisma.TransactionClient) {
  const db = tx || this.prisma; // Use transaction if provided
  return db.invoice.update(...);
}
```

## 2. Saga Implementation

Update your `executeSteps` to accept and use the `tx`.

```typescript
// BEFORE
protected async executeSteps(input: Input, context: Context): Promise<Invoice> {
  const invoice = await this.repo.findById(input.id);
  // ...
}

// AFTER
protected async executeSteps(input: Input, context: Context, tx?: Prisma.TransactionClient): Promise<Invoice> {
  // PASS tx TO REPOS!
  const invoice = await this.repo.findById(input.id, input.companyId, 'INVOICE', tx);
  // ...
}
```

## 3. Verification

Run the concurrency test suite:

```bash
npm test -- test/integration/concurrency/saga-locking.test.ts
```
