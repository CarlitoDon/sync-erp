# API Contract: Cash and Bank

**Feature**: `042-cash-and-bank`
**Base URL**: `/classes/CashBank`

## 1. Bank Accounts

### List Bank Accounts

`GET /cash-bank/accounts`

**Response**:

```json
[
  {
    "id": "ba_123",
    "bankName": "BCA Corporate",
    "accountNumber": "1234567890",
    "currency": "IDR",
    "balance": 15000000, // Calculated from GL
    "account": {
      "id": "acc_1101",
      "code": "1101",
      "name": "BCA Corporate"
    }
  }
]
```

### Create Bank Account

`POST /cash-bank/accounts`

**Body**:

```json
{
  "bankName": "Petty Cash",
  "accountNumber": null,
  "currency": "IDR",
  "chartOfAccountId": "acc_1102" // Optional: Link to existing, or create new if not provided? Spec says "map". Let's assume user picks an account or we create one.
  // Actually simplest is: User creates GL Account in generic screen, then links it here. Or we create both.
  // Design Decision: Input `accountCode` + `accountName`. Service creates generic Account AND BankAccount.
  "code": "1102",
  "name": "Petty Cash"
}
```

### Update Bank Account

`PUT /cash-bank/accounts/:id`

**Body**:

```json
{
  "bankName": "Petty Cash (Main)",
  "accountNumber": "N/A"
}
```

### Archive Bank Account

`DELETE /cash-bank/accounts/:id`

## 2. Transactions

### List Transactions

`GET /cash-bank/transactions`

**Query Params**:

- `page`: number
- `limit`: number
- `type`: SPEND | RECEIVE | TRANSFER
- `accountId`: string (Filter by bank account)
- `startDate`: date
- `endDate`: date

### Create Transaction

`POST /cash-bank/transactions`

**Body (Spend/Receive)**:

```json
{
  "type": "SPEND", // or RECEIVE
  "date": "2026-01-06",
  "reference": "Receipt #123",
  "payee": "Office Depot",
  "description": "Stationery",
  "bankAccountId": "ba_123", // Source (Spend) or Dest (Receive)
  "items": [
    {
      "accountId": "acc_5100", // Office Supplies Expense
      "amount": 50000,
      "description": "Pens"
    }
  ]
}
```

**Body (Transfer)**:

```json
{
  "type": "TRANSFER",
  "date": "2026-01-06",
  "reference": "Trf to Petty",
  "description": "Top up",
  "sourceAccountId": "ba_123",
  "destinationAccountId": "ba_456",
  "amount": 1000000
}
```

### Get Transaction

`GET /cash-bank/transactions/:id`

### Update Transaction (Draft Only)

`PUT /cash-bank/transactions/:id`

### Post Transaction

`POST /cash-bank/transactions/:id/post`

**Body**: `IdempotencyKey`

### Void Transaction

`POST /cash-bank/transactions/:id/void`

**Body**:

```json
{
  "reason": "Duplicate entry"
}
```
