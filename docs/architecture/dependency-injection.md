# Dependency Injection: Hybrid Constructor Injection

This project uses a **Hybrid Constructor Injection** pattern to balance rigorous dependency management with developer experience and ease of testing.

## The Pattern

Services are defined with **Constructor Injection**, but they provide **default instances** for their dependencies.

### Example

```typescript
export class InvoiceService {
  constructor(
    private readonly repository: InvoiceRepository = new InvoiceRepository(),
    private readonly journalService: JournalService = new JournalService()
    // ... other dependencies
  ) {}
}
```

### Why this pattern?

1.  **Zero-Config Instantiation (DX)**: Developers can instantiate services directly (e.g., `new InvoiceService()`) without manually assembling the entire dependency graph. This is extremely useful for:
    - Legacy code migration.
    - One-off scripts and REPL usage.
    - Quick unit tests where you only want to test the class logic and default dependencies (integration-style unit tests).

2.  **Testability**: In unit tests, dependencies can still be mocked easily:

    ```typescript
    const mockRepo = new MockInvoiceRepository();
    const service = new InvoiceService(mockRepo); // Overrides default
    ```

3.  **Production Control**: In production, we use a central **DI Container** to explicitly wire up singletons, ensuring resource efficiency and consistent lifecycle management.

## The DI Container

The lightweight DI container is located in `apps/api/src/modules/common/di`.

### Core Components

- **`container.ts`**: A simple, factory-based IOC container. It supports lazy instantiation and singleton caching.
- **`register.ts`**: The central wiring file. **This is where the "Real" application is assembled.**

### How it works in Production

When the application starts, `registerServices()` in `register.ts` is called. It registers factory functions for every service.

```typescript
// register.ts
container.register(
  ServiceKeys.INVOICE_SERVICE,
  () =>
    new InvoiceService(
      container.resolve(ServiceKeys.INVOICE_REPOSITORY),
      container.resolve(ServiceKeys.JOURNAL_SERVICE)
      // ... Explicitly resolving dependencies from container
    )
);
```

When `container.resolve(ServiceKeys.INVOICE_SERVICE)` is called:

1.  The container executes the registered factory.
2.  The factory calls `new InvoiceService(...)` passing in **resolved instances** from the container.
3.  These passed instances **override** the default `new Repository()` calls in the constructor.
4.  The container caches the result (Singleton).

## Guidelines for New Services

1.  **Always define dependencies in the constructor.**
2.  **Always provide a default value** (`= new Dependency()`) for every dependency, unless there is a strong reason not to (e.g., circular dependency or configuration requirement).
3.  **Register the service** in `apps/api/src/modules/common/di/register.ts` using `container.resolve()` for all its arguments.

## Handling Circular Dependencies

If you encounter a circular dependency (e.g., Service A needs Service B, and Service B needs Service A):

1.  **Refactor (Preferred)**: Extract the shared logic into a Service C or a utility.
2.  **Method Injection**: Pass the dependency into the specific method that needs it, rather than the constructor.
3.  **Lazy Getter**: Use a getter property that resolves the dependency from the container on demand (use sparingly).

## Future Roadmap

This hybrid pattern is considered **Transitional**.

- **Long-term Goal**: Move towards pure Dependency Injection (removing `new` in constructors) as the codebase matures and the testing infrastructure becomes strictly mock-first.
- **Current State**: The hybrid approach minimizes friction during the rapid MVP development phase.
