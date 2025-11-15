# Phase 6: Delete orderPaymentMatch Model

**PR Title:** `feat: Remove orderPaymentMatch model - migration complete`

**Branch:** `phase-6/delete-orderpaymentmatch`

---

## Overview

This is the final phase of the migration. After Phase 5, all code reads and writes exclusively from `bankTransaction`. Now we can safely delete the `orderPaymentMatch` model and all its associated files.

### Goals

- Permanently delete `orderPaymentMatch` model
- Remove all model files and references
- Clean up any remaining dead code
- Complete the migration

### Risk Level

**HIGH** - Permanent deletion of model and historical data

---

## ⚠️ CRITICAL PRE-DEPLOYMENT CHECKLIST

Before proceeding with Phase 6, verify:

- [ ] **Phase 5 has been live for at least 2 weeks**
- [ ] **No errors related to missing orderPaymentMatch data**
- [ ] **All stakeholders approved data loss**
- [ ] **Database backup completed and verified**
- [ ] **Historical data exported if needed for compliance/reporting**
- [ ] **All production logs reviewed for any orderPaymentMatch references**
- [ ] **Team meeting held to confirm go-ahead**

**STOP:** If any checkbox is unchecked, DO NOT proceed with Phase 6.

---

## Data Backup & Export

### Step 1: Export Historical Data

Before deletion, export all `orderPaymentMatch` data for archival:

```typescript
// Run this in Gadget API playground or create a one-time action
const allMatches = await api.orderPaymentMatch.findMany({
  select: {
    id: true,
    orderId: true,
    bankTransactionId: true,
    checkIssued: true,
    checkIssuedAt: true,
    checkReceiptId: true,
    checkFiscalCode: true,
    checkReceiptUrl: true,
    checkSkipped: true,
    checkSkipReason: true,
    matchConfidence: true,
    matchedBy: true,
    verifiedAt: true,
    notes: true,
    orderAmount: true,
    transactionAmount: true,
    amountDifference: true,
    daysDifference: true,
    createdAt: true,
    updatedAt: true,
  },
  first: 10000, // Adjust based on actual record count
});

// Export to JSON file
const fs = require('fs');
fs.writeFileSync(
  'orderPaymentMatch_backup_' + new Date().toISOString() + '.json',
  JSON.stringify(allMatches, null, 2)
);
```

**Save this file to:**

- Project repository (in `backups/` folder)
- Cloud storage (S3, Google Drive, etc.)
- Local secure backup location

### Step 2: Verify Export

```typescript
// Verify export file integrity
const backup = JSON.parse(fs.readFileSync('orderPaymentMatch_backup_...json'));
console.log('Total records backed up:', backup.length);
console.log('Date range:', {
  earliest: backup[0]?.createdAt,
  latest: backup[backup.length - 1]?.createdAt,
});
```

---

## Changes Required

### Files to Delete

#### 1. Model Schema

```
api/models/orderPaymentMatch/schema.gadget.ts
```

#### 2. Model Actions (if they exist)

```
api/models/orderPaymentMatch/actions/create.ts
api/models/orderPaymentMatch/actions/update.ts
api/models/orderPaymentMatch/actions/delete.ts
```

#### 3. Model Directory

```
api/models/orderPaymentMatch/
```

### Code References to Remove

Search codebase for any remaining references:

```powershell
# Search for orderPaymentMatch references
git grep -i "orderPaymentMatch" --cached
```

Expected findings (should be NONE if Phase 5 was thorough):

- No `.ts` or `.tsx` files should reference it
- May find references in:
  - `plan.md` (documentation - can stay)
  - Phase docs (PHASE-\*.md files - can stay)
  - Git history (expected)

---

## Implementation Steps

### Step 1: Create Feature Branch

```powershell
git checkout -b phase-6/delete-orderpaymentmatch
```

### Step 2: Search for References

```powershell
# Find all references
git grep -n "orderPaymentMatch"

# Expected: ONLY in documentation files and PHASE-*.md
# If found in code files, investigate before proceeding
```

### Step 3: Delete Model in Gadget Admin

1. Log into Gadget admin panel
2. Navigate to **Data Models**
3. Find `orderPaymentMatch` model
4. Click **Delete Model**
5. Confirm deletion (this will also delete the database table)

⚠️ **WARNING:** This step is IRREVERSIBLE. The database table and all data will be permanently deleted.

### Step 4: Delete Local Model Files

```powershell
# Delete the entire model directory
Remove-Item -Recurse -Force "api/models/orderPaymentMatch"

# Verify deletion
Test-Path "api/models/orderPaymentMatch"  # Should return False
```

### Step 5: Commit Changes

```powershell
git add -A
git commit -m "feat: Remove orderPaymentMatch model - migration complete

- Deleted orderPaymentMatch schema and model files
- Historical data backed up to backups/ folder
- All functionality now uses bankTransaction model
- Completes migration from orderPaymentMatch to bankTransaction

BREAKING CHANGE: orderPaymentMatch model no longer exists
Historical payment match data is no longer accessible via API"

git push origin phase-6/delete-orderpaymentmatch
```

