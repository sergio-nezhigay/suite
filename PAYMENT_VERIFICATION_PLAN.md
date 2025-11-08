# Payment Verification & Check Issuance Feature - Implementation Plan

## Overview
Create a UI to monitor incoming payments (last 7 days) with restricted account codes (2600, 2902, 2909, 2920) that haven't been covered with Checkbox checks. Allow manual check issuance with preview functionality.

## ⚠️ IMPORTANT: After Each Phase
**ALWAYS run `npx tsc --noEmit` after changing .ts/.tsx files to check for TypeScript errors!**
Fix any errors immediately before proceeding to the next phase.

## Implementation Steps

### **Phase 1: Frontend UI Route & Page Structure** ✅ COMPLETED
- [x] **TypeScript check passed** ✅
- [x] Create `/web/routes/payments.tsx` - New route file
- [x] Set up Page component with Polaris UI (Page, Card, Layout)
- [x] Add page title "Payment Verification & Check Issuance"
- [x] Create IndexTable or DataTable component structure

### **Phase 2: Backend Data Retrieval Action** ✅ COMPLETED
- [x] **TypeScript check passed** ✅
- [x] Create `/api/actions/getUncoveredPayments.ts` global action
- [x] Filter bankTransactions (last 7 days, type='income')
- [x] Extract account codes using `account.substring(15, 19)`
- [x] Filter for codes: 2600, 2902, 2909, 2920
- [x] Left join with orderPaymentMatch (checkIssued=false or null)
- [x] Return transaction data with payment match status

### **Phase 3: Frontend Data Display** ✅ COMPLETED
- [x] **TypeScript check passed** ✅
- [x] Use `useGlobalAction` hook to fetch uncovered payments
- [x] Display table columns:
    - Transaction Date
    - Amount (UAH)
    - Counterparty Name
    - Account Code (extracted)
    - Days Ago
    - Action Buttons (Preview, Issue Check)
- [x] Add loading and error states
- [x] Register route in App.jsx
- [x] Add navigation menu link
- [ ] Add pagination controls (deferred - table shows all results for now)

### **Phase 4: Backend Check Preview Logic** ✅ COMPLETED
- [x] **TypeScript check passed** ✅
- [x] Create `/api/actions/previewCheckForPayment.ts` global action
- [x] Implement amount distribution algorithm:
    - If ≤ 1000 UAH: 1 item "Перехідник HDMI to VGA"
    - If > 1000 UAH: Split into multiple items with variable pricing (300-900 UAH range)
    - Weighted random distribution: 60% mid-range (450-700), 20% low (300-450), 20% high (700-900)
    - Prices rounded to nearest 10 UAH for natural appearance
- [x] Return preview data: `{ items: [{ name, quantity, price }], total }`

### **Phase 5: Frontend Preview Modal**
- [ ] **Run TypeScript check after changes** ⚠️
- [ ] Create preview modal component
- [ ] Add "Preview" button to each table row
- [ ] Display products/qty/price table in modal
- [ ] Show total amount verification
- [ ] Add close button (no check creation)

### **Phase 6: Backend Check Creation**
- [ ] **Run TypeScript check after changes** ⚠️
- [ ] Create `/api/actions/issueCheckForPayment.ts` global action
- [ ] Get or create orderPaymentMatch record for transaction
- [ ] Build CheckboxSellReceiptBody using preview logic
- [ ] Call CheckboxService.createSellReceipt() with CASHLESS payment
- [ ] Update orderPaymentMatch with check info (checkIssued, checkReceiptId, etc.)
- [ ] Handle Checkbox errors and retry logic

### **Phase 7: Frontend Check Issuance**
- [ ] **Run TypeScript check after changes** ⚠️
- [ ] Add "Issue Check" button to each table row
- [ ] Wire to `issueCheckForPayment` action using `useGlobalAction`
- [ ] Show loading state during check creation
- [ ] Display success toast with receipt info
- [ ] Handle errors with error toast
- [ ] Refresh table data after successful issuance

### **Phase 8: Polish & Error Handling**
- [ ] **Run TypeScript check after changes** ⚠️
- [ ] Add empty state for "No uncovered payments"
- [ ] Add manual refresh button
- [ ] Implement proper TypeScript types for all actions
- [ ] Add console.log debugging statements (per CLAUDE.md)

### **Phase 9: Testing & Validation**
- [ ] Run `npx tsc --noEmit` to check TypeScript errors
- [ ] Test with small amounts (< 1000 UAH)
- [ ] Test with medium amounts (1000-3000 UAH)
- [ ] Test with large amounts (> 5000 UAH)
- [ ] Verify variable pricing distribution looks natural
- [ ] Test Checkbox API error scenarios
- [ ] Verify pagination works correctly
- [ ] Test preview modal display accuracy

## Technical Decisions

- **Route**: `/payments` (similar to `/feeds`, `/Universal`)
- **UI Framework**: Polaris (IndexTable, Modal, Button, Badge, Toast)
- **Data Fetching**: Gadget `useGlobalAction` hooks (not manual fetch)
- **Product**: "Перехідник HDMI to VGA" (from existing variants)
- **Price Range**: 300-900 UAH per item for natural distribution
- **Payment Type**: CASHLESS
- **Restricted Codes**: 2600, 2902, 2909, 2920
- **Date Range**: 7 days (configurable if needed)

## Files to Create/Modify

**New Files:**
- `web/routes/payments.tsx` - Main UI route
- `api/actions/getUncoveredPayments.ts` - Fetch payments action
- `api/actions/previewCheckForPayment.ts` - Preview check items
- `api/actions/issueCheckForPayment.ts` - Create Checkbox receipt

**Files to Reference:**
- `api/utilities/fiscal/checkboxService.ts` - CheckboxService class
- `api/utilities/fiscal/checkboxTypes.ts` - TypeScript types
- `api/actions/verifyOrderPayments.ts` - Pattern reference for check creation

## Success Criteria

✅ Table shows only payments with codes 2600, 2902, 2909, 2920 without checks
✅ Preview button shows accurate item breakdown with variable pricing
✅ Issue Check button creates valid Checkbox receipts
✅ Large amounts (> 1000 UAH) split into multiple items naturally
✅ No TypeScript errors
✅ Proper error handling and user feedback
✅ Data refreshes after check issuance
