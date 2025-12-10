# Feature Specification: Sidebar Navigation

**Feature Branch**: `004-sidebar`  
**Created**: 2025-12-10  
**Status**: Draft  
**Input**: User description: "tambahkan sidebar" (Add sidebar navigation)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Navigate via Sidebar (Priority: P1) 🎯 MVP

Users can navigate between different sections of the application using a persistent vertical sidebar instead of (or in addition to) the current horizontal header navigation.

**Why this priority**: Core navigation is fundamental to user experience. A sidebar provides better scalability for growing menu items and follows modern ERP/dashboard UI patterns.

**Independent Test**: User logs in, sees sidebar with navigation links, clicks any link, and is taken to the corresponding page.

**Acceptance Scenarios**:

1. **Given** a logged-in user on any page, **When** the page loads, **Then** a sidebar is visible on the left side of the screen with navigation links.
2. **Given** a user viewing the sidebar, **When** they click a navigation link, **Then** they are navigated to the corresponding page.
3. **Given** a user on a specific page, **When** they view the sidebar, **Then** the current page's link is visually highlighted.

---

### User Story 2 - Collapse/Expand Sidebar (Priority: P2)

Users can collapse the sidebar to gain more screen space for the main content, and expand it when needed.

**Why this priority**: Improves usability on smaller screens and gives users control over their workspace layout.

**Independent Test**: User clicks the collapse button, sidebar shrinks to icons-only mode, user clicks expand button, sidebar returns to full width.

**Acceptance Scenarios**:

1. **Given** a user with the sidebar expanded, **When** they click the collapse button, **Then** the sidebar shrinks to show only icons.
2. **Given** a user with the sidebar collapsed, **When** they click the expand button (or hover), **Then** the sidebar expands to show full text labels.
3. **Given** a user who collapsed the sidebar, **When** they refresh the page, **Then** the sidebar remains collapsed (state persisted).

---

### User Story 3 - Responsive Sidebar on Mobile (Priority: P3)

On mobile devices, the sidebar is hidden by default and can be toggled via a hamburger menu.

**Why this priority**: Mobile experience is important but secondary to desktop for an ERP application.

**Independent Test**: User views the application on a mobile device, taps hamburger menu, sidebar slides in, taps a link, navigates and sidebar closes.

**Acceptance Scenarios**:

1. **Given** a user on a mobile device, **When** the page loads, **Then** the sidebar is hidden and a hamburger menu icon is visible.
2. **Given** a user on mobile with the sidebar hidden, **When** they tap the hamburger menu, **Then** the sidebar slides in from the left.
3. **Given** a user on mobile with the sidebar open, **When** they tap a navigation link, **Then** they navigate to the page and the sidebar closes automatically.
4. **Given** a user on mobile with the sidebar open, **When** they tap outside the sidebar or a close button, **Then** the sidebar closes.

---

### Edge Cases

- What happens when user resizes browser from desktop to mobile width? (Sidebar should adapt)
- How does the system handle navigation links that don't fit in collapsed mode? (Icons should be visible, tooltips on hover)
- What happens if JavaScript fails to load? (Navigation should still work via header or fallback)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display a vertical sidebar on the left side of the screen for authenticated users.
- **FR-002**: Sidebar MUST contain all current navigation links (Dashboard, Suppliers, Products, Purchase Orders, Sales Orders, Inventory, Invoices, Finance, Companies).
- **FR-003**: Sidebar MUST visually indicate the currently active page/section.
- **FR-004**: Sidebar MUST support a collapsed state showing only icons.
- **FR-005**: Sidebar state (collapsed/expanded) MUST persist across sessions (localStorage).
- **FR-006**: Sidebar MUST be responsive and adapt to mobile viewports with a hamburger toggle.
- **FR-007**: On mobile, sidebar MUST overlay content when open and close when a link is clicked.
- **FR-008**: Sidebar MUST include the company switcher component.
- **FR-009**: Sidebar MUST include user info display and logout action.

### Key Entities

- **Navigation Item**: Represents a link in the sidebar (path, label, icon).
- **Sidebar State**: Collapsed/Expanded status, persisted per user session.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can access any section of the application within 2 clicks from any page.
- **SC-002**: Sidebar collapse/expand transition completes in under 300ms.
- **SC-003**: 100% of existing navigation functionality remains accessible via the sidebar.
- **SC-004**: Mobile users can open and navigate using the sidebar without horizontal scrolling.
- **SC-005**: Sidebar state persists correctly across browser refresh and new sessions.

## Assumptions

- Icons will be used from an icon library (Heroicons, Lucide, or similar).
- The current header will be simplified to show only logo, user info, and logout; navigation links will move to the sidebar.
- The sidebar will be part of the main `Layout` component.
- Default state is expanded on desktop, hidden on mobile.

## Clarifications

### Session 2025-12-10

- Q: Should the current horizontal header navigation be kept, simplified, or removed? → A: Keep simplified header (logo, user info, logout) but move nav links to sidebar.
