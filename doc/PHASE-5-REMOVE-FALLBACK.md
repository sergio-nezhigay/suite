# Phase 5: Remove Fallback Logic (Read Only from bankTransaction)

**PR Title:** `refactor: Remove orderPaymentMatch fallback, read only from bankTransaction`

**Branch:** `phase-5/remove-fallback`

---

## Overview

This phase removes all fallback logic to `orderPaymentMatch` and reads exclusively from `bankTransaction`. After Phase 4, no new data is written to the old model, so we can simplify read operations.

### Goals

- Read exclusively from `bankTransaction`
- Remove all fallback queries to `orderPaymentMatch`
- Simplify code by removing dual-read complexity
- Prepare for complete removal of old model

### Risk Level

**MEDIUM** - Old data becomes invisible, but should already be handled

---

## Important Warning

⚠️ **CRITICAL:** After this phase, historical data in `orderPaymentMatch` will NOT be readable by the application code. Ensure:

1. All critical historical data has been reviewed
2. Any reporting/analytics can handle missing old data
3. Stakeholders are aware old checks won't show in UI
4. Database backups are current

If old data visibility is required, consider:

- Manually migrating critical records before Phase 5
- Keeping fallback logic permanently
- Implementing a "legacy data view" feature

---

## Changes Required

### Files to Modify

1. `api/actions/getUncoveredPayments.ts` - Remove orderPaymentMatch queries
2. `api/actions/previewCheckForPayment.ts` - Remove orderPaymentMatch fallback
3. `api/actions/verifyOrderPayments.ts` - Remove orderPaymentMatch fallback (2 locations)

---

## Implementation Details

### 1. Update `getUncoveredPayments.ts`

**Phase 3 Code (Remove all orderPaymentMatch logic):**

```typescript
// For each filtered transaction, check if it has a check (prefer bankTransaction, fallback to orderPaymentMatch)
const uncoveredPayments = [];

// First, fetch payment matches for fallback (old data)
const transactionIds = filteredTransactions.map((t) => t.id);
const allPaymentMatches = await api.orderPaymentMatch.findMany({
  filter: {
    bankTransactionId: { in: transactionIds },
  },
  select: {
    id: true,
    bankTransactionId: true,
    checkIssued: true,
    checkSkipped: true,
    checkReceiptId: true,
    orderId: true,
  },
  first: 250,
});

// Build a Map for quick lookups: bankTransactionId -> paymentMatch
const paymentMatchMap = new Map();
for (const match of allPaymentMatches) {
  paymentMatchMap.set(match.bankTransactionId, match);
}

console.log(
  '[getUncoveredPayments] Found payment matches (fallback):',
  allPaymentMatches.length
);

for (const transaction of filteredTransactions) {
  // PREFER: Check bankTransaction fields first (new data)
  const hasCheckInTransaction =
    transaction.checkReceiptId || transaction.checkIssuedAt;
  const hasSkipInTransaction = transaction.checkSkipReason;

  // FALLBACK: Check orderPaymentMatch (old data)
  const paymentMatch = paymentMatchMap.get(transaction.id);
  const hasCheckInMatch = paymentMatch && paymentMatch.checkIssued;
  const hasSkipInMatch = paymentMatch && paymentMatch.checkSkipped;

  // Determine if payment needs check
  const hasCheck = hasCheckInTransaction || hasCheckInMatch;
  const isSkipped = hasSkipInTransaction || hasSkipInMatch;

  // Only include if no check and not skipped
  const shouldInclude = !hasCheck && !isSkipped;

  if (shouldInclude) {
    uncoveredPayments.push({
      // ... existing fields
    });
  } else {
    console.log(
      `[getUncoveredPayments] Skipping transaction ${transaction.id}: ` +
        `hasCheck=${hasCheck} (txn=${hasCheckInTransaction}, match=${hasCheckInMatch}), ` +
        `isSkipped=${isSkipped} (txn=${hasSkipInTransaction}, match=${hasSkipInMatch})`
    );
  }
}
```

**Phase 5 Code (Simplified - bankTransaction only):**

