# Payment Verification Plan for Shopify Extension

## Current Infrastructure Overview

### Bank Module
- **`fetchPrivatBankTransactions.ts`** - PrivatBank API integration for fetching transactions
- **`syncBankTransactions.ts`** - Automated sync of bank transactions with scheduled runs
- **Data Model**: `BankTransaction` with fields:
  - amount, currency, description
  - counterpartyAccount, counterpartyName
  - transactionDateTime, externalId
  - rawData, status, syncedAt

### Payments Extension
- **Current**: Basic admin action extension targeting `admin.order-index.selection-action.render`
- **Location**: `extensions/payments/src/ActionExtension.tsx`
- **Functionality**: Simple test interface with Done/Close buttons

### Order System
- **Full Shopify order management** with financial status tracking
- **Models**: shopifyOrder with financial status fields
- **Integration**: processDeclarationOrders.ts for fulfillment automation

## Proposed Implementation Plan

### Phase 1: Backend Payment Matching Logic

#### 1.1 Create Payment Verification Action
**File**: `api/actions/verifyOrderPayments.ts`

**Input**: Array of selected order IDs
**Logic**: Match orders to bank transactions using:
- Order total amount vs transaction amount
- Order creation date vs transaction date (within tolerance)
**Output**: Payment status for each order

**Key Functions**:
```typescript
- fetchSelectedOrders(orderIds)
- fetchRecentBankTransactions(dateRange)
- performPaymentMatching(orders, transactions)
- updateOrderPaymentStatus(matches)
- returnVerificationResults()
```

#### 1.2 Create Order-BankTransaction Relation Model
**Model**: `orderPaymentMatch`
**Purpose**: Link orders with bank transactions
**Fields**:
- orderId (relation to shopifyOrder)
- bankTransactionId (relation to bankTransaction)
- matchConfidence (number 0-100)
- verifiedAt (dateTime)
- matchedBy (enum: auto, manual)
- notes (string, optional)

### Phase 2: Enhanced Payments Extension UI

#### 2.1 Upgrade ActionExtension.tsx
**New Features**:
- Display selected orders with current payment status
- Show "Check Payments" button
- Display matching results with confidence levels
- Allow manual confirmation of uncertain matches
- Show bank transaction details for matched payments
- Progress indicators during verification process

**UI Components**:
- Order list with payment status indicators
- Match results table with confidence scores
- Manual confirmation dialogs
- Bank transaction detail views

### Phase 3: Order Status Integration

#### 3.1 Order Updates When Payment Verified
- Update Shopify order financial status to "paid"
- Add payment verification tags to orders
- Create order notes documenting payment verification
- Update internal tracking fields

#### 3.2 Payment Status Tracking
- Add custom fields to track verification status
- Implement status history for audit trail
- Integration with existing order processing workflow

### Phase 4: Automated Monitoring

#### 4.1 Background Payment Verification Job
**File**: `api/actions/autoVerifyPayments.ts`
**Schedule**: Run every 2 hours
**Logic**:
- Check recent orders (last 7 days) without payment verification
- Match against new bank transactions
- Auto-verify high-confidence matches
- Flag uncertain matches for manual review

#### 4.2 Dashboard Integration
- Payment verification analytics
- Pending verification queue
- Match accuracy reporting
- Exception handling dashboard

## Key Matching Criteria

### Primary Matching Logic
1. **Amount Matching**
   - Exact amount match (highest confidence)
   - Amount within 1% tolerance (high confidence)
   - Amount within 5% tolerance (medium confidence)

2. **Date Proximity**
   - Transaction within 1 day of order (highest confidence)
   - Transaction within 3 days of order (high confidence)
   - Transaction within 7 days of order (medium confidence)

3. **Currency Consistency**
   - Must match order currency
   - Handle currency conversion if needed

### Confidence Scoring
- **90-100%**: Auto-verify (exact amount + date within 1 day)
- **80-89%**: Auto-verify (amount within 1% + date within 3 days)
- **70-79%**: Flag for quick manual review (amount within 5% + date within 7 days)
- **50-69%**: Flag for detailed manual review (loose amount/date matching)
- **Below 50%**: No automatic suggestion

## Implementation Stages (Independent & Incremental)

### 🎯 **FINAL TARGET**: Complete automated payment verification system with manual override capabilities

---

### **Stage 1: Basic Manual Verification** (Week 1)
**Goal**: Simple manual payment checking via extension
**Deliverables**:
- Basic `verifyOrderPayments.ts` action (amount + date matching only)
- Upgraded payments extension UI showing match results
- Simple console logging of results

**Value**: Immediate manual payment verification capability
**Dependencies**: None - uses existing infrastructure

---

### **Stage 2: Data Persistence** (Week 2)
**Goal**: Store verification results permanently
**Deliverables**:
- `orderPaymentMatch` model creation
- Update verification action to save matches to database
- Extension shows historical verification status

**Value**: Persistent record of payment verifications
**Dependencies**: Stage 1 completed

---

