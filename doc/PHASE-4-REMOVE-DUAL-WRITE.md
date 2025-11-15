# Phase 4: Remove Dual-Write (Write Only to bankTransaction)

**PR Title:** `refactor: Remove dual-write, write only to bankTransaction`

**Branch:** `phase-4/remove-dual-write`

---

## Overview

This phase removes writes to `orderPaymentMatch` and keeps only writes to `bankTransaction`. After Phase 3, all reads prefer the new model, so we can safely stop writing to the old model.

### Goals

- Stop writing to `orderPaymentMatch`
- Write exclusively to `bankTransaction`
- Simplify write logic
- Validate no new `orderPaymentMatch` records are created

### Risk Level

**MEDIUM-HIGH** - Old data becomes frozen, new data only in new model

---

## Changes Required

### Files to Modify

1. `api/actions/verifyOrderPayments.ts` - Remove 4 writes to orderPaymentMatch
2. `api/actions/issueCheckForPayment.ts` - Remove 2 writes to orderPaymentMatch

---

## Implementation Details

### 1. Update `verifyOrderPayments.ts`

Remove ALL dual-writes from Phase 2, keeping only `bankTransaction` writes.

#### Change 1: Skip for excluded payment codes (Line ~91)

**Phase 2 Code (Remove orderPaymentMatch write):**

```typescript
// Mark payment match as skipped (dual-write)
await api.orderPaymentMatch.update(paymentMatch.id, {
  checkSkipped: true,
  checkSkipReason: skipReason,
});

// Also update the bank transaction
await api.bankTransaction.update(paymentMatch.bankTransactionId, {
  checkSkipReason: skipReason,
});
```

**Phase 4 Code:**

```typescript
// Update bank transaction with skip reason
await api.bankTransaction.update(paymentMatch.bankTransactionId, {
  checkSkipReason: skipReason,
});

console.log(
  `[createAutomaticCheck] Updated bankTransaction ${paymentMatch.bankTransactionId} with skip reason: ${skipReason}`
);
```

#### Change 2: Skip for Nova Poshta (Line ~120)

**Phase 2 Code (Remove orderPaymentMatch write):**

```typescript
// Mark payment match as skipped (dual-write)
await api.orderPaymentMatch.update(paymentMatch.id, {
  checkSkipped: true,
  checkSkipReason: skipReason,
});

// Also update the bank transaction
await api.bankTransaction.update(paymentMatch.bankTransactionId, {
  checkSkipReason: skipReason,
});
```

**Phase 4 Code:**

```typescript
// Update bank transaction with skip reason
await api.bankTransaction.update(paymentMatch.bankTransactionId, {
  checkSkipReason: skipReason,
});

console.log(
  `[createAutomaticCheck] Updated bankTransaction ${paymentMatch.bankTransactionId} with Nova Poshta skip reason`
);
```

#### Change 3: Update check info after issuance (Line ~204)

**Phase 2 Code (Remove orderPaymentMatch write):**

```typescript
// Update payment match with check information (dual-write)
const checkIssuedAt = new Date();
const updateResult = await api.orderPaymentMatch.update(paymentMatch.id, {
  checkIssued: true,
  checkReceiptId: receipt.id,
  checkFiscalCode: receipt.fiscal_code || undefined,
  checkReceiptUrl: receipt.receipt_url || undefined,
  checkIssuedAt: checkIssuedAt,
});

// Also update the bank transaction
await api.bankTransaction.update(paymentMatch.bankTransactionId, {
  checkReceiptId: receipt.id,
  checkIssuedAt: checkIssuedAt,
});
```

**Phase 4 Code:**

```typescript
// Update bank transaction with check information
const checkIssuedAt = new Date();
await api.bankTransaction.update(paymentMatch.bankTransactionId, {
  checkReceiptId: receipt.id,
  checkIssuedAt: checkIssuedAt,
});

console.log(
  `[createAutomaticCheck] Updated bankTransaction ${paymentMatch.bankTransactionId} with check details:`,
  {
    checkReceiptId: receipt.id,
    checkIssuedAt: checkIssuedAt,
  }
);
```