```typescript
// Check each transaction using only bankTransaction fields
const uncoveredPayments = [];

for (const transaction of filteredTransactions) {
  // Check if payment has a check or is skipped (using bankTransaction fields only)
  const hasCheck = !!transaction.checkReceiptId || !!transaction.checkIssuedAt;
  const isSkipped = !!transaction.checkSkipReason;

  // Only include if no check and not skipped
  if (!hasCheck && !isSkipped) {
    uncoveredPayments.push({
      id: transaction.id,
      date: new Date(transaction.transactionDateTime).toLocaleDateString(
        'en-US'
      ),
      amount: transaction.amount,
      counterpartyName: transaction.counterpartyName || 'Unknown',
      accountCode:
        extractPaymentCodeFromAccount(transaction.counterpartyAccount || '') ||
        'N/A',
      daysAgo: Math.floor(
        (Date.now() - new Date(transaction.transactionDateTime).getTime()) /
          (24 * 60 * 60 * 1000)
      ),
      transactionId: transaction.id,
    });
  } else {
    console.log(
      `[getUncoveredPayments] Skipping transaction ${transaction.id}: ` +
        `hasCheck=${hasCheck}, isSkipped=${isSkipped}`
    );
  }
}

console.log(
  '[getUncoveredPayments] Found uncovered payments:',
  uncoveredPayments.length
);
```

---

### 2. Update `previewCheckForPayment.ts`

**Phase 3 Code (Remove fallback):**

```typescript
// Fetch the bank transaction (prefer checking here first)
const bankTransaction = await api.bankTransaction.findFirst({
  filter: { id: { equals: transactionId } },
  select: {
    id: true,
    amount: true,
    counterpartyAccount: true,
    // NEW: Include payment matching fields
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
});

if (!bankTransaction) {
  return {
    success: false,
    error: 'Transaction not found',
  };
}

// PREFER: Check bankTransaction first (new data)
let checkAlreadyIssued = false;
let receiptId = bankTransaction.checkReceiptId;
let issuedAt = bankTransaction.checkIssuedAt;

if (receiptId || issuedAt) {
  checkAlreadyIssued = true;
  console.log(
    '[previewCheckForPayment] Check already issued (from bankTransaction):',
    transactionId
  );
}

// FALLBACK: Check orderPaymentMatch (old data)
if (!checkAlreadyIssued) {
  const existingMatch = await api.orderPaymentMatch.findFirst({
    filter: { bankTransactionId: { equals: transactionId } },
    select: {
      checkIssued: true,
      checkIssuedAt: true,
      checkReceiptId: true,
    },
  });

  if (existingMatch?.checkIssued) {
    checkAlreadyIssued = true;
    receiptId = existingMatch.checkReceiptId;
    issuedAt = existingMatch.checkIssuedAt;
    console.log(
      '[previewCheckForPayment] Check already issued (from orderPaymentMatch):',
      transactionId
    );
  }
}

if (checkAlreadyIssued) {
  return {
    success: false,
    error: 'Check already issued for this transaction',
    receiptId: receiptId,
    issuedAt: issuedAt,
  };
}
```

**Phase 5 Code (Simplified - bankTransaction only):**

```typescript
// Fetch the bank transaction
const bankTransaction = await api.bankTransaction.findFirst({
  filter: { id: { equals: transactionId } },
  select: {
    id: true,
    amount: true,
    counterpartyAccount: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
});

if (!bankTransaction) {
  return {
    success: false,
    error: 'Transaction not found',
  };
}

// Check if check already issued (using bankTransaction only)
if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
  console.log(
    '[previewCheckForPayment] Check already issued for transaction:',
    transactionId,
    'Receipt ID:',
    bankTransaction.checkReceiptId
  );
  return {
    success: false,
    error: 'Check already issued for this transaction',
    receiptId: bankTransaction.checkReceiptId,
    issuedAt: bankTransaction.checkIssuedAt,
  };
}

// Continue with preview generation...
```

---

### 3. Update `verifyOrderPayments.ts`

