# Phase 2: Update Write Operations to Dual-Write

**PR Title:** `feat: Dual-write payment matching data to bankTransaction`

**Branch:** `phase-2/dual-write-payment-data`

---

## Overview

This phase updates all write operations to populate both `orderPaymentMatch` AND the new `bankTransaction` fields simultaneously. This ensures new data is available in both locations while maintaining backward compatibility.

### Goals

- Write payment matching data to both models
- Maintain data consistency between models
- Zero disruption to existing functionality

### Risk Level

**MEDIUM** - Modifies write logic but maintains backward compatibility

---

## Changes Required

### Files to Modify

1. `api/actions/verifyOrderPayments.ts` - 3 write locations
2. `api/actions/issueCheckForPayment.ts` - 2 write locations

---

## Implementation Details

### 1. Update `verifyOrderPayments.ts`

This file has THREE locations where `orderPaymentMatch` is written:

#### Location 1: Skip check for excluded payment codes (Line ~91)

**Before:**

```typescript
// Mark payment match as skipped
await api.orderPaymentMatch.update(paymentMatch.id, {
  checkSkipped: true,
  checkSkipReason: skipReason,
});
```

**After:**

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

#### Location 2: Skip check for Nova Poshta (Line ~120)

**Before:**

```typescript
// Mark payment match as skipped
await api.orderPaymentMatch.update(paymentMatch.id, {
  checkSkipped: true,
  checkSkipReason: skipReason,
});
```

**After:**

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

#### Location 3: Update check info after successful issuance (Line ~204)

**Before:**

```typescript
// Update payment match with check information
const checkIssuedAt = new Date();
const updateResult = await api.orderPaymentMatch.update(paymentMatch.id, {
  checkIssued: true,
  checkReceiptId: receipt.id,
  checkFiscalCode: receipt.fiscal_code || undefined,
  checkReceiptUrl: receipt.receipt_url || undefined,
  checkIssuedAt: checkIssuedAt,
});
```

**After:**

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

#### Location 4: Create new payment match (Line ~585)

