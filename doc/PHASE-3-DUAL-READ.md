# Phase 3: Update Read Operations to Prefer bankTransaction

**PR Title:** `feat: Read payment data from bankTransaction with orderPaymentMatch fallback`

**Branch:** `phase-3/dual-read-with-fallback`

---

## Overview

This phase updates all read operations to prioritize reading from `bankTransaction` fields, with a fallback to `orderPaymentMatch` for historical data. This ensures new records use the consolidated model while old records remain accessible.

### Goals

- Read from `bankTransaction` first
- Fallback to `orderPaymentMatch` for historical data
- Maintain complete backward compatibility
- Prepare for eventual removal of old model

### Risk Level

**MEDIUM** - Changes read logic but maintains fallback safety net

---

## Changes Required

### Files to Modify

1. `api/actions/getUncoveredPayments.ts` - Check status lookup
2. `api/actions/previewCheckForPayment.ts` - Payment status validation
3. `api/actions/verifyOrderPayments.ts` - Check info retrieval (2 locations)
4. `web/routes/payments.tsx` - UI display (no backend changes needed yet)

---

## Implementation Details

### 1. Update `getUncoveredPayments.ts`

**Current Logic (Line ~65):**

```typescript
// Fetch all payment matches for filtered transactions in one query (much faster than loop)
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

console.log('[getUncoveredPayments] Found payment matches:', allPaymentMatches.length);

// Build a Map for quick lookups: bankTransactionId -> paymentMatch
const paymentMatchMap = new Map();
for (const match of allPaymentMatches) {
  paymentMatchMap.set(match.bankTransactionId, match);
}

// For each filtered transaction, check if it has a payment match with a check
const uncoveredPayments = [];

for (const transaction of filteredTransactions) {
  // Look up payment match from Map (much faster than API call)
  const paymentMatch = paymentMatchMap.get(transaction.id);

  // Only include if:
  // 1. No payment match exists, OR
  // 2. Payment match exists but check not issued and not skipped
  const shouldInclude =
    !paymentMatch ||
    (!paymentMatch.checkIssued && !paymentMatch.checkSkipped);
```

**New Logic with Fallback:**

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

**Updated Query to Include New Fields:**

```typescript
// Fetch all income transactions from last 7 days
const allTransactions = await api.bankTransaction.findMany({
  filter: {
    transactionDateTime: { greaterThan: sevenDaysAgo },
    type: { equals: 'income' },
  },
  select: {
    id: true,
    amount: true,
    counterpartyAccount: true,
    counterpartyName: true,
    transactionDateTime: true,
    description: true,
    externalId: true,
    // NEW: Include payment matching fields
    matchedOrderId: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
  sort: { transactionDateTime: 'Descending' },
  first: 250,
});
```

---

### 2. Update `previewCheckForPayment.ts`

**Current Logic (Line ~115):**

```typescript
// Check if check already issued for this transaction
const existingMatch = await api.orderPaymentMatch.findFirst({
  filter: { bankTransactionId: { equals: transactionId } },
  select: {
    checkIssued: true,
    checkIssuedAt: true,
    checkReceiptId: true,
  },
});

if (existingMatch?.checkIssued) {
  console.log(
    '[previewCheckForPayment] Check already issued for transaction:',
    transactionId
  );
  return {
    success: false,
    error: 'Check already issued for this transaction',
    receiptId: existingMatch.checkReceiptId,
    issuedAt: existingMatch.checkIssuedAt,
  };
}
```

**New Logic with Fallback:**

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

---

### 3. Update `verifyOrderPayments.ts`

This file reads check info in TWO locations:

#### Location 1: Inside `createAutomaticCheck` function (Line ~32)

**Current Logic:**

```typescript
// Get the bank transaction that was matched to this order
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

// ... later ...

// Check if check already issued for this payment match
if (paymentMatch?.checkIssued) {
  console.log(
    `[createAutomaticCheck] Skipping: Check already issued for order ${order.name} at ${paymentMatch.checkIssuedAt}`
  );
  return {
    success: false,
    skipped: true,
    reason: `Check already issued for this payment (Receipt ID: ${
      paymentMatch.checkReceiptId || 'N/A'
    })`,
  };
}

// Check if check was previously skipped
if (paymentMatch?.checkSkipped) {
  console.log(
    `[createAutomaticCheck] Skipping: Check previously skipped for order ${order.name}: ${paymentMatch.checkSkipReason}`
  );
  return {
    success: false,
    skipped: true,
    reason: paymentMatch.checkSkipReason || 'Check previously skipped',
  };
}
```

**New Logic with Fallback:**

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
  console.log(
    `[createAutomaticCheck] Skipping: Check already issued for order ${order.name} at ${checkIssuedAt}`
  );
  return {
    success: false,
    skipped: true,
    reason: `Check already issued for this payment (Receipt ID: ${
      checkReceiptId || 'N/A'
    })`,
  };
}

// Check if check was previously skipped
if (checkSkipped) {
  console.log(
    `[createAutomaticCheck] Skipping: Check previously skipped for order ${order.name}: ${checkSkipReason}`
  );
  return {
    success: false,
    skipped: true,
    reason: checkSkipReason || 'Check previously skipped',
  };
}

