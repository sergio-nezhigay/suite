# Automatic Check Creation Plan Based on Counterpart Account Codes

## Current Payment Flow Analysis

I analyzed your project's payment processing system and found:

### Existing Infrastructure
1. **Bank Transaction Sync** (`syncBankTransactions.ts`): PrivatBank transactions are imported with `counterpartyAccount` field containing the payment codes
2. **Payment Verification** (`verifyOrderPayments.ts`): Orders are matched with bank transactions based on amount/timing, creating `orderPaymentMatch` records
3. **Check Creation** (`POST-createCheckboxReceipts.ts`): Manual checkbox receipt creation using `CheckboxService` and `OrderToReceiptTransformer`
4. **Product Variant Conversion** (`findBestVariant.ts`): Converts real product names to standard Ukrainian variants for fiscal purposes

---

## Plan for Automatic Check Creation Based on Counterpart Codes

### Phase 1: Database Schema Enhancement

**1.1 Create PaymentCheckRequest Model**
- `orderId: string` (reference to order)
- `bankTransactionId: string` (reference to bank transaction)
- `counterpartyAccount: string` (the payment code: 2620, 2924, etc.)
- `status: enum` (pending, processing, completed, failed)
- `checkId: string` (nullable, Checkbox receipt ID after creation)
- `fiscalCode: string` (nullable, fiscal code from receipt)
- `createdAt: dateTime`
- `processedAt: dateTime` (nullable)
- `errorMessage: string` (nullable)

**1.2 Update OrderPaymentMatch Model**
- Add `checkCreated: boolean` (default false)
- Add `checkRequestId: string` (nullable, reference to PaymentCheckRequest)

### Phase 2: Business Logic Implementation

**2.1 Counterpart Account Code Validation**
Create utility function to determine if check is needed:
```typescript
const CODES_REQUIRING_CHECKS = ['2620', '2924', '2650', '2654'];
const CODES_NO_CHECKS = ['2600', '2902', '2909', '2920'];

function requiresCheck(counterpartyAccount: string | null | undefined): boolean {
  if (!counterpartyAccount || counterpartyAccount.trim() === '') {
    return true; // "не указан РС" case
  }
  return CODES_REQUIRING_CHECKS.includes(counterpartyAccount);
}
```

**2.2 Integration Point: Modify verifyOrderPayments.ts**
- After successful payment match creation, check if counterpart account requires a check
- If yes, create `PaymentCheckRequest` record
- Mark `orderPaymentMatch.checkCreated = true` if check request created

**2.3 Check Processing Service**
Create new service `AutoCheckService.ts`:
- Process pending `PaymentCheckRequest` records
- Fetch order details and line items
- Use existing `findBestVariant` for product conversion
- Use existing `CheckboxService` for receipt creation
- Handle success/failure states appropriately

### Phase 3: Workflow Integration

**3.1 Trigger Points**
- **Primary**: During `verifyOrderPayments` execution when order-payment match is established
- **Fallback**: Scheduled background job to process any missed/failed check requests

**3.2 Check Creation Logic**
```
verifyOrderPayments.ts:
├── Match order with bank transaction
├── Create orderPaymentMatch record
├── Check if transaction.counterpartyAccount requires check
├── If yes: Create PaymentCheckRequest
└── Continue with existing Shopify order update

AutoCheckService.processCheckRequests():
├── Find pending PaymentCheckRequest records
├── For each request:
│   ├── Fetch order with line items
│   ├── Transform products using findBestVariant
│   ├── Create check using CheckboxService
│   ├── Update PaymentCheckRequest status
│   └── Update order notes with receipt info
```

### Phase 4: Error Handling & Monitoring

**4.1 Failure Recovery**
- Failed check requests remain in "failed" status with error messages
- Background job retries failed requests (with exponential backoff)
- Manual retry capability through admin interface

**4.2 Duplicate Prevention**
- Check `orderPaymentMatch.checkCreated` flag before creating new requests
- Unique constraint on `PaymentCheckRequest(orderId, bankTransactionId)`

**4.3 Logging & Monitoring**
- Comprehensive logging at each step
- Track success/failure rates
- Monitor pending request queue length

### Phase 5: Implementation Steps

1. **Create PaymentCheckRequest model** in Gadget admin
2. **Update OrderPaymentMatch model** with check tracking fields
3. **Create AutoCheckService utility** with check creation logic
4. **Modify verifyOrderPayments action** to create check requests
5. **Create background job action** for processing check queue
6. **Add error monitoring** and admin interface capabilities

### Key Benefits of This Approach

- **Non-disruptive**: Builds on existing verified payment matching
- **Reliable**: Tracks check creation status and handles failures
- **Flexible**: Easy to modify counterpart code rules
- **Maintainable**: Reuses existing check creation infrastructure
- **Auditable**: Complete trail of check creation requests and outcomes

## Business Rules Summary

### Codes Requiring Check Creation
- `2620`, `2924`, `2650`, `2654`
- Empty/null counterpart account ("не указан РС")

### Codes NOT Requiring Checks
- `2600`, `2902`, `2909`, `2920`

### Check Creation Moment
- **Primary trigger**: When `verifyOrderPayments` successfully matches an order with a bank transaction
- **Context available**: Order details, line items, payment amount, transaction data
- **Product conversion**: Use existing `findBestVariant` function for Ukrainian fiscal variants

This plan ensures checks are created automatically when payment verification confirms a matching transaction with codes requiring receipt generation, while maintaining the existing product variant conversion logic you already have in place.