# Quickstart: Sidebar Navigation

**Feature**: 004-sidebar  
**Date**: 2025-12-10

## Prerequisites

- Node.js 18+
- npm installed
- Dev server running (`npm run dev`)

## Quick Verification Steps

### 1. Start the Application

```bash
cd c:\Offline\Coding\sync-erp
npm run dev
```

### 2. Verify Sidebar Appears

1. Open browser to `http://localhost:5173`
2. Log in with valid credentials
3. **Expected**: Sidebar visible on left side of screen

### 3. Test Navigation

1. Click any sidebar link (e.g., "Suppliers")
2. **Expected**: Page navigates, sidebar link is highlighted

### 4. Test Collapse/Expand

1. Click the collapse button (usually `<<` or hamburger icon)
2. **Expected**: Sidebar shrinks to show only icons
3. Click expand button
4. **Expected**: Sidebar expands to show full labels

### 5. Test Persistence

1. Collapse the sidebar
2. Refresh the page (Ctrl+R)
3. **Expected**: Sidebar remains collapsed

### 6. Test Mobile Responsiveness

1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select mobile viewport (e.g., iPhone 12)
4. **Expected**: Sidebar hidden, hamburger menu visible
5. Tap hamburger menu
6. **Expected**: Sidebar slides in as overlay
7. Tap a navigation link
8. **Expected**: Navigates and sidebar closes

## Troubleshooting

| Issue                   | Solution                                   |
| ----------------------- | ------------------------------------------ |
| Sidebar not visible     | Check `Layout.tsx` includes `<Sidebar />`  |
| Icons not showing       | Verify Heroicons installed or SVGs present |
| State not persisting    | Check localStorage key `sidebar_collapsed` |
| Mobile menu not working | Verify breakpoint CSS (768px)              |
