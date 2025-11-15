# Migration Phase Documents - Master Index

## Overview

This directory contains detailed, production-ready documentation for each phase of the migration from `orderPaymentMatch` to `bankTransaction` model.

**Migration Goal:** Consolidate payment matching data into the `bankTransaction` model while maintaining the rule: **1 bank transaction → 1 issued check → 1 linked order**

---

## Phase Documents

Each phase document is a **complete, standalone PR guide** containing:

- All code changes required
- Step-by-step implementation instructions
- Comprehensive testing checklists
- Rollback procedures
- Success criteria
- Time estimates

### ✅ Phase 1: Add New Fields to bankTransaction Model

**File:** [`PHASE-1-ADD-FIELDS.md`](./PHASE-1-ADD-FIELDS.md)

**PR Title:** `feat: Add payment matching fields to bankTransaction schema`

**What it does:**

- Adds 4 nullable fields to `bankTransaction`:
  - `matchedOrderId`
  - `checkIssuedAt`
  - `checkReceiptId`
  - `checkSkipReason`
- Pure schema change, zero business logic impact

**Risk:** LOW - Schema-only, all fields nullable

**Time:** ~1 hour (excluding deployment wait)

**Files changed:** 1 file

- `api/models/bankTransaction/schema.gadget.ts`

---

### ✅ Phase 2: Update Write Operations to Dual-Write

**File:** [`PHASE-2-DUAL-WRITE.md`](./PHASE-2-DUAL-WRITE.md)

**PR Title:** `feat: Dual-write payment matching data to bankTransaction`

**What it does:**

- Writes payment data to BOTH `orderPaymentMatch` AND `bankTransaction`
- Ensures data consistency between models
- 5 write locations updated

**Risk:** MEDIUM - Modifies write logic, maintains backward compatibility

**Time:** ~3.5 hours

**Files changed:** 2 files

- `api/actions/verifyOrderPayments.ts` (4 locations)
- `api/actions/issueCheckForPayment.ts` (2 locations)

---

### ✅ Phase 3: Update Read Operations with Fallback

**File:** [`PHASE-3-DUAL-READ.md`](./PHASE-3-DUAL-READ.md)

**PR Title:** `feat: Read payment data from bankTransaction with orderPaymentMatch fallback`

**What it does:**

- Reads from `bankTransaction` FIRST (new data)
- Falls back to `orderPaymentMatch` for historical data
- Logs which source provided data

**Risk:** MEDIUM - Changes read logic, maintains safety net

**Time:** ~5.5 hours

**Files changed:** 3 files

- `api/actions/getUncoveredPayments.ts`
- `api/actions/previewCheckForPayment.ts`
- `api/actions/verifyOrderPayments.ts` (2 locations)

---

### ✅ Phase 4: Remove Dual-Write

**File:** [`PHASE-4-REMOVE-DUAL-WRITE.md`](./PHASE-4-REMOVE-DUAL-WRITE.md)

**PR Title:** `refactor: Remove dual-write, write only to bankTransaction`

**What it does:**

- Stops writing to `orderPaymentMatch`
- Writes ONLY to `bankTransaction`
- No new `orderPaymentMatch` records created

**Risk:** MEDIUM-HIGH - Old data frozen, new data only in new model

**Time:** ~6 hours

**Files changed:** 2 files

- `api/actions/verifyOrderPayments.ts` (4 locations)
- `api/actions/issueCheckForPayment.ts` (2 locations)

**Important:** Metadata fields (matchConfidence, notes, etc.) no longer stored. Acceptable loss for new records.

---

### ✅ Phase 5: Remove Fallback Logic

**File:** [`PHASE-5-REMOVE-FALLBACK.md`](./PHASE-5-REMOVE-FALLBACK.md)

**PR Title:** `refactor: Remove orderPaymentMatch fallback, read only from bankTransaction`

**What it does:**

- Removes all fallback queries
- Reads EXCLUSIVELY from `bankTransaction`
- Simplifies code significantly

**Risk:** MEDIUM - Old data becomes invisible

**Time:** ~4.5 hours

**Files changed:** 4 files

- `api/actions/getUncoveredPayments.ts`
- `api/actions/previewCheckForPayment.ts`
- `api/actions/verifyOrderPayments.ts` (2 locations)
- `api/actions/issueCheckForPayment.ts`

**Important:** Historical check data (pre-Phase 4) will NOT display. This is expected.

---

### ✅ Phase 6: Delete orderPaymentMatch Model

**File:** [`PHASE-6-DELETE-MODEL.md`](./PHASE-6-DELETE-MODEL.md)

**PR Title:** `feat: Remove orderPaymentMatch model - migration complete`

**What it does:**

- Permanently deletes `orderPaymentMatch` model
- Removes all model files
- Completes migration

**Risk:** HIGH - Permanent deletion, difficult rollback

**Time:** ~6.5 hours

**Files changed:** All `orderPaymentMatch` files DELETED

- `api/models/orderPaymentMatch/schema.gadget.ts`
- `api/models/orderPaymentMatch/actions/*.ts`
- `api/models/orderPaymentMatch/` (entire directory)

**Prerequisites:**

