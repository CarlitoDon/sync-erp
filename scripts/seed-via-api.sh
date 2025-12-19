#!/bin/bash

# =============================================================================
# Sync ERP - API-Based Seeder Script
# =============================================================================
# This script seeds demo data through the API endpoints instead of direct DB
# inserts, ensuring all business logic (sagas, journal entries, balance updates)
# are properly executed.
#
# Prerequisites:
# 1. API running on localhost:3000
# 2. Run `npx prisma db seed` first to create base data (user, company, accounts, products, partners)
# 3. Login manually or use this script
#
# Usage: ./seed-via-api.sh
# =============================================================================

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3001/api}"
COMPANY_ID="${COMPANY_ID:-demo-company-001}"
SESSION_COOKIE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Step 1: Login
# =============================================================================
login() {
  log_info "Logging in as admin@sync-erp.local..."
  
  RESPONSE=$(curl -s -c cookies.txt -b cookies.txt \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@sync-erp.local","password":"password"}' \
    "${API_URL}/auth/login")
  
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
  
  if [ "$SUCCESS" = "true" ]; then
    log_success "Login successful"
  else
    log_error "Login failed: $RESPONSE"
    exit 1
  fi
}

# =============================================================================
# Helper: API Call with auth
# =============================================================================
api_call() {
  METHOD="$1"
  ENDPOINT="$2"
  DATA="$3"
  
  if [ -n "$DATA" ]; then
    curl -s -b cookies.txt \
      -H "Content-Type: application/json" \
      -H "X-Company-Id: ${COMPANY_ID}" \
      -X "$METHOD" \
      -d "$DATA" \
      "${API_URL}${ENDPOINT}"
  else
    curl -s -b cookies.txt \
      -H "Content-Type: application/json" \
      -H "X-Company-Id: ${COMPANY_ID}" \
      -X "$METHOD" \
      "${API_URL}${ENDPOINT}"
  fi
}

# =============================================================================
# Step 2: Get Partners
# =============================================================================
get_partner_id() {
  PARTNER_NAME="$1"
  RESPONSE=$(api_call "GET" "/partners?search=${PARTNER_NAME}")
  echo "$RESPONSE" | jq -r '.data[0].id // empty'
}

get_product_id() {
  SKU="$1"
  RESPONSE=$(api_call "GET" "/products?search=${SKU}")
  echo "$RESPONSE" | jq -r '.data[0].id // empty'
}

# =============================================================================
# Step 3: Create and Process Purchase Order Flow
# =============================================================================
create_purchase_order_flow() {
  log_info "Creating Purchase Order flow..."
  
  SUPPLIER_ID=$(get_partner_id "Component")
  PRODUCT_ID=$(get_product_id "LAP-001")
  
  if [ -z "$SUPPLIER_ID" ] || [ -z "$PRODUCT_ID" ]; then
    log_error "Could not find supplier or product"
    return 1
  fi
  
  # 1. Create PO
  log_info "  → Creating PO..."
  PO_RESPONSE=$(api_call "POST" "/purchase-orders" "{
    \"partnerId\": \"${SUPPLIER_ID}\",
    \"date\": \"$(date +%Y-%m-%d)\",
    \"items\": [
      {\"productId\": \"${PRODUCT_ID}\", \"quantity\": 5, \"price\": 12000000}
    ]
  }")
  
  PO_ID=$(echo "$PO_RESPONSE" | jq -r '.data.id // empty')
  if [ -z "$PO_ID" ]; then
    log_error "Failed to create PO: $PO_RESPONSE"
    return 1
  fi
  log_success "  PO Created: $PO_ID"
  
  # 2. Confirm PO
  log_info "  → Confirming PO..."
  api_call "POST" "/purchase-orders/${PO_ID}/confirm" > /dev/null
  log_success "  PO Confirmed"
  
  # 3. Receive Goods (GRN)
  log_info "  → Receiving goods..."
  GRN_RESPONSE=$(api_call "POST" "/inventory/goods-receipt" "{
    \"orderId\": \"${PO_ID}\",
    \"reference\": \"GRN-$(date +%Y%m%d)-${PO_ID}\"
  }")
  
  if echo "$GRN_RESPONSE" | grep -q "error"; then
     log_error "Failed to receive goods: $GRN_RESPONSE"
     return 1
  fi
  
  log_success "  Goods Received"
  
  # 4. Create Bill
  log_info "  → Creating Bill..."
  BILL_RESPONSE=$(api_call "POST" "/bills" "{
    \"orderId\": \"${PO_ID}\"
  }")
  BILL_ID=$(echo "$BILL_RESPONSE" | jq -r '.data.id // empty')
  if [ -z "$BILL_ID" ]; then
    log_warn "Failed to create Bill: $BILL_RESPONSE"
    return 1
  fi
  log_success "  Bill Created: $BILL_ID"
  
  # 5. Post Bill
  log_info "  → Posting Bill..."
  api_call "POST" "/bills/${BILL_ID}/post" > /dev/null
  log_success "  Bill Posted (AP recorded)"
  
  # 6. Record partial payment
  log_info "  → Recording partial payment..."
  api_call "POST" "/payments" "{
    \"invoiceId\": \"${BILL_ID}\",
    \"amount\": 30000000,
    \"method\": \"BANK_TRANSFER\",
    \"date\": \"$(date +%Y-%m-%d)\"
  }" > /dev/null
  log_success "  Payment of 30,000,000 recorded"
  
  echo "$PO_ID"
}