### **Stage 3: Order Status Integration** (Week 3)
**Goal**: Automatically update Shopify orders when payment verified
**Deliverables**:
- Update order financial status to "paid"
- Add payment verification tags
- Create order timeline notes

**Value**: Orders automatically marked as paid when payment found
**Dependencies**: Stage 2 completed

---

### **Stage 4: Confidence-Based Auto-Verification** (Week 4)
**Goal**: Automatically verify high-confidence matches
**Deliverables**:
- Implement confidence scoring algorithm
- Auto-verify 90%+ confidence matches
- Flag uncertain matches for manual review

**Value**: Reduces manual verification workload
**Dependencies**: Stage 3 completed

---

### **Stage 5: Background Monitoring** (Week 5-6)
**Goal**: Automated payment checking for new orders/transactions
**Deliverables**:
- `autoVerifyPayments.ts` scheduled action
- Check recent orders against new transactions
- Dashboard for pending verifications

**Value**: Hands-off payment verification for most orders
**Dependencies**: Stage 4 completed

---

### **Stage 6: Advanced Features** (Week 7+)
**Goal**: Enhanced matching and reporting
**Deliverables**:
- Improved matching algorithms
- Analytics dashboard
- Bulk verification tools
- Error handling and recovery

**Value**: Production-ready robust system
**Dependencies**: Stage 5 completed

---

## Stage Independence Benefits

✅ **Each stage delivers immediate value**
✅ **Can pause/pivot at any stage**
✅ **Incremental complexity - easier debugging**
✅ **Early user feedback incorporation**
✅ **Risk mitigation - smaller changes**

## Quick Start Recommendation

**Start with Stage 1** - you'll have working payment verification in ~1 week, then decide if you want to continue based on results.

---

## Detailed Stage Implementation Plans

### **STAGE 1: Basic Manual Verification**

#### Files to Create/Modify:
1. **`api/actions/verifyOrderPayments.ts`**
   ```typescript
   // Basic implementation
   export const run = async ({ params, api }: any) => {
     const { orderIds } = params;

     // Fetch selected orders
     const orders = await api.shopifyOrder.findMany({
       filter: { id: { in: orderIds } }
     });

     // Fetch recent bank transactions (last 30 days)
     const transactions = await api.bankTransaction.findMany({
       filter: {
         transactionDateTime: {
           greaterThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
         }
       }
     });

     // Simple matching logic
     const results = orders.map(order => {
       const matches = transactions.filter(tx =>
         Math.abs(tx.amount - order.totalPrice) < 0.01 && // Exact amount
         Math.abs(new Date(tx.transactionDateTime) - new Date(order.createdAt)) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
       );

       return {
         orderId: order.id,
         orderName: order.name,
         orderAmount: order.totalPrice,
         matches: matches.map(tx => ({
           transactionId: tx.id,
           amount: tx.amount,
           date: tx.transactionDateTime,
           description: tx.description
         }))
       };
     });

     return { success: true, results };
   };
   ```

2. **`extensions/payments/src/ActionExtension.tsx`**
   ```typescript
   // Enhanced UI with verification results
   - Add state for verification results
   - Add "Check Payments" button
   - Display results table with matches
   - Show order details and matched transactions
   ```

#### Expected Output:
- Extension shows orders with their payment matches
- Console logging of verification process
- Manual review of all matches

---

### **STAGE 2: Data Persistence**

#### Files to Create/Modify:
1. **`api/models/orderPaymentMatch/schema.gadget.ts`**
   ```typescript
   export const schema: GadgetModel = {
     type: "gadget/model-schema/v1",
     fields: {
       orderId: { type: "string", validations: { required: true } },
       bankTransactionId: { type: "string", validations: { required: true } },
       matchConfidence: { type: "number", validations: { numberRange: { min: 0, max: 100 } } },
       verifiedAt: { type: "dateTime", includeTime: true },
       matchedBy: {
         type: "enum",
         options: ["auto", "manual"],
         validations: { required: true }
       },
       notes: { type: "string" }
     }
   };
   ```

2. **Update `verifyOrderPayments.ts`**
   ```typescript
   // Add database saving logic
   - Save verification results to orderPaymentMatch
   - Check existing verifications before processing
   - Return historical verification status
   ```

3. **Update Extension UI**
   ```typescript
   // Show historical verification status
   - Display previous verification results
   - Show when order was last checked
   - Indicate if payment already verified
   ```

#### Expected Output:
- Persistent verification records
- Historical view of payment checks
- Prevent duplicate verifications

---

### **STAGE 3: Order Status Integration**

#### Files to Create/Modify:
1. **Update `verifyOrderPayments.ts`**
   ```typescript
   // Add Shopify order updates
   - Update financial status to "paid"
   - Add "payment-verified" tag
   - Create order timeline note
   - Use Shopify GraphQL mutations
   ```

2. **Create order update utilities**
   ```typescript
   // api/utilities/shopifyOrderUpdates.ts
   - updateOrderFinancialStatus()
   - addOrderTags()
   - createOrderNote()
   ```