This file has TWO locations with fallback logic to remove.

#### Location 1: Inside `createAutomaticCheck` function

**Phase 3 Code (Remove entire fallback section):**

```typescript
// Get the payment match to find the bank transaction
const paymentMatch = await api.orderPaymentMatch.findFirst({
  filter: { orderId: { equals: order.id } },
  select: {
    id: true,
    bankTransactionId: true,
    checkIssued: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkFiscalCode: true,
    checkSkipped: true,
    checkSkipReason: true,
  },
});

if (!paymentMatch) {
  return {
    success: false,
    skipped: true,
    reason: 'No payment match found',
  };
}

// Fetch bank transaction to check new fields
const bankTransaction = await api.bankTransaction.findFirst({
  filter: { id: { equals: paymentMatch.bankTransactionId } },
  select: {
    id: true,
    counterpartyAccount: true,
    counterpartyName: true,
    // NEW: Include payment matching fields
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
});

if (!bankTransaction) {
  return {
    success: false,
    skipped: true,
    reason: 'Bank transaction not found',
  };
}

// PREFER: Check bankTransaction first (new data)
let checkIssued = false;
let checkIssuedAt = null;
let checkReceiptId = null;
let checkSkipped = false;
let checkSkipReason = null;

if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
  checkIssued = true;
  checkIssuedAt = bankTransaction.checkIssuedAt;
  checkReceiptId = bankTransaction.checkReceiptId;
  console.log(
    '[createAutomaticCheck] Check status from bankTransaction (new data)'
  );
}

if (bankTransaction.checkSkipReason) {
  checkSkipped = true;
  checkSkipReason = bankTransaction.checkSkipReason;
  console.log(
    '[createAutomaticCheck] Skip status from bankTransaction (new data)'
  );
}

// FALLBACK: Check orderPaymentMatch (old data)
if (!checkIssued && paymentMatch.checkIssued) {
  checkIssued = true;
  checkIssuedAt = paymentMatch.checkIssuedAt;
  checkReceiptId = paymentMatch.checkReceiptId;
  console.log(
    '[createAutomaticCheck] Check status from orderPaymentMatch (old data)'
  );
}

if (!checkSkipped && paymentMatch.checkSkipped) {
  checkSkipped = true;
  checkSkipReason = paymentMatch.checkSkipReason;
  console.log(
    '[createAutomaticCheck] Skip status from orderPaymentMatch (old data)'
  );
}

console.log(`[createAutomaticCheck] Payment match for order ${order.name}:`, {
  found: !!paymentMatch,
  checkIssued: checkIssued,
  checkSkipped: checkSkipped,
  checkReceiptId: checkReceiptId,
});

// Check if check already issued
if (checkIssued) {
  // ...
}

// Check if check was previously skipped
if (checkSkipped) {
  // ...
}
```

**Phase 5 Code (Simplified - bankTransaction only):**

```typescript
// Find the bank transaction matched to this order
const bankTransaction = await api.bankTransaction.findFirst({
  filter: { matchedOrderId: { equals: order.id } },
  select: {
    id: true,
    counterpartyAccount: true,
    counterpartyName: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
});

if (!bankTransaction) {
  console.log(
    `[createAutomaticCheck] No matched bank transaction found for order ${order.name}`
  );
  return {
    success: false,
    skipped: true,
    reason: 'No matched bank transaction found',
  };
}

console.log(
  `[createAutomaticCheck] Found bank transaction for order ${order.name}:`,
  {
    transactionId: bankTransaction.id,
    hasCheck: !!(
      bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt
    ),
    isSkipped: !!bankTransaction.checkSkipReason,
  }
);

// Check if check already issued
if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
  console.log(
    `[createAutomaticCheck] Skipping: Check already issued for order ${order.name} at ${bankTransaction.checkIssuedAt}`
  );
  return {
    success: false,
    skipped: true,
    reason: `Check already issued for this payment (Receipt ID: ${
      bankTransaction.checkReceiptId || 'N/A'
    })`,
  };
}

// Check if check was previously skipped
if (bankTransaction.checkSkipReason) {
  console.log(
    `[createAutomaticCheck] Skipping: Check previously skipped for order ${order.name}: ${bankTransaction.checkSkipReason}`
  );
  return {
    success: false,
    skipped: true,
    reason: bankTransaction.checkSkipReason,
  };
}

// Continue with check creation...
// Note: bankTransaction.id replaces paymentMatch.bankTransactionId in subsequent code
```

