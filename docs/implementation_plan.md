Maintainability Report: Santi Living
Date: 2026-01-12 Scope: Deep scan of apps/bot-service, apps/erp-sync-service, and src (Astro Frontend).

Executive Summary
A deep scan of the codebase revealed that while recent backend improvements have increased type safety and reduced duplication, the frontend (Astro) suffers from component bloat and widespread lack of type safety. Specifically, Calculator.astro is critically large, and any types are prevalent in core scripts.

1. Resolved Improvements (Backend)
The following issues were identified and fixed in the initial phase:

apps/bot-service: Removed any typing for the WhatsApp Client in session.ts. Improved error handling in send-message.ts.
apps/erp-sync-service: Deduplicated address interface definitions in erp-client.ts by introducing BaseAddressFields.
2. Open Issues & Findings (Frontend / Root)
A. Component Bloat (High Priority)
Two components are excessively large, making them hard to read, maintain, and debug.

src/components/Calculator.astro: 1,222 lines. This is a "God Component" handling too much logic (UI, calculation, state).
src/pages/sewa-kasur/checkout.astro: 754 lines. Contains mixed concerns of layout, form handling, and validation.
B. Type Safety Violations (High Priority)
The strictness of TypeScript is bypassed in several critical files using any.

src/scripts/calculator.ts: Uses any for pricing tier logic (t: any).
src/scripts/checkout.ts: Uses any for order and items in summary rendering functions.
src/pages/sewa-kasur/cart.astro: Uses any when handling order data from local storage.
src/pages/sewa-kasur/thank-you.astro & pesanan/[token].astro: Uses any for mapping order items.
C. Code Hygiene (Low Priority)
src/scripts/calculator.ts: Contains a leftover console.log("Order created in ERP:", ...) which should be removed or replaced with a proper logger.
3. Recommendations & Next Steps
To improve the maintainability of the frontend, I recommend the following plan:

Define Shared Types: Create src/types/Order.ts and src/types/Cart.ts.
Define strict interfaces for Order, OrderItem, and PricingTier.
Replace all instances of any in scripts and Astro pages with these types.
Refactor Calculator.astro:
Extract sub-components (e.g., <MattressSelector />, <DurationPicker />, <PriceSummary />).
Move complex calculation logic fully into src/scripts/calculator.ts (or a new services/pricing.ts) and test it independently.
Refactor checkout.astro:
Extract the form sections into reusable components (e.g., <CustomerForm />, <DeliveryForm />).
Cleanup: Remove console logs.