**Note:** We're not storing `checkFiscalCode` and `checkReceiptUrl` in `bankTransaction` yet. These can be added to the schema in a future enhancement if needed, or retrieved from the Checkbox API when displaying.

#### Change 4: Create payment match (Line ~585)

**Phase 2 Code (Remove orderPaymentMatch create, keep update to bankTransaction):**

```typescript
await api.orderPaymentMatch.create({
  orderId: order.id,
  bankTransactionId: txId,
  matchConfidence: Math.round(confidence),
  verifiedAt: currentTime,
  matchedBy: 'manual',
  notes: `Amount diff: ${amountDiff.toFixed(4)}, Days diff: ${daysDiff.toFixed(
    2
  )}`,
  orderAmount: orderAmount,
  transactionAmount: txAmount,
  amountDifference: amountDiff,
  daysDifference: daysDiff,
});

// Also update the bank transaction (dual-write)
await api.bankTransaction.update(txId, {
  matchedOrderId: order.id,
});
```

**Phase 4 Code:**

```typescript
// Update bank transaction with matched order
await api.bankTransaction.update(txId, {
  matchedOrderId: order.id,
});

console.log(
  `[verifyOrderPayments] Updated bankTransaction ${txId} with matched order ${order.id}`,
  {
    confidence: Math.round(confidence),
    amountDiff: amountDiff.toFixed(4),
    daysDiff: daysDiff.toFixed(2),
  }
);

// Note: We no longer create orderPaymentMatch records
// Additional metadata (confidence, notes, etc.) can be added to
// bankTransaction schema if needed in future enhancement
```

**Important:** This removes storage of additional metadata fields:

- `matchConfidence`
- `notes`
- `orderAmount`
- `transactionAmount`
- `amountDifference`
- `daysDifference`

These fields are NOT currently in `bankTransaction` schema. Options:

1. **Recommended:** Accept loss of this metadata for new records (old records keep it)
2. Add these fields to `bankTransaction` schema before Phase 4
3. Store as JSON in a new `metadata` field

For this migration, we'll go with option 1 (accept loss) since these fields are primarily for debugging and not used in UI.

---

### 2. Update `issueCheckForPayment.ts`

#### Change 1: Create payment match (Line ~232)

**Phase 2 Code (Remove orderPaymentMatch create):**

```typescript
// If no payment match exists, create one (dual-write)
if (!paymentMatch) {
  console.log(
    '[issueCheckForPayment] Creating new payment match record for transaction:',
    transactionId
  );
  paymentMatch = await api.orderPaymentMatch.create({
    bankTransactionId: transactionId,
    matchedBy: 'manual',
    verifiedAt: new Date(),
    notes: 'Created via manual check issuance from payments page',
    transactionAmount: amount,
  });
  console.log(
    '[issueCheckForPayment] Payment match created with ID:',
    paymentMatch.id
  );

  // Note: matchedOrderId is null here because manual check issuance
  // happens before order matching. It will be set when order is matched.
}
```

**Phase 4 Code:**

```typescript
// No longer need to create orderPaymentMatch
// Bank transaction already exists, just needs check info
console.log(
  '[issueCheckForPayment] Processing check for transaction:',
  transactionId
);
```

#### Change 2: Verify existing check logic (Line ~186)

**Phase 2 Code (Still queries orderPaymentMatch):**

```typescript
// Get or create orderPaymentMatch record
let paymentMatch = await api.orderPaymentMatch.findFirst({
  filter: { bankTransactionId: { equals: transactionId } },
  select: {
    id: true,
    checkIssued: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkFiscalCode: true,
    checkReceiptUrl: true,
    orderId: true,
  },
});

// If a match exists but is linked to a different order, prevent creation
if (paymentMatch && paymentMatch.orderId) {
  console.log(
    '[issueCheckForPayment] Transaction already matched to order:',
    paymentMatch.orderId
  );
  return {
    success: false,
    error: 'Transaction already matched to another order',
  };
}

// Check if check already issued
if (paymentMatch && paymentMatch.checkIssued) {
  console.log(
    '[issueCheckForPayment] Check already issued for this transaction'
  );
  return {
    success: false,
    error: 'Check already issued for this transaction',
    receiptId: paymentMatch.checkReceiptId,
    fiscalCode: paymentMatch.checkFiscalCode,
    receiptUrl: paymentMatch.checkReceiptUrl,
    issuedAt: paymentMatch.checkIssuedAt,
  };
}
```

