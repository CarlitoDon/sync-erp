# Phase 1: UI Guard Rules

Menyamakan ekspektasi frontend vs backend.

Ini **aturan UX**, bukan logika bisnis.

---

## Button States

### Invoice Actions

| Button             | Enabled When                           | Disabled When                        |
| :----------------- | :------------------------------------- | :----------------------------------- |
| **Save Draft**     | status == DRAFT                        | status != DRAFT                      |
| **Post Invoice**   | status == DRAFT && items.length > 0    | status != DRAFT OR items.length == 0 |
| **Record Payment** | status == POSTED && balance > 0        | status != POSTED OR balance == 0     |
| **Void Invoice**   | status == POSTED && user.role == ADMIN | otherwise                            |

### Bill Actions

| Button             | Enabled When                           | Disabled When                        |
| :----------------- | :------------------------------------- | :----------------------------------- |
| **Save Draft**     | status == DRAFT                        | status != DRAFT                      |
| **Post Bill**      | status == DRAFT && items.length > 0    | status != DRAFT OR items.length == 0 |
| **Record Payment** | status == POSTED && balance > 0        | status != POSTED OR balance == 0     |
| **Void Bill**      | status == POSTED && user.role == ADMIN | otherwise                            |

### Order Actions

| Button            | Enabled When                                       | Disabled When   |
| :---------------- | :------------------------------------------------- | :-------------- |
| **Save Draft**    | status == DRAFT                                    | status != DRAFT |
| **Confirm Order** | status == DRAFT && items.length > 0                | otherwise       |
| **Cancel Order**  | status in [DRAFT, CONFIRMED] && user.role == ADMIN | otherwise       |

---

## Form Field States

### Invoice Form

| Field   | Editable When   | Read-only When  |
| :------ | :-------------- | :-------------- |
| Partner | status == DRAFT | status != DRAFT |
| Items   | status == DRAFT | status != DRAFT |
| Dates   | status == DRAFT | status != DRAFT |

### Payment Form

| Field  | Validation                  |
| :----- | :-------------------------- |
| Amount | > 0 AND ≤ remaining balance |
| Method | Required selection          |

---

## Warning Messages

| Trigger                        | Message                                       |
| :----------------------------- | :-------------------------------------------- |
| Posting invoice with low stock | "Stock will be reduced after posting"         |
| Voiding posted invoice         | "This will reverse all related transactions"  |
| Large payment amount           | "Please confirm the payment amount: {amount}" |

---

## Retry Rules

| Error Type           | Retry Allowed  | User Action            |
| :------------------- | :------------- | :--------------------- |
| **5xx Server Error** | ✅ Yes         | Show "Retry" button    |
| **409 Conflict**     | ⚠️ Conditional | Refresh and retry      |
| **422 Validation**   | ❌ No          | Fix input and resubmit |
| **404 Not Found**    | ❌ No          | Navigate away          |
| **403 Forbidden**    | ❌ No          | Show permission error  |

---

## Loading States

| Action         | Loading Indicator                             |
| :------------- | :-------------------------------------------- |
| Post Invoice   | Full-screen spinner with "Posting invoice..." |
| Record Payment | Button spinner, form disabled                 |
| Save Draft     | Button spinner only                           |

---

## Confirmation Dialogs

| Action         | Requires Confirmation          |
| :------------- | :----------------------------- |
| Post Invoice   | ✅ Yes                         |
| Post Bill      | ✅ Yes                         |
| Record Payment | ✅ Yes (if amount > threshold) |
| Void Invoice   | ✅ Yes (danger dialog)         |
| Cancel Order   | ✅ Yes                         |
| Delete Draft   | ✅ Yes                         |

---

_Document required before Phase 1 work proceeds._
