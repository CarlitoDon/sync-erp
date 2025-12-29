# Feature Specification: Frontend Code Quality & Performance Improvements (Phase 2)

**Feature Branch**: `040-frontend-improvements-p2`  
**Created**: December 29, 2025  
**Status**: Draft  
**Input**: Analysis from `docs/frontend-improvements.md` (uncovered items from 039)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consolidated Partner Pages (Priority: P2)

As a developer, I want Suppliers and Customers pages to share implementation so that changes are applied consistently and maintenance is reduced.

**Why this priority**: ~95% code duplication between these pages increases maintenance burden and risk of divergent behavior.

**Integration Scenario**: Developer needs to add filtering → Changes one component → Both Suppliers and Customers pages get the feature.

**Acceptance Scenarios**:

1. **Given** Suppliers page, **When** rendered, **Then** uses shared `PartnerListPage` component with type="SUPPLIER"
2. **Given** Customers page, **When** rendered, **Then** uses shared `PartnerListPage` component with type="CUSTOMER"
3. **Given** PartnerListPage, **When** a new feature is added, **Then** both Suppliers and Customers pages benefit
4. **Given** existing Partner CRUD operations, **When** using consolidated component, **Then** all functionality preserved

---

### User Story 2 - Unified Order Form Logic (Priority: P2)

As a developer, I want PurchaseOrders and SalesOrders to share form logic so that form behavior is consistent and bugs are fixed in one place.

**Why this priority**: Both pages share ItemInput interface, calculateTotals(), item handlers with minor differences. Reduces ~40% duplication.

**Integration Scenario**: Developer fixes item calculation bug → Fix applies to both PO and SO forms → Users see consistent behavior.

**Acceptance Scenarios**:

1. **Given** creating a Purchase Order, **When** adding items, **Then** uses shared `useOrderForm` hook
2. **Given** creating a Sales Order, **When** calculating totals, **Then** uses same calculation logic as PO
3. **Given** shared `OrderItemEditor` component, **When** rendered in PO/SO, **Then** appropriate labels shown (Supplier vs Customer)
4. **Given** existing order creation flow, **When** using shared hooks, **Then** all functionality preserved

---

### User Story 3 - No Company Selected State (Priority: P3)

As a user, I want a clear indication when no company is selected so that I understand why features are disabled and what action to take.

**Why this priority**: Quick win for UX. Current "Please select a company first" text is inconsistent across 10+ pages.

**Integration Scenario**: User hasn't selected company → Sees consistent empty state with guidance → Clicks link to company selection.

**Acceptance Scenarios**:

1. **Given** no company selected, **When** visiting any feature page, **Then** sees `NoCompanySelected` component
2. **Given** `NoCompanySelected` displayed, **When** user reads message, **Then** sees clear call-to-action
3. **Given** `NoCompanySelected` displayed, **When** user clicks action, **Then** navigated to company selection

---

### User Story 4 - Consistent Form Inputs (Priority: P3)

As a developer, I want all form inputs to use the shared `Input` component so that styling is consistent and changes apply globally.

**Why this priority**: 14+ raw `<input>` elements with repeated className strings. Using shared component ensures consistency.

**Integration Scenario**: Design system updates input styling → Shared Input component updated → All forms reflect change.

**Acceptance Scenarios**:

1. **Given** a form with text input, **When** implemented, **Then** uses shared `Input` component
2. **Given** shared Input component, **When** styling changes, **Then** all forms update consistently
3. **Given** Input component, **When** used with validation, **Then** displays error state correctly

---

### User Story 5 - Consolidated PageHeader (Priority: P3)

As a developer, I want a single PageHeader component so that header styling is consistent across list and detail pages.

**Why this priority**: Two PageHeader components with overlapping functionality. Consolidation reduces confusion.

**Integration Scenario**: Developer creates new page → Uses single PageHeader → Consistent with rest of app.

**Acceptance Scenarios**:

1. **Given** a list page, **When** rendering header, **Then** uses unified PageHeader with description prop
2. **Given** a detail page, **When** rendering header, **Then** uses unified PageHeader with badges prop
3. **Given** PageHeader, **When** both description and badges provided, **Then** renders correctly

---

### User Story 6 - Performance Memoization (Priority: P4)

As a user, I want list pages to render efficiently so that scrolling and interactions are smooth even with large datasets.

**Why this priority**: Future optimization. Only 10 occurrences of memoization in codebase. Tables with 100+ rows may benefit.

**Integration Scenario**: User scrolls through 100+ products → Table rows don't re-render unnecessarily → Smooth UX.

**Acceptance Scenarios**:

1. **Given** OrderListTable with 100 rows, **When** parent state changes, **Then** only affected rows re-render
2. **Given** memoized table row component, **When** props unchanged, **Then** React skips re-render
3. **Given** useMemo for expensive calculations, **When** dependencies unchanged, **Then** cached value used

---

### Edge Cases