**Phase 4 Code (Use bankTransaction only, with orderPaymentMatch fallback for old data):**

```typescript
// Check bank transaction (prefer this - new data)
const bankTransaction = await api.bankTransaction.findFirst({
  filter: { id: { equals: transactionId } },
  select: {
    id: true,
    counterpartyAccount: true,
    counterpartyName: true,
    matchedOrderId: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
});

if (!bankTransaction) {
  console.error(
    '[issueCheckForPayment] Bank transaction not found:',
    transactionId
  );
  return {
    success: false,
    error: 'Bank transaction not found',
  };
}

// Check if transaction already matched to an order
if (bankTransaction.matchedOrderId) {
  console.log(
    '[issueCheckForPayment] Transaction already matched to order:',
    bankTransaction.matchedOrderId
  );
  return {
    success: false,
    error: 'Transaction already matched to another order',
  };
}

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

// Continue with check issuance...
```

#### Change 3: Update check info after issuance (Line ~319)

**Phase 2 Code (Remove orderPaymentMatch write):**

```typescript
const updateResult = await api.orderPaymentMatch.update(paymentMatch.id, {
  checkIssued: true,
  checkIssuedAt: checkIssuedAt,
  checkReceiptId: receipt.id,
  checkFiscalCode: receipt.fiscal_code || undefined,
  checkReceiptUrl: receipt.receipt_url || undefined,
});

// Also update the bank transaction (dual-write)
await api.bankTransaction.update(transactionId, {
  checkReceiptId: receipt.id,
  checkIssuedAt: checkIssuedAt,
});
```

**Phase 4 Code:**

```typescript
// Update bank transaction with check information
const checkIssuedAt = new Date();
await api.bankTransaction.update(transactionId, {
  checkReceiptId: receipt.id,
  checkIssuedAt: checkIssuedAt,
});

console.log(
  `[issueCheckForPayment] Updated bankTransaction ${transactionId} with check details:`,
  {
    checkReceiptId: receipt.id,
    checkIssuedAt: checkIssuedAt,
  }
);

// Note: checkFiscalCode and checkReceiptUrl not stored in bankTransaction
// Can be retrieved from Checkbox API if needed for display
```

---

## Testing Checklist

### Functional Testing

#### Test 1: Verify Payment (Create New Match)

- [ ] Run `verifyOrderPayments` with unverified orders
- [ ] Verify NO new `orderPaymentMatch` records created
- [ ] Verify `bankTransaction.matchedOrderId` is set
- [ ] Verify order marked as paid
- [ ] Check logs confirm bankTransaction update only

#### Test 2: Issue Check Automatically

- [ ] Verify payment with auto-check enabled
- [ ] Verify check issued successfully
- [ ] Verify NO `orderPaymentMatch` write
- [ ] Verify `bankTransaction` updated with check details
- [ ] Verify order note added with receipt info

#### Test 3: Issue Check Manually (Payments Page)

- [ ] Navigate to payments page
- [ ] Issue check for uncovered payment
- [ ] Verify NO `orderPaymentMatch` created
- [ ] Verify `bankTransaction` updated
- [ ] Verify check details correct

#### Test 4: Skip Check (Excluded Payment Code)

- [ ] Verify payment with excluded code (2600, 2902, etc.)
- [ ] Verify skip reason written to `bankTransaction` only
- [ ] Verify NO `orderPaymentMatch` update
- [ ] Verify order note explains skip

#### Test 5: Skip Check (Nova Poshta)

- [ ] Verify payment from Nova Poshta account
- [ ] Verify skip reason in `bankTransaction` only
- [ ] Verify NO `orderPaymentMatch` update

### Data Validation

#### Test 6: Verify No New orderPaymentMatch Records

```typescript
// Get count before test
const beforeCount = await api.orderPaymentMatch.count({});

// Run verifications and check issuance

// Get count after test
const afterCount = await api.orderPaymentMatch.count({});

// Assert: beforeCount === afterCount
console.assert(
  beforeCount === afterCount,
  'ERROR: New orderPaymentMatch records created!'
);
```