- Phase 5 stable for 2+ weeks
- Zero production errors
- Stakeholder approval
- Complete data backup

---

## Migration Timeline

### Recommended Schedule

**Phase 1:** Week 1, Day 1

- Low risk, quick deployment
- Monitor for 1-2 days

**Phase 2:** Week 1, Day 3

- Deploy to production
- Monitor for 1 week

**Phase 3:** Week 2, Day 1

- Deploy to production
- Monitor for 1 week
- Verify fallback logs

**Phase 4:** Week 3, Day 1

- Deploy to production
- Monitor closely for 2 weeks
- Verify no new orderPaymentMatch records

**Phase 5:** Week 5, Day 1

- Deploy to production
- Monitor closely for 2-4 weeks
- Communicate old data visibility loss

**Phase 6:** Week 8-10

- ONLY after Phase 5 fully stable
- Requires stakeholder sign-off
- Backup all data first

**Total Migration Time:** 8-10 weeks (with adequate monitoring periods)

---

## Success Metrics

Track these throughout migration:

### Data Consistency

- [ ] Phase 2+: orderPaymentMatch and bankTransaction have matching data
- [ ] Phase 4+: No new orderPaymentMatch records created
- [ ] Phase 5+: Zero orderPaymentMatch queries in logs

### System Stability

- [ ] Error rate unchanged
- [ ] Response times acceptable
- [ ] All payment flows functional
- [ ] Check issuance working (auto + manual)

### Code Quality

- [ ] All tests passing
- [ ] No lint errors
- [ ] Documentation updated
- [ ] Code simplified (post Phase 5)

---

## Rollback Strategy by Phase

| Phase | Rollback Difficulty | Data Loss Risk | Method                               |
| ----- | ------------------- | -------------- | ------------------------------------ |
| 1     | Easy                | None           | Remove fields from schema            |
| 2     | Easy                | None           | Revert commits                       |
| 3     | Easy                | None           | Revert commits                       |
| 4     | Medium              | None           | Revert to Phase 2, verify dual-write |
| 5     | Medium              | None           | Revert to Phase 3, verify fallback   |
| 6     | **HARD**            | **HIGH**       | Restore model + data from backup     |

---

## Testing Strategy

### Per-Phase Testing

Each phase includes:

- **Functional tests** - Feature-specific validation
- **Integration tests** - End-to-end flows
- **Data validation tests** - Consistency checks
- **Edge case tests** - Error handling
- **Backward compatibility tests** - Old data access
- **Performance tests** - Response time checks

### Regression Testing

Before each phase deployment:

- [ ] All payment verification flows
- [ ] All check issuance flows
- [ ] Payment status display
- [ ] Order updates
- [ ] UI components

### Production Validation

After each phase deployment:

- [ ] Monitor logs for 24 hours
- [ ] Check error rates
- [ ] Verify data consistency
- [ ] Test key user flows manually

---

## Key Files Involved

### Models

```
api/models/bankTransaction/schema.gadget.ts (MODIFIED - Phase 1)
api/models/orderPaymentMatch/schema.gadget.ts (DELETED - Phase 6)
```

### Actions

```
api/actions/verifyOrderPayments.ts (MODIFIED - Phases 2, 3, 4, 5)
api/actions/issueCheckForPayment.ts (MODIFIED - Phases 2, 4, 5)
api/actions/getUncoveredPayments.ts (MODIFIED - Phases 3, 5)
api/actions/previewCheckForPayment.ts (MODIFIED - Phases 3, 5)
```

### UI (No changes in phases, but reads modified data)

```
web/routes/payments.tsx (Reads data via actions)
```

---

## Communication Plan

### Before Each Phase

Send notice to:

- Development team (3 days before)
- QA team (1 week before for testing)
- Stakeholders (when relevant)
- Support team (1 day before)

### After Each Phase

Confirm:

- Deployment success
- Test results
- Any issues encountered
- Next phase timeline

### Special Communications

**Phase 4:** Announce that new data only goes to bankTransaction

**Phase 5:** Warn that old data visibility will be lost

**Phase 6:** Require explicit stakeholder sign-off

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Error Rate**

   - Watch for spikes after deployment
   - Set up alerts for > 1% increase

2. **Query Performance**

   - Monitor bankTransaction query times
   - Alert if queries > 500ms

3. **Data Consistency** (Phase 2-3)

   - Daily job to compare models
   - Alert on discrepancies

4. **Write Patterns** (Phase 4+)

   - Monitor orderPaymentMatch writes
   - Alert if any detected

5. **Read Patterns** (Phase 5+)
   - Monitor orderPaymentMatch reads
   - Alert if any detected

### Log Messages to Monitor

```
Phase 2+: "dual-write", "Database updated"
Phase 3: "from bankTransaction (new data)", "from orderPaymentMatch (old data)"
Phase 4: "Updated bankTransaction", "No longer create orderPaymentMatch"
Phase 5: "Check status from bankTransaction"
Phase 6: "ERROR: Model still exists" (should NOT see this)
```

---

## Common Issues & Solutions

### Issue 1: Data Inconsistency (Phase 2-3)