// Continue with rest of function...
// Remove the earlier "Fetch the bank transaction details" section as we already have it
```

#### Location 2: After order verification (Line ~676)

**Current Logic:**

```typescript
// Fetch check information for newly verified orders
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
    const paymentMatch = await api.orderPaymentMatch.findFirst({
      filter: { orderId: { equals: order.id } },
      select: {
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
      checkInfo = {
        checkIssued: paymentMatch.checkIssued,
        checkIssuedAt: paymentMatch.checkIssuedAt,
        checkReceiptId: paymentMatch.checkReceiptId,
        checkFiscalCode: paymentMatch.checkFiscalCode,
        checkReceiptUrl: paymentMatch.checkReceiptUrl,
        checkSkipped: paymentMatch.checkSkipped,
        checkSkipReason: paymentMatch.checkSkipReason,
      };
    }
  } catch (err) {
    console.error(`Error fetching check info for order ${order.id}:`, err);
  }
}
```

**New Logic with Fallback:**

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

---

## Testing Checklist

### Functional Testing

#### Test 1: Read New Data (Post Phase 2)

- [ ] Create new payment verification with check
- [ ] Verify data read from `bankTransaction`
- [ ] Check logs show "from bankTransaction (new data)"
- [ ] Verify UI displays correct check info

#### Test 2: Read Old Data (Pre Phase 2)

- [ ] Query old verified order
- [ ] Verify data read from `orderPaymentMatch`
- [ ] Check logs show "from orderPaymentMatch (old data)"
- [ ] Verify UI displays correct check info

#### Test 3: Uncovered Payments List

- [ ] Navigate to payments page
- [ ] Verify only uncovered payments shown
- [ ] Verify payments with checks excluded (new + old)
- [ ] Verify skipped payments excluded (new + old)

#### Test 4: Preview Check (New Data)

- [ ] Preview check for transaction with existing check (new data)
- [ ] Verify returns "already issued" error
- [ ] Verify shows correct receipt ID

#### Test 5: Preview Check (Old Data)

- [ ] Preview check for transaction with existing check (old data)
- [ ] Verify returns "already issued" error via fallback
- [ ] Verify shows correct receipt ID

#### Test 6: Automatic Check Creation

- [ ] Verify payment with auto-check enabled
- [ ] Verify reads check status correctly
- [ ] Verify doesn't duplicate if already issued

### Data Validation

#### Test 7: Compare Read Sources

```typescript
// Create test scenarios and log which source provided data
const order = await api.shopifyOrder.findFirst({
  filter: {
    /* some verified order */
  },
});

// This should log whether data came from bankTransaction or orderPaymentMatch
// Run verifyOrderPayments and check logs
```

#### Test 8: Fallback Verification

```typescript
// Manually test fallback by temporarily nullifying new fields
const transaction = await api.bankTransaction.findFirst({
  filter: { checkReceiptId: { isSet: true } },
});

// Temporarily remove checkReceiptId (in dev only!)
await api.bankTransaction.update(transaction.id, {
  checkReceiptId: null,
  checkIssuedAt: null,
});

// Verify system falls back to orderPaymentMatch
// Then restore the fields
```

### Edge Cases

- [ ] Transaction with check in both models (should prefer bankTransaction)
- [ ] Transaction with check only in orderPaymentMatch (should use fallback)
- [ ] Transaction with check only in bankTransaction (should use new data)
- [ ] Transaction with skip reason in both models (should prefer bankTransaction)
- [ ] Missing payment match (should handle gracefully)
- [ ] Missing bank transaction (should handle gracefully)

### Performance Testing

- [ ] Measure query time for uncovered payments (should be fast)
- [ ] Check number of database queries (should not increase significantly)
- [ ] Monitor API response times for affected endpoints

---

## Rollback Plan

### If Issues Detected

**Step 1:** Revert read logic

```powershell
git revert HEAD
git push
```

**Step 2:** Verify old read logic works

```typescript
// Test that reverting restores old functionality
const payments = await api.getUncoveredPayments();
// Should work as before Phase 3
```

**Step 3:** Investigate discrepancies

- Check for data inconsistencies between models
- Verify Phase 2 dual-write is working correctly
- Fix data issues before retrying Phase 3

---

## Success Criteria

- ✅ All read operations prefer `bankTransaction`
- ✅ Fallback to `orderPaymentMatch` works for old data
- ✅ No errors in production logs
- ✅ All tests pass
- ✅ UI displays correct data for new + old records
- ✅ Performance acceptable (no significant slowdown)
- ✅ Logs clearly show which data source is used

---

## Monitoring

### After Deployment

Track these metrics:

1. **Data source distribution** - How often new vs old data is used
2. **Fallback rate** - How often system falls back to orderPaymentMatch
3. **Error rate** - Watch for missing data errors
4. **Log analysis** - Verify "from bankTransaction" vs "from orderPaymentMatch" messages

### Key Log Messages

Look for:

```
[getUncoveredPayments] Skipping transaction: hasCheck=true (txn=true, match=false)
[createAutomaticCheck] Check status from bankTransaction (new data)
[createAutomaticCheck] Skip status from orderPaymentMatch (old data)
[verifyOrderPayments] Check info from bankTransaction (new data)
```

---

## Next Phase

After successful deployment and validation:

- **Phase 4:** Remove dual-write (write only to `bankTransaction`)
- See `PHASE-4-REMOVE-DUAL-WRITE.md`

---

## Files Changed

```
api/actions/getUncoveredPayments.ts
api/actions/previewCheckForPayment.ts
api/actions/verifyOrderPayments.ts
```

**Total: 3 files**

---

## Implementation Time Estimate

- **Code changes:** 1.5 hours
- **Testing:** 3 hours
- **Deployment + monitoring:** 1 hour
- **Total:** ~5.5 hours

---

## Notes

- All reads now have **explicit fallback logic**
- Logs clearly indicate **data source** (new vs old)
- Old data remains **fully accessible**
- No breaking changes for historical records
- Performance impact should be **minimal** (2 queries max per check)