**Important:** Update all references from `paymentMatch.bankTransactionId` to `bankTransaction.id` in the rest of the function.

#### Location 2: After order verification (fetch check info)

**Phase 3 Code (Remove fallback):**

```typescript
// Fetch check information for newly verified orders (prefer bankTransaction, fallback to orderPaymentMatch)
let checkInfo = {
  checkIssued: false,
  checkIssuedAt: null,
  checkReceiptId: null,
  checkFiscalCode: null,
  checkReceiptUrl: null,
  checkSkipped: false,
  checkSkipReason: null,
};

if (matches.length > 0) {
  try {
    // Find the payment match to get the bank transaction ID
    const paymentMatch = await api.orderPaymentMatch.findFirst({
      filter: { orderId: { equals: order.id } },
      select: {
        bankTransactionId: true,
        checkIssued: true,
        checkIssuedAt: true,
        checkReceiptId: true,
        checkFiscalCode: true,
        checkReceiptUrl: true,
        checkSkipped: true,
        checkSkipReason: true,
      },
    });

    if (paymentMatch) {
      // PREFER: Check bankTransaction first (new data)
      const bankTransaction = await api.bankTransaction.findFirst({
        filter: { id: { equals: paymentMatch.bankTransactionId } },
        select: {
          checkIssuedAt: true,
          checkReceiptId: true,
          checkSkipReason: true,
        },
      });

      if (bankTransaction) {
        const hasCheckInTransaction =
          bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt;

        if (hasCheckInTransaction) {
          checkInfo.checkIssued = true;
          checkInfo.checkIssuedAt = bankTransaction.checkIssuedAt;
          checkInfo.checkReceiptId = bankTransaction.checkReceiptId;
          // Note: fiscal code and receipt URL only in orderPaymentMatch for now
          checkInfo.checkFiscalCode = paymentMatch.checkFiscalCode;
          checkInfo.checkReceiptUrl = paymentMatch.checkReceiptUrl;
          console.log(
            `[verifyOrderPayments] Check info from bankTransaction (new data) for order ${order.id}`
          );
        }

        if (bankTransaction.checkSkipReason) {
          checkInfo.checkSkipped = true;
          checkInfo.checkSkipReason = bankTransaction.checkSkipReason;
        }
      }

      // FALLBACK: Use orderPaymentMatch if bankTransaction doesn't have data (old data)
      if (!checkInfo.checkIssued && paymentMatch.checkIssued) {
        checkInfo = {
          checkIssued: paymentMatch.checkIssued,
          checkIssuedAt: paymentMatch.checkIssuedAt,
          checkReceiptId: paymentMatch.checkReceiptId,
          checkFiscalCode: paymentMatch.checkFiscalCode,
          checkReceiptUrl: paymentMatch.checkReceiptUrl,
          checkSkipped: paymentMatch.checkSkipped,
          checkSkipReason: paymentMatch.checkSkipReason,
        };
        console.log(
          `[verifyOrderPayments] Check info from orderPaymentMatch (old data) for order ${order.id}`
        );
      }
    }
  } catch (err) {
    console.error(`Error fetching check info for order ${order.id}:`, err);
  }
}
```

**Phase 5 Code (Simplified - bankTransaction only):**

