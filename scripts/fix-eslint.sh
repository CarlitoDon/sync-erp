#!/bin/bash
# Fix ESLint issues across the codebase

echo "=== Fixing ESLint Issues ==="

# 1. Fix the react-hooks rule error by removing invalid disable comments
echo "[1/4] Removing invalid eslint-disable comments..."
sed -i '' '/eslint-disable-next-line react-hooks\/exhaustive-deps/d' apps/web/src/features/procurement/components/PurchaseOrderList.tsx
sed -i '' '/eslint-disable-next-line react-hooks\/exhaustive-deps/d' apps/web/src/features/sales/components/SalesOrderList.tsx

# 2. Add eslint-disable for console in scripts
echo "[2/4] Adding eslint-disable for scripts with console..."
for f in apps/api/scripts/seed-finance-accounts.ts packages/database/get_admin_id.ts packages/database/scripts/test-database.ts; do
  if ! grep -q "eslint-disable no-console" "$f" 2>/dev/null; then
    sed -i '' '1i\
/* eslint-disable no-console */
' "$f" 2>/dev/null
  fi
done

echo ""
echo "=== Script-based fixes complete ==="
