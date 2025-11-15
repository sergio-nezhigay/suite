# Phase 1: Add New Fields to `bankTransaction` Model

**PR Title:** `feat: Add payment matching fields to bankTransaction schema`

**Branch:** `phase-1/add-bank-transaction-fields`

---

## Overview

This phase extends the `bankTransaction` model with nullable fields to store payment-matching data. This is the foundation for consolidating `orderPaymentMatch` data into `bankTransaction`.

### Goals

- Add new nullable fields to `bankTransaction`
- Maintain backward compatibility
- Zero impact on existing functionality

### Risk Level

**LOW** - Schema-only change, all fields are nullable

---

## Changes Required

### 1. Update `bankTransaction` Schema

**File:** `api/models/bankTransaction/schema.gadget.ts`

**Action:** Add four new nullable fields to the `fields` object

```typescript
import type { GadgetModel } from 'gadget-server';

// This file describes the schema for the "bankTransaction" model, go to https://admin-action-block.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: 'gadget/model-schema/v1',
  storageKey: 'z7Tb8slHup--',
  fields: {
    amount: {
      type: 'number',
      validations: { numberRange: { min: 0, max: 1000000 } },
      storageKey: 'N-3nvM-qGU_R',
    },
    counterpartyAccount: {
      type: 'string',
      storageKey: 'zKicsG4beJ7o',
    },
    counterpartyName: { type: 'string', storageKey: 'qk8SCUJ-8zMu' },
    currency: {
      type: 'string',
      default: 'UAH',
      validations: { required: true },
      storageKey: 'ET53M1sn6PLF',
    },
    description: { type: 'string', storageKey: '8uDXJJMjVSG2' },
    externalId: {
      type: 'string',
      validations: {
        required: true,
        unique: { caseSensitive: true },
      },
      storageKey: 'yst3hxSgaVsZ',
    },
    rawData: { type: 'json', storageKey: 'Swc_qri8D-Lo' },
    reference: { type: 'string', storageKey: 'Q6sIYCHuc6lg' },
    status: {
      type: 'enum',
      default: 'processed',
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ['processed', 'pending', 'failed'],
      storageKey: 'bDSoIb1-3S5N',
    },
    syncedAt: {
      type: 'dateTime',
      includeTime: true,
      storageKey: 'UrJdqJqQM1j3',
    },
    transactionDateTime: {
      type: 'dateTime',
      includeTime: true,
      validations: { required: true },
      storageKey: 'uk3-My-7XYvW',
    },
    type: {
      type: 'enum',
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ['income', 'expense'],
      validations: { required: true },
      storageKey: 'geQg5SfMfAv7',
    },

    // ===== NEW FIELDS FOR PAYMENT MATCHING =====
    // These fields consolidate data from orderPaymentMatch model

    matchedOrderId: {
      type: 'string',
      storageKey: 'matchedOrderId-001',
    },
    checkIssuedAt: {
      type: 'dateTime',
      includeTime: true,
      storageKey: 'checkIssuedAt-002',
    },
    checkReceiptId: {
      type: 'string',
      storageKey: 'checkReceiptId-002',
    },
    checkSkipReason: {
      type: 'string',
      storageKey: 'checkSkipReason-002',
    },
  },
};
```

---

## Implementation Steps

### Step 1: Create Feature Branch

```powershell
git checkout -b phase-1/add-bank-transaction-fields
```

### Step 2: Update Schema File

1. Open `api/models/bankTransaction/schema.gadget.ts`
2. Add the four new fields shown above to the `fields` object
3. Ensure all `storageKey` values are unique

### Step 3: Deploy Schema Changes

In Gadget admin panel:

1. Navigate to your Gadget app
2. The schema changes will be detected automatically
3. Deploy the changes to development environment
4. Verify migration runs successfully

### Step 4: Verify Deployment

```powershell
# The fields should now be available in TypeScript types
# Check generated types are updated
```

---

## Testing Checklist

### Schema Validation

- [ ] Schema file syntax is valid
- [ ] All `storageKey` values are unique
- [ ] Deployment succeeds without errors
- [ ] Database migration runs successfully

### Backward Compatibility

- [ ] Existing `bankTransaction` records load without errors
- [ ] Can create new `bankTransaction` without new fields
- [ ] Can create new `bankTransaction` with new fields set to `null`
- [ ] Existing queries/filters still work

### New Field Testing

- [ ] Can set `matchedOrderId` to string value
- [ ] Can set `checkIssuedAt` to datetime value
- [ ] Can set `checkReceiptId` to string value
- [ ] Can set `checkSkipReason` to string value
- [ ] All fields accept `null` values
- [ ] Can query records filtering by new fields

### API Validation

Test in Gadget API playground:

```typescript
// Create record with null new fields
const transaction1 = await api.bankTransaction.create({
  amount: 100,
  currency: 'UAH',
  type: 'income',
  transactionDateTime: new Date(),
  externalId: 'test-1',
});

// Create record with populated new fields
const transaction2 = await api.bankTransaction.create({
  amount: 200,
  currency: 'UAH',
  type: 'income',
  transactionDateTime: new Date(),
  externalId: 'test-2',
  matchedOrderId: 'gid://shopify/Order/12345',
  checkIssuedAt: new Date(),
  checkReceiptId: 'RCPT-001',
  checkSkipReason: null,
});

// Query with new fields
const matched = await api.bankTransaction.findMany({
  filter: {
    matchedOrderId: { isSet: true },
  },
  select: {
    id: true,
    amount: true,
    matchedOrderId: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkSkipReason: true,
  },
});
```

---

## Rollback Plan

### If Issues Detected

**Step 1:** Revert schema changes

```powershell
git revert HEAD
git push
```

**Step 2:** Remove fields in Gadget admin

1. Navigate to `bankTransaction` model
2. Delete the four new fields:
   - `matchedOrderId`
   - `checkIssuedAt`
   - `checkReceiptId`
   - `checkSkipReason`
3. Deploy changes

**Step 3:** Verify rollback

- [ ] Existing records still load
- [ ] All existing functionality works
- [ ] No references to removed fields in code

---

## Success Criteria

- ✅ Schema deploys successfully
- ✅ All new fields are nullable
- ✅ Existing records unchanged
- ✅ Can create records with/without new fields
- ✅ TypeScript types updated
- ✅ No errors in logs
- ✅ All tests pass

---

## Next Phase

After successful deployment and verification:

- **Phase 2:** Update write operations to dual-write to both models
- See `PHASE-2-DUAL-WRITE.md`

---

## Notes

- **No historical data migration** - old `orderPaymentMatch` records remain unchanged
- All fields are nullable to maintain backward compatibility
- No application code changes in this phase
- This is a pure schema change with zero business logic impact
- Fields can be populated incrementally in future phases

---

## Files Changed

```
api/models/bankTransaction/schema.gadget.ts
```

**Total: 1 file**