**Symptoms:** bankTransaction and orderPaymentMatch have different values

**Solution:**

```typescript
// Find discrepancies
const allMatches = await api.orderPaymentMatch.findMany({});
for (const match of allMatches) {
  const txn = await api.bankTransaction.findFirst({
    filter: { id: { equals: match.bankTransactionId } },
  });

  // Compare values
  if (txn.matchedOrderId !== match.orderId) {
    console.log('Mismatch:', txn.id);
  }
}
```

### Issue 2: Performance Degradation (Any Phase)

**Symptoms:** Slow API responses

**Solution:**

- Add database indexes
- Batch operations
- Optimize queries
- Consider caching

### Issue 3: Missing Data (Phase 5+)

**Symptoms:** Old checks not displaying

**Expected:** This is normal after Phase 5

**Solution:**

- Document as known limitation
- Keep backup accessible for manual lookups
- Consider one-time data migration if critical

### Issue 4: Rollback Needed (Phase 6)

**Symptoms:** Critical functionality broken

**Solution:**

- Restore model from backup (see Phase 6 rollback plan)
- Revert to Phase 5 code
- Investigate root cause
- Consider staying at Phase 5 permanently

---

## FAQ

### Q: Can we skip phases?

**A:** NO. Each phase depends on the previous one. Skipping phases risks data loss and system instability.

### Q: How long should we wait between phases?

**A:** Minimum wait times:

- Phase 1 → 2: 1-2 days
- Phase 2 → 3: 1 week
- Phase 3 → 4: 1 week
- Phase 4 → 5: 2 weeks
- Phase 5 → 6: 2-4 weeks

### Q: What if we find issues in Phase 4?

**A:** Rollback to Phase 2 (dual-write). All data is still being written to both models, so rollback is safe.

### Q: Can we stay at Phase 5 permanently?

**A:** Yes! Phase 5 is a stable state. Only proceed to Phase 6 if you're certain you want to delete the old model.

### Q: What happens to old data after Phase 6?

**A:** It's permanently deleted from the database. Only the backup JSON file remains.

### Q: Can we add fields to bankTransaction later?

**A:** Yes! You can add fields like `checkFiscalCode`, `checkReceiptUrl`, `matchConfidence`, etc. anytime.

---

## Success Criteria for Complete Migration

### Technical

- ✅ All 6 phases deployed successfully
- ✅ Zero production errors
- ✅ All tests passing
- ✅ Code simplified and maintainable
- ✅ Single source of truth (bankTransaction)

### Business

- ✅ All payment flows functional
- ✅ Check issuance working correctly
- ✅ No user complaints
- ✅ Performance acceptable or improved
- ✅ Stakeholders satisfied

### Documentation

- ✅ All phase docs complete
- ✅ README updated
- ✅ Architecture docs updated
- ✅ API docs updated
- ✅ Lessons learned documented

---

## Post-Migration

### Cleanup Tasks

After 1 month of stable Phase 6:

- [ ] Archive phase docs
- [ ] Delete local backups (keep cloud)
- [ ] Update team runbooks
- [ ] Remove migration-specific monitoring
- [ ] Schedule retrospective

### Future Enhancements

Consider adding to `bankTransaction`:

- `checkFiscalCode` (for Checkbox receipts)
- `checkReceiptUrl` (for direct links)
- `matchConfidence` (for debugging)
- `verifiedBy` (user tracking)
- `matchNotes` (admin annotations)

### Lessons Learned

Document:

- What went well
- What could be improved
- Unexpected issues
- Time estimates vs actual
- Recommendations for future migrations

---

## Quick Reference Card

### Phase Checklist

```
□ Phase 1: Add fields          [Risk: LOW]    [~1 hr]
□ Phase 2: Dual-write          [Risk: MED]    [~3.5 hrs]
□ Phase 3: Dual-read           [Risk: MED]    [~5.5 hrs]
□ Phase 4: Remove dual-write   [Risk: MED-HIGH] [~6 hrs]
□ Phase 5: Remove fallback     [Risk: MED]    [~4.5 hrs]
□ Phase 6: Delete model        [Risk: HIGH]   [~6.5 hrs]
```

### Emergency Contacts

- **Tech Lead:** [NAME]
- **Database Admin:** [NAME]
- **Stakeholder:** [NAME]
- **On-call:** [ROTATION]

### Quick Commands

```powershell
# Search for references
git grep -n "orderPaymentMatch"

# Check model exists
# (In Gadget API)
api.orderPaymentMatch.findFirst({})

# Verify Phase 2+ data consistency
# (In Gadget API)
api.bankTransaction.findFirst({
  filter: { matchedOrderId: { isSet: true } }
})
```

---

## Document Maintenance

**Last Updated:** [DATE]

**Maintained By:** [YOUR NAME]

**Review Schedule:** After each phase deployment

**Version:** 1.0

---

## License & Usage

These documents are internal migration guides. Use as templates for similar migrations.

**Attribution:** Based on migration plan in `plan.md`

**Contributors:** [TEAM MEMBERS]

---

**End of Master Index**

For detailed implementation steps, refer to individual phase documents (PHASE-1 through PHASE-6).