- What if PartnerListPage needs supplier-specific or customer-specific features? (Props for optional sections)
- What if order forms diverge significantly? (Shared hook returns primitives, page handles presentation)
- What if company selection is in progress? (Show loading state, not NoCompanySelected)
- What if Input component doesn't fit specialized use case? (Allow escape hatch via raw input)
- What about search/filter inputs that need different styling? (Input variants via props)

## Requirements _(mandatory)_

### Functional Requirements

**Partner Page Consolidation**
- **FR-001**: System MUST provide `PartnerListPage` component accepting `type`, `label`, `labelPlural`, `basePath` props
- **FR-002**: PartnerListPage MUST handle all CRUD operations for both Suppliers and Customers
- **FR-003**: PartnerListPage SHOULD support partner search and filtering _(deferred to future enhancement)_

**Order Form Consolidation**
- **FR-004**: System MUST provide `useOrderForm<T>` hook for shared order form logic
- **FR-005**: useOrderForm MUST provide items, currentItem, addItem, removeItem, calculateTotals
- **FR-006**: System MUST provide `OrderItemEditor` component for adding items to orders
- **FR-007**: OrderItemEditor MUST accept partner label (Supplier/Customer) as prop

**No Company Selected**
- **FR-008**: System MUST provide `NoCompanySelected` component with consistent messaging
- **FR-009**: NoCompanySelected MUST include call-to-action to company selection
- **FR-010**: All feature pages MUST use NoCompanySelected when currentCompany is null

**Form Input Consistency**
- **FR-011**: Shared `Input` component MUST support label, error, required, and disabled props
- **FR-012**: All text form inputs SHOULD use shared Input component
- **FR-013**: Input MUST support type variants (text, email, number, password)

**PageHeader Consolidation**
- **FR-014**: System MUST provide single `PageHeader` component supporting all use cases
- **FR-015**: PageHeader MUST support title, subtitle, description, badges, actions, showBackButton props
- **FR-016**: PageHeader MUST handle back navigation when showBackButton is true

**Memoization**
- **FR-017**: Table row components SHOULD be wrapped in React.memo()
- **FR-018**: Expensive calculations SHOULD use useMemo with appropriate dependencies
- **FR-019**: Event handlers in loops SHOULD use useCallback

### Key Entities

- **PartnerListPage**: Generic page component for Suppliers/Customers
- **useOrderForm**: Hook encapsulating order form state and logic
- **OrderItemEditor**: Component for adding line items to orders
- **NoCompanySelected**: Empty state component for missing company context
- **Input**: Shared form input component with validation support
- **PageHeader**: Unified header component for all page types

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero code duplication between Suppliers.tsx and Customers.tsx (use shared component)
- **SC-002**: 50%+ reduction in order form code through shared hooks
- **SC-003**: All 10+ "Please select company" occurrences replaced with NoCompanySelected
- **SC-004**: 80%+ of raw `<input>` elements replaced with shared Input component
- **SC-005**: Single PageHeader component used across all pages
- **SC-006**: Key list components memoized (OrderListTable, OrderItemsTable)

## Constitution & Architecture Compliance _(mandatory)_

### Backend Architecture (Apps/API) - Principles I, II, III, XXI

- [N/A] **5-Layer Architecture**: Frontend-only feature
- [N/A] **Schema-First**: Frontend-only feature
- [N/A] **Multi-Tenant**: Frontend-only feature
- [N/A] **Service Purity**: Frontend-only feature
- [N/A] **Policy & Rules**: Frontend-only feature
- [N/A] **Repository Purity**: Frontend-only feature
- [N/A] **Anti-Bloat**: Frontend-only feature

### Frontend Architecture (Apps/Web) - Principles IV, XI

- [ ] **Feature Isolation**: Shared components in `components/`, feature-specific in `features/`
- [ ] **No Business Logic**: Components only handle UI presentation
- [ ] **API Patterns**: N/A for these components
- [ ] **User Safety**: NoCompanySelected guides users to correct action
- [ ] **State Projection**: Shared hooks project state consistently across features

### Testing & Quality - Principles XV, XVII

- [ ] **Integration Tests**: Optional - verify component behavior with different props
- [ ] **Mock Compliance**: N/A
- [ ] **Financial Precision**: N/A (calculation logic already tested)
- [ ] **Zero-Lag**: Memoization improves render performance

## Assumptions

1. Suppliers and Customers will continue to share the same data structure (Partner model)
2. PO and SO forms will remain structurally similar (items, totals, partner)
3. Existing usePartnerMutations hook can be leveraged for PartnerListPage
4. Input component styling matches current raw input styling
5. No need for virtualization (lists under 500 items)

## Out of Scope

- React Hook Form integration (separate initiative - 041)
- Generic DataTable component (separate initiative - 042)
- Full accessibility audit (separate initiative - 043)
- List virtualization for large datasets
- Advanced form validation beyond required fields
- Partner search/filtering in PartnerListPage (future enhancement)
