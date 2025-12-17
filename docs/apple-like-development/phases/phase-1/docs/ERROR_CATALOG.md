# Phase 1: Error Catalog

Mengakhiri `throw new Error("something wrong")`.

**Rule**: Semua error yang muncul ke user **harus ada di sini**.

---

## Invoice Errors

### INVOICE_NOT_FOUND

- **HTTP**: 404
- **User Message**: "Invoice not found"
- **Retryable**: false
- **Compensated**: N/A

### INVOICE_ALREADY_POSTED

- **HTTP**: 409
- **User Message**: "Invoice has already been posted"
- **Retryable**: false
- **Compensated**: N/A

### INVOICE_INVALID_STATE

- **HTTP**: 422
- **User Message**: "Invoice is not in the correct state for this action"
- **Retryable**: false
- **Compensated**: N/A

### INVOICE_NO_ITEMS

- **HTTP**: 422
- **User Message**: "Invoice must have at least one item"
- **Retryable**: false
- **Compensated**: N/A

---

## Bill Errors

### BILL_NOT_FOUND

- **HTTP**: 404
- **User Message**: "Bill not found"
- **Retryable**: false
- **Compensated**: N/A

### BILL_ALREADY_POSTED

- **HTTP**: 409
- **User Message**: "Bill has already been posted"
- **Retryable**: false
- **Compensated**: N/A

### BILL_INVALID_STATE

- **HTTP**: 422
- **User Message**: "Bill is not in the correct state for this action"
- **Retryable**: false
- **Compensated**: N/A

---

## Payment Errors

### PAYMENT_OVERPAYMENT

- **HTTP**: 409
- **User Message**: "Payment exceeds remaining balance"
- **Retryable**: false
- **Compensated**: true

### PAYMENT_INVALID_AMOUNT

- **HTTP**: 422
- **User Message**: "Payment amount must be greater than zero"
- **Retryable**: false
- **Compensated**: N/A

### PAYMENT_INVOICE_NOT_POSTED

- **HTTP**: 422
- **User Message**: "Cannot pay an invoice that is not posted"
- **Retryable**: false
- **Compensated**: N/A

---

## Stock Errors

### INSUFFICIENT_STOCK

- **HTTP**: 422
- **User Message**: "Insufficient stock for this operation"
- **Retryable**: false
- **Compensated**: true

### PRODUCT_NOT_FOUND

- **HTTP**: 404
- **User Message**: "Product not found"
- **Retryable**: false
- **Compensated**: N/A

### WAREHOUSE_NOT_FOUND

- **HTTP**: 404
- **User Message**: "Warehouse not found"
- **Retryable**: false
- **Compensated**: N/A

---

## Partner Errors

### PARTNER_NOT_FOUND

- **HTTP**: 404
- **User Message**: "Partner not found"
- **Retryable**: false
- **Compensated**: N/A

### PARTNER_WRONG_TYPE

- **HTTP**: 422
- **User Message**: "Partner type does not match required type"
- **Retryable**: false
- **Compensated**: N/A

---

## Saga Errors

### SAGA_FAILED

- **HTTP**: 500
- **User Message**: "Operation failed and has been rolled back"
- **Retryable**: true (with new idempotency key)
- **Compensated**: true

### SAGA_COMPENSATION_FAILED

- **HTTP**: 500
- **User Message**: "Operation failed and requires manual intervention"
- **Retryable**: false
- **Compensated**: false (needs admin)

---

## System Errors

### COMPANY_PENDING

- **HTTP**: 403
- **User Message**: "Company is pending setup and cannot perform this action"
- **Retryable**: false
- **Compensated**: N/A

### PARALLEL_MUTATION_BLOCKED

- **HTTP**: 409
- **User Message**: "This record is currently being modified. Please try again."
- **Retryable**: true
- **Compensated**: N/A

### IDEMPOTENCY_CONFLICT

- **HTTP**: 409
- **User Message**: "This operation has already been processed"
- **Retryable**: false
- **Compensated**: N/A

---

_Document required before Phase 1 work proceeds._