```typescript
// Fetch check information for newly verified orders (from bankTransaction only)
let checkInfo = {
  checkIssued: false,
  checkIssuedAt: null,
  checkReceiptId: null,
  checkSkipped: false,
  checkSkipReason: null,
};

if (matches.length > 0) {
  try {
    // Find the bank transaction matched to this order
    const bankTransaction = await api.bankTransaction.findFirst({
      filter: { matchedOrderId: { equals: order.id } },
      select: {
        id: true,
        checkIssuedAt: true,
        checkReceiptId: true,
        checkSkipReason: true,
      },
    });

    if (bankTransaction) {
      // Check if check issued
      if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
        checkInfo.checkIssued = true;
        checkInfo.checkIssuedAt = bankTransaction.checkIssuedAt;
        checkInfo.checkReceiptId = bankTransaction.checkReceiptId;
        console.log(
          `[verifyOrderPayments] Check issued for order ${order.id}: ${bankTransaction.checkReceiptId}`
        );
      }

      // Check if skipped
      if (bankTransaction.checkSkipReason) {
        checkInfo.checkSkipped = true;
        checkInfo.checkSkipReason = bankTransaction.checkSkipReason;
        console.log(
          `[verifyOrderPayments] Check skipped for order ${order.id}: ${bankTransaction.checkSkipReason}`
        );
      }
    } else {
      console.log(
        `[verifyOrderPayments] No bank transaction found for order ${order.id}`
      );
    }
  } catch (err) {
    console.error(`Error fetching check info for order ${order.id}:`, err);
  }
}
```

**Note:** `checkFiscalCode` and `checkReceiptUrl` are removed from response since they're not in `bankTransaction` schema. These were rarely used and can be retrieved from Checkbox API if needed.

---

### 4. Update `issueCheckForPayment.ts`

**Phase 4 already removed most orderPaymentMatch logic, but there's still a fallback check:**

**Phase 4 Code (Has fallback):**

```typescript
// Check if check already issued (new data)
let checkAlreadyIssued = false;
let receiptId = bankTransaction.checkReceiptId;
let issuedAt = bankTransaction.checkIssuedAt;

if (receiptId || issuedAt) {
  checkAlreadyIssued = true;
  console.log(
    '[issueCheckForPayment] Check already issued (from bankTransaction)'
  );
}

// FALLBACK: Check orderPaymentMatch for old data
if (!checkAlreadyIssued) {
  const paymentMatch = await api.orderPaymentMatch.findFirst({
    filter: { bankTransactionId: { equals: transactionId } },
    select: {
      checkIssued: true,
      checkIssuedAt: true,
      checkReceiptId: true,
      checkFiscalCode: true,
      checkReceiptUrl: true,
    },
  });

  if (paymentMatch?.checkIssued) {
    checkAlreadyIssued = true;
    receiptId = paymentMatch.checkReceiptId;
    issuedAt = paymentMatch.checkIssuedAt;
    console.log(
      '[issueCheckForPayment] Check already issued (from orderPaymentMatch - old data)'
    );
  }
}

if (checkAlreadyIssued) {
  return {
    success: false,
    error: 'Check already issued for this transaction',
    receiptId: receiptId,
    issuedAt: issuedAt,
  };
}
```

**Phase 5 Code (Remove fallback):**

```typescript
// Check if check already issued (using bankTransaction only)
if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
  console.log(
    '[issueCheckForPayment] Check already issued for this transaction:',
    transactionId,
    'Receipt ID:',
    bankTransaction.checkReceiptId
  );
  return {
    success: false,
    error: 'Check already issued for this transaction',
    receiptId: bankTransaction.checkReceiptId,
    issuedAt: bankTransaction.checkIssuedAt,
  };
}

// Continue with check issuance...
```

---

## Testing Checklist

### Functional Testing

#### Test 1: Get Uncovered Payments

- [ ] Navigate to payments page
- [ ] Verify only recent uncovered payments shown
- [ ] Verify payments with checks excluded
- [ ] Old payments with checks WILL NOT appear (expected)

#### Test 2: Preview Check

- [ ] Preview check for new uncovered payment
- [ ] Verify preview shows correctly
- [ ] Try to preview for payment with check (should reject)

#### Test 3: Issue Check

- [ ] Issue check manually from payments page
- [ ] Verify check created successfully
- [ ] Verify payment disappears from uncovered list

#### Test 4: Automatic Check Creation