---

## Testing Checklist

### Pre-Deletion Verification

- [ ] Phase 5 deployed and stable for 2+ weeks
- [ ] Zero production errors related to missing data
- [ ] All automated tests passing
- [ ] Manual testing of all payment flows successful

### Post-Deletion Verification

#### Test 1: Verify Model Deleted

```typescript
// This should fail with "model not found" error
try {
  const result = await api.orderPaymentMatch.findMany({});
  console.error('ERROR: Model still exists!');
} catch (error) {
  console.log('✓ Confirmed: Model deleted successfully');
}
```

#### Test 2: Full Payment Flow

- [ ] Navigate to payments page
- [ ] List uncovered payments (should work)
- [ ] Preview check (should work)
- [ ] Issue check manually (should work)
- [ ] Verify payment verification with auto-check (should work)

#### Test 3: Order Verification

- [ ] Verify multiple orders
- [ ] Check automatic check creation
- [ ] Verify skip logic for excluded codes
- [ ] Verify Nova Poshta exclusion

#### Test 4: Check Database

```sql
-- In Gadget database console, verify table doesn't exist
SELECT * FROM orderPaymentMatch LIMIT 1;
-- Should error: "relation does not exist"
```

### Regression Testing

Run full regression test suite:

- [ ] All payment verification flows
- [ ] All check issuance flows
- [ ] Payment status display
- [ ] Order payment status updates
- [ ] API endpoint responses
- [ ] UI components (payments page, order details, etc.)

---

## Rollback Plan

### If Critical Issues Detected After Deletion

⚠️ **WARNING:** Rollback is DIFFICULT after Phase 6. The database table is permanently deleted.

#### Option 1: Restore Model with Empty Data (Quick)

**If functionality breaks but historical data not needed:**

1. **Recreate model schema**

```powershell
git revert HEAD
git push
```

2. **Recreate in Gadget admin**

   - Go to Data Models
   - Create new `orderPaymentMatch` model
   - Copy schema from git history or Phase 1 doc

3. **Restore Phase 5 code**
   - Revert to Phase 5 commit
   - Redeploy

**Result:** Model exists but with no historical data. New data will accumulate.

#### Option 2: Restore Model with Historical Data (Slow)

**If historical data is critical:**

1. **Recreate model** (as in Option 1)

2. **Restore data from backup**

```typescript
// Load backup file
const backup = JSON.parse(fs.readFileSync('orderPaymentMatch_backup_...json'));

// Restore records in batches
const batchSize = 100;
for (let i = 0; i < backup.length; i += batchSize) {
  const batch = backup.slice(i, i + batchSize);

  for (const record of batch) {
    await api.orderPaymentMatch.create({
      orderId: record.orderId,
      bankTransactionId: record.bankTransactionId,
      checkIssued: record.checkIssued,
      checkIssuedAt: record.checkIssuedAt,
      checkReceiptId: record.checkReceiptId,
      checkFiscalCode: record.checkFiscalCode,
      checkReceiptUrl: record.checkReceiptUrl,
      checkSkipped: record.checkSkipped,
      checkSkipReason: record.checkSkipReason,
      matchConfidence: record.matchConfidence,
      matchedBy: record.matchedBy,
      verifiedAt: record.verifiedAt,
      notes: record.notes,
      orderAmount: record.orderAmount,
      transactionAmount: record.transactionAmount,
      amountDifference: record.amountDifference,
      daysDifference: record.daysDifference,
    });
  }

  console.log(`Restored batch ${i / batchSize + 1}`);
}
```

3. **Revert code to Phase 2 or 3**

   - Phase 2: Dual-write active
   - Phase 3: Dual-read with fallback

4. **Re-run migration** starting from Phase 3 or 4

**Time estimate:** 4-8 hours (depending on data volume)

---

## Success Criteria

- ✅ `orderPaymentMatch` model deleted from Gadget
- ✅ Model files deleted from repository
- ✅ Database table removed
- ✅ No references in code (except docs)
- ✅ All payment flows work correctly
- ✅ No errors in production logs
- ✅ All tests pass
- ✅ Historical data backed up securely

---

## Monitoring

### First 24 Hours

Monitor closely:

1. **Error rates** - Watch for any spikes
2. **Payment flow completions** - Should remain stable
3. **User reports** - Any missing data or broken functionality
4. **Database queries** - Should see NO orderPaymentMatch queries

### First Week

1. Review logs daily for issues
2. Check with stakeholders for any problems
3. Verify backup integrity
4. Monitor system performance

### After One Week

If no issues:

- ✅ Migration complete
- ✅ Update documentation
- ✅ Close migration project
- ✅ Archive phase docs