#### Test 7: Verify All Data in bankTransaction

```typescript
// Check that all new data is in bankTransaction
const recentTransactions = await api.bankTransaction.findMany({
  filter: {
    matchedOrderId: { isSet: true },
    // Add date filter for new data only
  },
  select: {
    id: true,
    matchedOrderId: true,
    checkReceiptId: true,
    checkIssuedAt: true,
    checkSkipReason: true,
  },
});

// Verify all have proper data
recentTransactions.forEach((txn) => {
  console.log('Transaction:', txn.id, {
    hasOrderMatch: !!txn.matchedOrderId,
    hasCheck: !!txn.checkReceiptId,
    hasSkip: !!txn.checkSkipReason,
  });
});
```

### Old Data Validation

#### Test 8: Old Records Still Readable

- [ ] Query order verified before Phase 4
- [ ] Verify check info still displays (via Phase 3 fallback)
- [ ] Verify no errors reading old data
- [ ] Verify UI shows historical checks correctly

### Edge Cases

- [ ] Transaction with existing orderPaymentMatch (should not update it)
- [ ] Transaction without orderPaymentMatch (should work fine)
- [ ] Re-running verification on same order (should not create duplicates)
- [ ] Check issuance for already-covered payment (should reject)

---

## Rollback Plan

### If Issues Detected

**Step 1:** Revert to Phase 2 (dual-write)

```powershell
git revert HEAD
git push
```

**Step 2:** Verify dual-write restored

```typescript
// Test that orderPaymentMatch writes are back
const beforeCount = await api.orderPaymentMatch.count({});

// Run verification

const afterCount = await api.orderPaymentMatch.count({});

// Should see new records
console.assert(afterCount > beforeCount, 'Dual-write not restored!');
```

**Step 3:** Investigate why Phase 4 failed

- Check for missing data in `bankTransaction`
- Verify Phase 3 fallback logic is correct
- Review logs for errors
- Fix issues before retrying Phase 4

---

## Success Criteria

- ✅ No new `orderPaymentMatch` records created
- ✅ All writes go to `bankTransaction` only
- ✅ Verification works for new orders
- ✅ Check issuance works (auto + manual)
- ✅ Skip logic works correctly
- ✅ Old data still readable (via Phase 3 fallback)
- ✅ No errors in production logs
- ✅ All tests pass

---

## Monitoring

### After Deployment

Track:

1. **orderPaymentMatch record count** - Should NOT increase
2. **bankTransaction updates** - Should see all new writes here
3. **Error rate** - Watch for missing data errors
4. **Fallback usage** - Should see "old data" logs for historical records

### Key Queries

```typescript
// Monitor orderPaymentMatch - count should stay constant
const dailyCounts = await api.orderPaymentMatch.count({
  filter: {
    createdAt: { greaterThan: deploymentDate },
  },
});
// Should be 0

// Monitor bankTransaction updates
const updatedTransactions = await api.bankTransaction.findMany({
  filter: {
    updatedAt: { greaterThan: deploymentDate },
    matchedOrderId: { isSet: true },
  },
});
// Should see new verifications here
```

---

## Important Notes

### Metadata Loss

The following fields from `orderPaymentMatch` are NOT stored in `bankTransaction`:

- `matchConfidence`
- `notes`
- `orderAmount`
- `transactionAmount`
- `amountDifference`
- `daysDifference`
- `matchedBy`
- `verifiedAt`
- `checkFiscalCode`
- `checkReceiptUrl`
- `checkSkipped` (boolean)

**Decision:** Accept loss for new records. Old records retain this data.

**Future Enhancement:** If these fields are needed, add them to `bankTransaction` schema before Phase 4.

---

## Next Phase

After successful deployment and validation:

- **Phase 5:** Remove fallback logic (read only from `bankTransaction`)
- See `PHASE-5-REMOVE-FALLBACK.md`

---

## Files Changed

```
api/actions/verifyOrderPayments.ts
api/actions/issueCheckForPayment.ts
```

**Total: 2 files**

---

## Implementation Time Estimate

- **Code changes:** 1 hour
- **Testing:** 3 hours
- **Deployment + monitoring:** 2 hours
- **Total:** ~6 hours