- [ ] Verify payment with auto-check enabled
- [ ] Verify check issued automatically
- [ ] Verify order updated correctly

#### Test 5: Verify Skip Logic

- [ ] Verify payment with excluded code
- [ ] Verify skip reason recorded in bankTransaction
- [ ] Verify payment doesn't appear in uncovered list

### Data Validation

#### Test 6: Verify No orderPaymentMatch Queries

```typescript
// Monitor API calls - should see NO queries to orderPaymentMatch
// Can use Gadget logs or add temporary logging

// Before:
console.log('[TEST] Starting getUncoveredPayments');

// Run action

// After:
console.log('[TEST] Completed - check logs for orderPaymentMatch queries');
// Should see NONE
```

#### Test 7: Verify All Data from bankTransaction

```typescript
// All reads should come from bankTransaction only
const payments = await api.getUncoveredPayments();

// Check logs - should see only bankTransaction queries
// No "old data" or "fallback" messages
```

### Historical Data Testing

#### Test 8: Old Orders (Expected Behavior)

- [ ] Query order verified before Phase 4
- [ ] Check info WILL NOT display (expected)
- [ ] No errors (gracefully handles missing data)
- [ ] UI shows "No check information available" (or similar)

**Note:** This is expected behavior after Phase 5. Old check data is no longer accessible via API.

### Edge Cases

- [ ] Order with no bank transaction match (should handle gracefully)
- [ ] Transaction with check but no order match (should still filter from uncovered)
- [ ] Multiple verifications of same order (should work correctly)

---

## Rollback Plan

### If Critical Issues

**Step 1:** Revert to Phase 3 (dual-read with fallback)

```powershell
git revert HEAD
git push
```

**Step 2:** Verify fallback restored

```typescript
// Test that old data is readable again
const oldOrder = await api.shopifyOrder.findFirst({
  filter: {
    // Find order verified before Phase 4
  },
});

// Run verifyOrderPayments or similar
// Check logs for "from orderPaymentMatch (old data)" messages
// Should see fallback working
```

**Step 3:** If old data visibility is critical

- Consider keeping Phase 3 permanently
- OR implement one-time historical data migration
- OR create separate "legacy data view" feature

---

## Success Criteria

- ✅ No queries to `orderPaymentMatch`
- ✅ All reads from `bankTransaction` only
- ✅ Uncovered payments list works correctly
- ✅ Check issuance works (manual + automatic)
- ✅ Verification works for new orders
- ✅ No errors in production logs
- ✅ Code simplified (fallback logic removed)

---

## Monitoring

### After Deployment

Track:

1. **orderPaymentMatch query count** - Should be ZERO
2. **Missing data errors** - Should be none for recent data
3. **User complaints** - About missing old check information
4. **bankTransaction queries** - All reads should be here

### Key Queries

```typescript
// Verify no orderPaymentMatch reads
// Check Gadget logs for:
// - "orderPaymentMatch.findFirst"
// - "orderPaymentMatch.findMany"
// Should see NONE after Phase 5 deployment

// Verify bankTransaction reads
// Should see only:
// - "bankTransaction.findFirst"
// - "bankTransaction.findMany"
// For all payment/check related operations
```

---

## Response Model Changes

The following fields are NO LONGER returned in API responses:

From `verifyOrderPayments` results:

- `checkFiscalCode` (removed)
- `checkReceiptUrl` (removed)

These fields were rarely used and can be retrieved from Checkbox API if needed. Update any frontend code that depends on them.

---

## Next Phase

After successful deployment and validation:

- **Phase 6:** Delete `orderPaymentMatch` model completely
- See `PHASE-6-DELETE-MODEL.md`

---

## Files Changed

```
api/actions/getUncoveredPayments.ts
api/actions/previewCheckForPayment.ts
api/actions/verifyOrderPayments.ts
api/actions/issueCheckForPayment.ts
```

**Total: 4 files**

---

## Implementation Time Estimate

- **Code changes:** 1.5 hours
- **Testing:** 2 hours
- **Deployment + monitoring:** 1 hour
- **Total:** ~4.5 hours