# =============================================================================
# Step 4: Create and Process Sales Order Flow
# =============================================================================
create_sales_order_flow() {
  log_info "Creating Sales Order flow..."
  
  CUSTOMER_ID=$(get_partner_id "Adi")
  PRODUCT_ID=$(get_product_id "LAP-001")
  
  if [ -z "$CUSTOMER_ID" ] || [ -z "$PRODUCT_ID" ]; then
    log_error "Could not find customer or product"
    return 1
  fi
  
  # 1. Create SO
  log_info "  → Creating SO..."
  SO_RESPONSE=$(api_call "POST" "/sales-orders" "{
    \"partnerId\": \"${CUSTOMER_ID}\",
    \"date\": \"$(date +%Y-%m-%d)\",
    \"items\": [
      {\"productId\": \"${PRODUCT_ID}\", \"quantity\": 2, \"price\": 15000000}
    ]
  }")
  
  SO_ID=$(echo "$SO_RESPONSE" | jq -r '.data.id // empty')
  if [ -z "$SO_ID" ]; then
    log_error "Failed to create SO: $SO_RESPONSE"
    return 1
  fi
  log_success "  SO Created: $SO_ID"
  
  # 2. Confirm SO
  log_info "  → Confirming SO..."
  api_call "POST" "/sales-orders/${SO_ID}/confirm" > /dev/null
  log_success "  SO Confirmed"
  
  # 3. Create Invoice
  log_info "  → Creating Invoice..."
  INV_RESPONSE=$(api_call "POST" "/invoices" "{
    \"orderId\": \"${SO_ID}\"
  }")
  INV_ID=$(echo "$INV_RESPONSE" | jq -r '.data.id // empty')
  if [ -z "$INV_ID" ]; then
    log_error "Failed to create Invoice: $INV_RESPONSE"
    return 1
  fi
  log_success "  Invoice Created: $INV_ID"
  
  # 4. Post Invoice (this triggers the Saga!)
  log_info "  → Posting Invoice (triggers AR + COGS + Inventory Journal)..."
  api_call "POST" "/invoices/${INV_ID}/post" > /dev/null
  log_success "  Invoice Posted (AR recorded, COGS booked)"
  
  # 5. Record full payment
  log_info "  → Recording full payment..."
  api_call "POST" "/payments" "{
    \"invoiceId\": \"${INV_ID}\",
    \"amount\": 30000000,
    \"method\": \"BANK_TRANSFER\",
    \"date\": \"$(date +%Y-%m-%d)\"
  }" > /dev/null
  log_success "  Payment of 30,000,000 recorded - Invoice PAID"
  
  echo "$SO_ID"
}

