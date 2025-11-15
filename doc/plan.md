# Migration Plan: Consolidate `orderPaymentMatch` into `bankTransaction`

## Overview

Move payment-matching data from the `orderPaymentMatch` model into the `bankTransaction` model while maintaining the rule:
**1 bank transaction → 1 issued check → 1 linked order**

## High-Level Plan

### Goals

- Add new fields to `bankTransaction` to store payment-matching data
- Update all code that reads/writes `orderPaymentMatch` to use `bankTransaction`
- Remove the `orderPaymentMatch` model when completed
- Maintain backward compatibility (no historical migration)

### Constraints

- Each phase must be independently deployable
- Each phase must be reversible
- No migration of historical `orderPaymentMatch` data
- New logic must handle `null` data gracefully
- All phases must be tested before merge

### Key Technical Decisions

- Use nullable new fields
- Keep `orderPaymentMatch` until all code is moved
- Add defensive null-checks
- Deploy incrementally with rollback capability

## Phase Breakdown

### Phase 1: Add New Fields to `bankTransaction` Model

**Goal:** Extend without breaking existing functionality

**Changes**

- Add the following nullable fields:
  - `matchedOrderId` (string, nullable)
  - `checkIssuedAt` (dateTime, nullable)
  - `checkReceiptId` (string, nullable)
  - `checkSkipReason` (string, nullable)

**Testing**

- Ensure schema updates deploy correctly
- Validate existing records remain functional
- Test creation with and without new fields

**Rollback**

- Remove the newly added fields

**Affected Files**

- `api/models/bankTransaction/schema.gadget.ts`

---

### Phase 2: Update Write Operations to Dual-Write

**Goal:** Populate new fields while maintaining old model

**Changes**

- Find code writing to `orderPaymentMatch`
- Write same data to `bankTransaction` (dual-write)

**Likely Affected Files**
api/actions/verifyOrderPayments.ts
api/actions/issueCheckForPayment.ts
api/routes/POST-verifyOrderPayments.ts

markdown
Copy code

**Testing**

- Verify data parity between models
- Verify full workflow unchanged
- Test edge cases

**Rollback**

- Remove dual-write logic

---

### Phase 3: Update Read Operations to Prefer `bankTransaction`

**Goal:** Read from new fields, fallback to old model

**Changes**

- Update all read operations with priority:
  1. `bankTransaction`
  2. `orderPaymentMatch` fallback
- Add null-safe checks

**Likely Affected Files**
api/actions/getUncoveredPayments.ts
api/actions/previewCheckForPayment.ts
web/routes/payments.tsx

markdown
Copy code

**Testing**

- Verify new records read from `bankTransaction`
- Verify old data still visible
- Test missing/null cases

**Rollback**

- Revert read logic

---

### Phase 4: Remove Dual-Write

**Goal:** Write only to `bankTransaction`

**Changes**

- Remove all writes to `orderPaymentMatch`

**Testing**

- Confirm no new `orderPaymentMatch` records
- Full end-to-end workflow

**Rollback**

- Revert to Phase 2 (dual-write)

---

### Phase 5: Remove Fallback Logic

**Goal:** Read exclusively from `bankTransaction`

**Changes**

- Remove fallback checks
- Simplify code

**Testing**

- Ensure all reading works with new data
- Old records should not break code

**Rollback**

- Restore fallback logic

---

### Phase 6: Delete `orderPaymentMatch` Model

**Goal:** Fully remove unused model

**Changes**

- Delete model and related actions:
  /api/models/orderPaymentMatch/actions/create.ts
  /api/models/orderPaymentMatch/actions/update.ts
  /api/models/orderPaymentMatch/actions/delete.ts

pgsql
Copy code

- Remove all references from codebase

**Testing**

- Full regression testing, production level

**Rollback**

- Restore model from version control
- Revert to Phase 4

---

## Summary Table

| Phase | Description             | Key Risk                   | Rollback Difficulty |
| ----- | ----------------------- | -------------------------- | ------------------- |
| 1     | Add new fields          | Schema change              | Low                 |
| 2     | Dual-write              | Data inconsistency         | Low                 |
| 3     | Dual-read w/ fallback   | Logic complexity           | Low                 |
| 4     | Write only to new model | Old data becomes invisible | Medium              |
| 5     | Read only new model     | Missing old data           | Medium              |
| 6     | Delete old model        | Permanent deletion         | High                |

---

## Testing Strategy

- **Unit tests:** new fields & functions
- **Integration tests:** full workflow (payment + check issuance)
- **Manual tests:** Shopify admin extensions
- **Rollback validation:** every phase must be undoable

## Notes

- No historical data migration
- Old unmatched records will stay valid
- All new logic must handle `null` gracefully
- Incremental deploys only