**Before:**

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
```

**After:**

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

---

### 2. Update `issueCheckForPayment.ts`

This file has TWO locations where `orderPaymentMatch` is written:

#### Location 1: Create payment match for manual check issuance (Line ~232)

**Before:**

```typescript
// If no payment match exists, create one
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
}
```

**After:**

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

#### Location 2: Update check info after successful issuance (Line ~319)

**Before:**

```typescript
const updateResult = await api.orderPaymentMatch.update(paymentMatch.id, {
  checkIssued: true,
  checkIssuedAt: checkIssuedAt,
  checkReceiptId: receipt.id,
  checkFiscalCode: receipt.fiscal_code || undefined,
  checkReceiptUrl: receipt.receipt_url || undefined,
});
```

**After:**

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

---

## Complete Modified Files

### File: `api/actions/verifyOrderPayments.ts`

Key changes (apply all 4 modifications above):

1. Add dual-write after skip reason update (excluded payment codes)
2. Add dual-write after skip reason update (Nova Poshta)
3. Add dual-write after check issuance
4. Add dual-write after payment match creation

### File: `api/actions/issueCheckForPayment.ts`

Key changes (apply both modifications above):

1. Document that matchedOrderId stays null for manual issuance
2. Add dual-write after check issuance

---

## Testing Checklist

### Functional Testing

#### Test 1: Verify Order Payment (New Match)

- [ ] Run `verifyOrderPayments` with unverified orders
- [ ] Verify `orderPaymentMatch` record created
- [ ] Verify `bankTransaction.matchedOrderId` is set
- [ ] Verify both have same order ID
- [ ] Check logs for successful dual-write

#### Test 2: Verify Order Payment with Excluded Code

- [ ] Run verification for order with payment code 2600/2902/2909/2920
- [ ] Verify skip reason written to `orderPaymentMatch`
- [ ] Verify skip reason written to `bankTransaction.checkSkipReason`
- [ ] Verify both have same skip reason

#### Test 3: Verify Order Payment with Nova Poshta

- [ ] Run verification for order with Nova Poshta account
- [ ] Verify skip reason in both models
- [ ] Verify check not issued

#### Test 4: Automatic Check Creation

- [ ] Verify order payment with auto-check enabled
- [ ] Verify check issued successfully
- [ ] Verify `orderPaymentMatch` has check details
- [ ] Verify `bankTransaction` has check details (receiptId, issuedAt)
- [ ] Verify both models have matching data

#### Test 5: Manual Check Issuance (Payments Page)

- [ ] Go to payments page
- [ ] Issue check for uncovered payment
- [ ] Verify `orderPaymentMatch` created/updated
- [ ] Verify `bankTransaction` updated with check details
- [ ] Verify receipt ID and timestamp match

### Data Consistency Testing

#### Test 6: Compare Data Between Models

```typescript
// Run this query to verify data consistency
const transaction = await api.bankTransaction.findFirst({
  filter: {
    matchedOrderId: { isSet: true },
  },
  select: {
    id: true,
    matchedOrderId: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
});

const match = await api.orderPaymentMatch.findFirst({
  filter: {
    bankTransactionId: { equals: transaction.id },
  },
  select: {
    orderId: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
});

// Verify:
// transaction.matchedOrderId === match.orderId
// transaction.checkIssuedAt === match.checkIssuedAt
// transaction.checkReceiptId === match.checkReceiptId
// transaction.checkSkipReason === match.checkSkipReason
```

### Edge Case Testing

- [ ] Transaction already has payment match (should update both)
- [ ] Transaction without payment match (should create match, update transaction)
- [ ] Multiple orders matched to different transactions (no conflicts)
- [ ] Check issuance after skip (should update skip reason)

### Backward Compatibility

- [ ] Old code reading from `orderPaymentMatch` still works
- [ ] Orders verified before Phase 2 still display correctly
- [ ] No errors in production logs
- [ ] All existing queries still return correct data

---

## Rollback Plan

### If Data Inconsistency Detected

**Step 1:** Stop writes to new fields

```powershell
git revert HEAD
git push
```

**Step 2:** Validate old model still has all data

```typescript
// Verify orderPaymentMatch has all records
const allMatches = await api.orderPaymentMatch.findMany({
  filter: {
    verifiedAt: { greaterThan: rollbackDate },
  },
});
// Should contain all recent verifications
```

**Step 3:** Clean up partial dual-writes (if needed)

```typescript
// Clear new fields from transactions created during Phase 2
await api.bankTransaction.updateMany({
  filter: {
    matchedOrderId: { isSet: true },
    // Only clear records from Phase 2 period
  },
  update: {
    matchedOrderId: null,
    checkIssuedAt: null,
    checkReceiptId: null,
    checkSkipReason: null,
  },
});
```

### If Performance Issues

Monitor query performance:

- Watch for slow dual-write operations
- Check database transaction logs
- Monitor API response times for affected endpoints

If slow:

- Consider batching updates
- Add database indexes if needed
- Roll back and optimize before redeploying

---

## Success Criteria

- ✅ All 5 write locations updated
- ✅ Data written to both models consistently
- ✅ No errors in production logs
- ✅ All tests pass
- ✅ Data integrity maintained (old + new models match)
- ✅ Performance acceptable (no significant slowdown)
- ✅ Existing functionality unchanged

---

## Monitoring

### After Deployment

Check these metrics:

1. **Data consistency rate** - Compare records in both models
2. **Error rate** - Watch for dual-write failures
3. **Response time** - Ensure no performance degradation
4. **Log analysis** - Check for warnings/errors related to dual-write

### Key Log Messages

Look for these in logs:

```
[issueCheckForPayment] Payment match created
[verifyOrderPayments] Payment match created
Check created successfully
Database updated for payment match
```

---

## Next Phase

After successful deployment and validation:

- **Phase 3:** Update read operations to prefer `bankTransaction` with fallback to `orderPaymentMatch`
- See `PHASE-3-DUAL-READ.md`

---

## Files Changed

```
api/actions/verifyOrderPayments.ts
api/actions/issueCheckForPayment.ts
```

**Total: 2 files**

---

## Implementation Time Estimate

- **Code changes:** 30 minutes
- **Testing:** 2 hours
- **Deployment + monitoring:** 1 hour
- **Total:** ~3.5 hours