# =============================================================================
# Step 5: Create another SO with partial payment
# =============================================================================
create_outstanding_invoice() {
  log_info "Creating outstanding invoice (partial payment)..."
  
  CUSTOMER_ID=$(get_partner_id "Maju")
  PRODUCT_ID=$(get_product_id "MON-001")
  
  if [ -z "$CUSTOMER_ID" ] || [ -z "$PRODUCT_ID" ]; then
    CUSTOMER_ID=$(get_partner_id "Budi")
  fi
  
  if [ -z "$CUSTOMER_ID" ] || [ -z "$PRODUCT_ID" ]; then
    log_warn "Could not find customer or product for outstanding invoice"
    return 0
  fi
  
  # 1. Create SO  
  SO_RESPONSE=$(api_call "POST" "/sales-orders" "{
    \"partnerId\": \"${CUSTOMER_ID}\",
    \"date\": \"$(date +%Y-%m-%d)\",
    \"items\": [
      {\"productId\": \"${PRODUCT_ID}\", \"quantity\": 3, \"price\": 2500000}
    ]
  }")
  
  SO_ID=$(echo "$SO_RESPONSE" | jq -r '.data.id // empty')
  if [ -z "$SO_ID" ]; then
    log_warn "Failed to create SO for outstanding invoice"
    return 0
  fi
  
  # 2. Confirm
  api_call "POST" "/sales-orders/${SO_ID}/confirm" > /dev/null
  
  # 3. Create Invoice
  INV_RESPONSE=$(api_call "POST" "/invoices" "{
    \"orderId\": \"${SO_ID}\"
  }")
  INV_ID=$(echo "$INV_RESPONSE" | jq -r '.data.id // empty')
  
  if [ -z "$INV_ID" ]; then
    log_warn "Failed to create outstanding Invoice: $INV_RESPONSE"
    return 0
  fi
  
  # 4. Post Invoice
  api_call "POST" "/invoices/${INV_ID}/post" > /dev/null
  
  # 5. Record partial payment (50%)
  api_call "POST" "/payments" "{
    \"invoiceId\": \"${INV_ID}\",
    \"amount\": 3750000,
    \"method\": \"CASH\",
    \"date\": \"$(date +%Y-%m-%d)\"
  }" > /dev/null
  
  log_success "  Outstanding Invoice created with 50% payment (3,750,000 balance)"
}

# =============================================================================
# Main
# =============================================================================
main() {
  echo ""
  echo "=============================================="
  echo "  Sync ERP - API-Based Data Seeder"
  echo "=============================================="
  echo ""
  
  # Clean up old cookies
  rm -f cookies.txt
  
  # Step 1: Login
  login
  
  echo ""
  
  # Step 2: Create Purchase flow
  create_purchase_order_flow
  
  echo ""
  
  # Step 3: Create Sales flow (full payment)
  create_sales_order_flow
  
  echo ""
  
  # Step 4: Create outstanding invoice
  create_outstanding_invoice
  
  echo ""
  echo "=============================================="
  log_success "API Seeding Complete!"
  echo "=============================================="
  echo ""
  echo "You should now see:"
  echo "  - Posted Bill with 30M paid, 30M outstanding (AP)"
  echo "  - Paid Invoice with 30M received (AR cleared)"
  echo "  - Outstanding Invoice with 3.75M balance (AR)"
  echo "  - Journal entries for all transactions"
  echo "  - Inventory movements and updated stock"
  echo ""
  
  # Cleanup
  rm -f cookies.txt
}

main "$@"