---

## Communication Plan

### Before Deployment

Send notice to:

- **Development team:** 3 days notice
- **QA team:** 1 week notice for testing
- **Stakeholders:** 1 week notice
- **Support team:** 1 day notice

**Email template:**

```
Subject: IMPORTANT: orderPaymentMatch Model Deletion - Phase 6

Team,

On [DATE], we will complete the final phase of our payment data migration.

What's happening:
- The orderPaymentMatch model will be permanently deleted
- All functionality now uses the bankTransaction model
- Historical payment match data will no longer be accessible via API

Impact:
- No user-facing changes expected
- Old check information (pre-Phase 4) will not be visible in UI
- All new payment verifications and check issuance continue normally

Rollback plan:
- Available but difficult (requires data restoration)
- We have complete backup of all historical data

Please report any issues immediately to [CONTACT].

Migration timeline:
✅ Phase 1-5: Complete
🚀 Phase 6: Scheduled for [DATE]

Questions? Contact [YOUR NAME]
```

### After Deployment

Send confirmation:

```
Subject: Phase 6 Complete - orderPaymentMatch Migration Finished

Team,

Phase 6 deployment completed successfully at [TIME].

Status:
✅ Model deleted
✅ All tests passing
✅ No errors detected
✅ Production stable

The payment data migration is now complete. All payment matching and check issuance functions are running on the bankTransaction model.

Thank you for your support throughout this migration.
```

---

## Documentation Updates

After successful Phase 6:

### Update These Files:

1. **README.md**

   - Remove any references to `orderPaymentMatch`
   - Update data model documentation

2. **Architecture Docs**

   - Update data model diagrams
   - Update payment flow documentation

3. **API Documentation**

   - Remove `orderPaymentMatch` endpoints (if any were documented)
   - Update payment-related API docs

4. **Migration Plan**
   - Mark `plan.md` as **COMPLETED**
   - Add completion date
   - Link to phase docs for historical reference

---

## Cleanup Tasks

After 1 month of stable operation:

- [ ] Archive phase documentation to `docs/migrations/completed/`
- [ ] Delete backup files from local storage (keep cloud backups)
- [ ] Update team runbooks
- [ ] Remove any temporary monitoring/alerts added for migration
- [ ] Schedule retrospective meeting
- [ ] Document lessons learned

---

## Files Changed

```
api/models/orderPaymentMatch/schema.gadget.ts (DELETED)
api/models/orderPaymentMatch/actions/*.ts (DELETED)
api/models/orderPaymentMatch/ (DELETED - entire directory)
```

**Total: All orderPaymentMatch files deleted**

---

## Implementation Time Estimate

- **Backup & verification:** 1 hour
- **Code changes (deletion):** 30 minutes
- **Testing:** 2 hours
- **Deployment + monitoring:** 2 hours
- **Communication:** 1 hour
- **Total:** ~6.5 hours

---

## Final Notes

### What We Achieved

✅ **Simplified data model**

- Eliminated redundant `orderPaymentMatch` model
- Consolidated payment matching into `bankTransaction`
- Reduced query complexity

✅ **Maintained data integrity**

- Zero data loss during migration
- All historical data backed up
- Smooth transition with no downtime

✅ **Improved maintainability**

- Single source of truth for payment data
- Cleaner codebase
- Easier to understand and debug

### Future Enhancements

Consider adding to `bankTransaction` if needed:

- `checkFiscalCode` (currently not stored)
- `checkReceiptUrl` (currently not stored)
- `matchConfidence` (for debugging)
- `matchNotes` (for admin annotations)
- `verifiedBy` (user who verified)

These can be added incrementally without migration complexity.

---

## Completion Sign-off

After Phase 6 is successfully deployed and stable:

**Deployment Date:** ********\_********

**Deployed By:** ********\_********

**Verified By:** ********\_********

**Sign-off:** ********\_********

---

## 🎉 Migration Complete!

Congratulations! You have successfully completed the migration from `orderPaymentMatch` to `bankTransaction`.

The codebase is now simpler, more maintainable, and follows the principle of "1 bank transaction → 1 check → 1 order".

---

## Quick Reference: Phase Summary

| Phase       | Status          | Purpose                        |
| ----------- | --------------- | ------------------------------ |
| Phase 1     | ✅              | Add fields to bankTransaction  |
| Phase 2     | ✅              | Dual-write to both models      |
| Phase 3     | ✅              | Dual-read with fallback        |
| Phase 4     | ✅              | Write only to bankTransaction  |
| Phase 5     | ✅              | Read only from bankTransaction |
| **Phase 6** | **✅ COMPLETE** | **Delete orderPaymentMatch**   |

**Migration Duration:** [START DATE] → [END DATE]

**Total Phases:** 6

**Data Loss:** None (historical data backed up)

**Production Issues:** None (if all phases followed correctly)

---

**End of Phase 6 Documentation**