#### Expected Output:
- Orders automatically marked as "paid" in Shopify
- Payment verification tags added
- Timeline notes documenting verification

---

### **STAGE 4: Confidence-Based Auto-Verification**

#### Files to Create/Modify:
1. **Create matching algorithm**
   ```typescript
   // api/utilities/paymentMatching.ts
   - calculateMatchConfidence()
   - Implementation of confidence scoring:
     * 100%: Exact amount + date within 1 day
     * 90%: Exact amount + date within 3 days
     * 80%: Amount within 1% + date within 3 days
     * 70%: Amount within 5% + date within 7 days
   ```

2. **Update `verifyOrderPayments.ts`**
   ```typescript
   // Add auto-verification logic
   - Auto-verify matches with 90%+ confidence
   - Flag 70-89% matches for manual review
   - Skip matches below 70% confidence
   ```

3. **Enhanced Extension UI**
   ```typescript
   // Show confidence levels
   - Color-coded confidence indicators
   - Auto-verified vs manual review sections
   - Confidence score display
   ```

#### Expected Output:
- High-confidence matches automatically verified
- Uncertain matches flagged for review
- Confidence scores displayed in UI

---

### **STAGE 5: Background Monitoring**

#### Files to Create/Modify:
1. **`api/actions/autoVerifyPayments.ts`**
   ```typescript
   // Scheduled background verification
   export const run = async ({ api }: any) => {
     // Find recent unverified orders
     const recentOrders = await api.shopifyOrder.findMany({
       filter: {
         createdAt: { greaterThan: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
         financialStatus: { notEquals: "paid" }
       }
     });

     // Check against recent transactions
     // Auto-verify high-confidence matches
     // Log results for monitoring
   };

   export const options = {
     triggers: {
       scheduler: [{ cron: '0 */2 * * *' }] // Every 2 hours
     }
   };
   ```

2. **Create monitoring dashboard utilities**
   ```typescript
   // api/utilities/verificationDashboard.ts
   - getPendingVerifications()
   - getVerificationStats()
   - getRecentActivity()
   ```

#### Expected Output:
- Automatic verification every 2 hours
- Dashboard showing pending verifications
- Minimal manual intervention needed

---

### **STAGE 6: Advanced Features**

#### Files to Create/Modify:
1. **Enhanced matching algorithms**
   ```typescript
   // Improved matching logic
   - Currency conversion handling
   - Multiple payment splitting
   - Partial payment detection
   ```

2. **Analytics and reporting**
   ```typescript
   // Verification analytics
   - Match accuracy reporting
   - Performance metrics
   - Error tracking and alerts
   ```

3. **Bulk operations**
   ```typescript
   // Bulk verification tools
   - Batch verification of historical orders
   - Bulk manual confirmation
   - Export/import verification data
   ```

#### Expected Output:
- Production-ready robust system
- Comprehensive analytics
- Advanced matching capabilities
- Bulk operation tools

---

## Stage Completion Checklist

### Stage 1 ✅
- [ ] Basic verifyOrderPayments.ts created
- [ ] Extension UI shows verification results
- [ ] Manual payment verification working
- [ ] Console logging functional

### Stage 2 ✅
- [ ] orderPaymentMatch model created
- [ ] Verification results saved to database
- [ ] Historical verification display
- [ ] Duplicate prevention

### Stage 3 ✅
- [ ] Shopify order status updates
- [ ] Payment verification tags
- [ ] Order timeline notes
- [ ] Shopify GraphQL integration

### Stage 4 ✅
- [ ] Confidence scoring algorithm
- [ ] Auto-verification for high confidence
- [ ] Manual review flagging
- [ ] UI confidence indicators

### Stage 5 ✅
- [ ] Background verification job
- [ ] Scheduled execution
- [ ] Monitoring dashboard
- [ ] Automated workflow

### Stage 6 ✅
- [ ] Advanced matching features
- [ ] Analytics dashboard
- [ ] Bulk operations
- [ ] Production optimizations

## Technical Considerations

### Performance
- Limit transaction search to recent timeframes
- Implement caching for frequently accessed data
- Use database indexes for efficient matching queries

### Security
- Validate all order access permissions
- Audit trail for all payment verification actions
- Secure handling of bank transaction data

### Error Handling
- Graceful handling of API failures
- Rollback mechanisms for incorrect matches
- Comprehensive logging for debugging

### Testing Strategy
- Unit tests for matching algorithms
- Integration tests with sample data
- User acceptance testing with real scenarios

## Integration Points

### Existing Systems
- **Bank Transaction Sync**: Leverage existing PrivatBank integration
- **Order Processing**: Integrate with processDeclarationOrders workflow
- **Extension Framework**: Build on existing Shopify extension architecture

### API Dependencies
- Shopify Admin API for order management
- PrivatBank API for transaction data
- Gadget framework for data persistence

This plan leverages your existing bank transaction infrastructure while adding intelligent payment verification directly into your Shopify admin workflow.