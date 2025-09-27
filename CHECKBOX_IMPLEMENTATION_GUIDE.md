# Checkbox API Integration Implementation Guide

## Overview
This guide implements automatic fiscal receipt generation using the Checkbox.ua API, integrating with existing Shopify orders and Nova Poshta ETTN tracking.

## Prerequisites
- Checkbox.ua account with digital signature
- License key, login credentials from Checkbox
- Existing Shopify extension for order processing

## Implementation Steps

### Step 1: Create Type Definitions
**File**: `api/utilities/fiscal/checkboxTypes.ts`

```typescript
export interface CheckboxAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface CheckboxShift {
  id: string;
  status: string;
  opened_at: string;
}

export interface CheckboxGood {
  good: {
    code: string;
    name: string;
    price: number; // kopecks
  };
  quantity: number; // 1000 = 1 item
  is_return: boolean;
  discounts: any[];
}

export interface CheckboxETTNPayment {
  type: "ETTN";
  value: number; // kopecks
  ettn: string; // Nova Poshta TTN
}

export interface CheckboxReceiptBody {
  goods: CheckboxGood[];
  payments: CheckboxETTNPayment[];
  discounts: any[];
  deliveries: any[];
}

export interface CheckboxReceiptResponse {
  id: string;
  fiscal_code?: string;
  fiscal_date?: string;
  receipt_url?: string;
}
```

### Step 2: Create Checkbox Service
**File**: `api/utilities/fiscal/checkboxService.ts`

```typescript
import { CheckboxAuthResponse, CheckboxShift, CheckboxReceiptBody, CheckboxReceiptResponse } from './checkboxTypes';

export class CheckboxService {
  private baseUrl = 'https://api.checkbox.ua/api/v1';
  private licenseKey: string;
  private login: string;
  private password: string;
  private token?: string;

  constructor() {
    this.licenseKey = process.env.CHECKBOX_LICENSE_KEY!;
    this.login = process.env.CHECKBOX_LOGIN!;
    this.password = process.env.CHECKBOX_PASSWORD!;
  }

  async signIn(): Promise<string> {
    console.log('Signing in to Checkbox API...');

    const response = await fetch(`${this.baseUrl}/cashier/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: this.login,
        password: this.password
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data: CheckboxAuthResponse = await response.json();
    this.token = data.access_token;
    console.log('Successfully authenticated with Checkbox');
    return this.token;
  }

  async openShift(): Promise<CheckboxShift> {
    console.log('Opening new shift...');

    const shiftId = crypto.randomUUID();
    const response = await fetch(`${this.baseUrl}/shifts`, {
      method: 'POST',
      headers: {
        'X-License-Key': this.licenseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ id: shiftId })
    });

    if (!response.ok) {
      throw new Error(`Failed to open shift: ${response.status}`);
    }

    const shift = await response.json();
    console.log('Shift opened successfully:', shift.id);
    return shift;
  }

  async checkShift(): Promise<CheckboxShift> {
    const response = await fetch(`${this.baseUrl}/cashier/shift`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check shift: ${response.status}`);
    }

    return response.json();
  }

  async createETTNReceipt(receiptBody: CheckboxReceiptBody): Promise<CheckboxReceiptResponse> {
    console.log('Creating ETTN receipt...');

    const response = await fetch(`${this.baseUrl}/np/ettn`, {
      method: 'POST',
      headers: {
        'X-License-Key': this.licenseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ receipt_body: receiptBody })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create receipt: ${response.status} - ${errorText}`);
    }

    const receipt = await response.json();
    console.log('Receipt created successfully:', receipt.id);
    return receipt;
  }

  async ensureShiftOpen(): Promise<CheckboxShift> {
    try {
      const shift = await this.checkShift();
      console.log('Active shift found:', shift.id);
      return shift;
    } catch {
      console.log('No active shift, opening new one...');
      return await this.openShift();
    }
  }
}
```

### Step 3: Create Order Transformer
**File**: `api/utilities/fiscal/orderToReceiptTransformer.ts`

```typescript
import { CheckboxReceiptBody, CheckboxGood } from './checkboxTypes';

export class OrderToReceiptTransformer {
  // Ukrainian product variants mapping (from your extension)
  private static productVariants = [
    'Кабель USB консольний',
    'Перехідник HDMI-RCA',
    'Кабель SCART',
    'Перехідник SCART',
    'Перехідник USB-RS232',
    'Кабель USB-RS232 1.5m',
    'Кабель USB-RS232 3 метри',
    'Перехідник HDMI-DP',
    'Кабель USB Type C',
    'Перехідник HDMI-VGA',
    'Термопаста, 2 гр.',
  ];

  static transformOrder(order: any, ettnNumber: string): CheckboxReceiptBody {
    const goods: CheckboxGood[] = order.lineItems.nodes.map((item: any, index: number) => {
      const unitPriceUAH = parseFloat(item.originalUnitPriceSet.shopMoney.amount);
      const priceKopecks = Math.round(unitPriceUAH * 100);

      return {
        good: {
          code: String(index + 1).padStart(4, '0'), // "0001", "0002", etc.
          name: this.mapProductVariant(item.title),
          price: priceKopecks
        },
        quantity: item.quantity * 1000, // Checkbox format: 1000 = 1 item
        is_return: false,
        discounts: []
      };
    });

    const totalAmount = goods.reduce((sum, good) =>
      sum + (good.good.price * good.quantity / 1000), 0
    );

    console.log(`Transforming order ${order.name}: ${goods.length} items, total: ${totalAmount} kopecks`);

    return {
      goods,
      payments: [{
        type: "ETTN",
        value: totalAmount,
        ettn: ettnNumber
      }],
      discounts: [],
      deliveries: []
    };
  }

  private static mapProductVariant(productTitle: string): string {
    const bestMatch = this.findBestVariant(productTitle);
    console.log(`Mapped "${productTitle}" to "${bestMatch}"`);
    return bestMatch;
  }

  private static findBestVariant(productTitle: string): string {
    let bestMatch = this.productVariants[0];
    let bestScore = 0;

    for (const variant of this.productVariants) {
      const score = this.calculateSimilarity(productTitle, variant);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = variant;
      }
    }

    return bestMatch;
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const matrix = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const maxLen = Math.max(s1.length, s2.length);
    return maxLen === 0 ? 1 : (maxLen - matrix[s2.length][s1.length]) / maxLen;
  }
}
```

### Step 4: Create API Route
**File**: `api/routes/POST-createCheckboxReceipts.ts`

```typescript
import { RouteContext } from "gadget-server";
import { CheckboxService } from "utilities/fiscal/checkboxService";
import { OrderToReceiptTransformer } from "utilities/fiscal/orderToReceiptTransformer";

export default async function route({ request, reply, api }: RouteContext) {
  console.log('Checkbox receipts creation request received');

  try {
    const body = await request.json();
    const { orderIds } = body;

    if (!orderIds?.length) {
      return reply.code(400).send({ error: "Order IDs required" });
    }

    console.log(`Processing ${orderIds.length} orders:`, orderIds);

    const checkboxService = new CheckboxService();

    // Step 1: Authenticate
    await checkboxService.signIn();

    // Step 2: Ensure shift is open
    await checkboxService.ensureShiftOpen();

    const results = [];

    // Step 3: Process each order
    for (const orderId of orderIds) {
      try {
        console.log(`Processing order: ${orderId}`);

        // Fetch order details from Shopify
        const order = await api.shopifyOrder.findFirst({
          filter: { id: { equals: orderId } },
          select: {
            id: true,
            name: true,
            lineItems: {
              edges: {
                node: {
                  id: true,
                  title: true,
                  quantity: true,
                  variant: {
                    title: true,
                    sku: true
                  },
                  originalUnitPriceSet: {
                    shopMoney: {
                      amount: true,
                      currencyCode: true
                    }
                  }
                }
              }
            },
            fulfillments: {
              edges: {
                node: {
                  id: true,
                  trackingInfo: true
                }
              }
            },
            metafields: {
              edges: {
                node: {
                  id: true,
                  namespace: true,
                  key: true,
                  value: true
                }
              }
            }
          }
        });

        if (!order) {
          results.push({ orderId, error: "Order not found" });
          continue;
        }

        // Extract Nova Poshta TTN
        const ettnNumber = extractETTNFromOrder(order);
        if (!ettnNumber) {
          results.push({ orderId, error: "No ETTN/tracking number found" });
          continue;
        }

        console.log(`Found ETTN: ${ettnNumber} for order ${order.name}`);

        // Transform order to Checkbox format
        const receiptBody = OrderToReceiptTransformer.transformOrder(order, ettnNumber);

        // Create receipt
        const receipt = await checkboxService.createETTNReceipt(receiptBody);

        // Store receipt reference in order metafields
        await api.shopifyOrder.update(orderId, {
          metafields: {
            create: [{
              namespace: "checkbox",
              key: "receipt_id",
              value: receipt.id,
              type: "single_line_text_field"
            }, {
              namespace: "checkbox",
              key: "fiscal_code",
              value: receipt.fiscal_code || "",
              type: "single_line_text_field"
            }]
          }
        });

        results.push({
          orderId,
          orderName: order.name,
          success: true,
          receiptId: receipt.id,
          fiscalCode: receipt.fiscal_code,
          ettnNumber
        });

        console.log(`Successfully created receipt for order ${order.name}`);

      } catch (error) {
        console.error(`Error processing order ${orderId}:`, error);
        results.push({
          orderId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('Checkbox receipts processing completed:', results);
    return reply.send({ results });

  } catch (error) {
    console.error("Checkbox service error:", error);
    return reply.code(500).send({
      error: error instanceof Error ? error.message : "Service unavailable"
    });
  }
}

function extractETTNFromOrder(order: any): string | null {
  // Extract from fulfillment tracking info
  const trackingNumber = order.fulfillments?.edges?.[0]?.node?.trackingInfo?.[0]?.number;

  if (trackingNumber) {
    return trackingNumber;
  }

  // Fallback: check metafields for tracking number
  const trackingMetafield = order.metafields?.edges?.find((edge: any) =>
    edge.node.key === 'tracking_number' || edge.node.key === 'ettn'
  );

  return trackingMetafield?.node?.value || null;
}
```

### Step 5: Update Extension Frontend
**File**: `extensions/checks/src/ActionExtension.tsx` (modifications)

Add these updates to your existing extension:

```typescript
// Add these interfaces at the top
interface ReceiptResult {
  orderId: string;
  orderName?: string;
  success?: boolean;
  receiptId?: string;
  fiscalCode?: string;
  ettnNumber?: string;
  error?: string;
}

// Add these state variables in the App component
const [processing, setProcessing] = useState(false);
const [receiptResults, setReceiptResults] = useState<ReceiptResult[]>([]);

// Add this function in the App component
const handleProcessChecks = async () => {
  setProcessing(true);
  setReceiptResults([]);

  try {
    console.log('Creating Checkbox receipts for orders:', selectedIds);

    const response = await fetch('/api/createCheckboxReceipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: selectedIds })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    setReceiptResults(data.results);

    console.log('Checkbox receipts results:', data.results);

  } catch (error) {
    console.error('Error creating receipts:', error);
    setReceiptResults([{
      orderId: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }]);
  } finally {
    setProcessing(false);
  }
};

// Update the primaryAction in AdminAction
primaryAction={
  <Button
    onPress={handleProcessChecks}
    disabled={loading || orders.length === 0 || processing}
  >
    {processing ? 'Processing...' : 'Process Checks'}
  </Button>
}

// Add results display after the orders list
{receiptResults.length > 0 && (
  <Section heading="Receipt Results">
    <BlockStack>
      {receiptResults.map((result, index) => (
        <Box key={index}>
          <InlineStack>
            <Box minInlineSize='40%'>
              <Text>
                {result.orderName || result.orderId}
              </Text>
            </Box>
            <Box minInlineSize='60%'>
              {result.success ? (
                <BlockStack>
                  <Badge tone="success">✓ Receipt Created</Badge>
                  {result.fiscalCode && (
                    <Text>Fiscal: {result.fiscalCode}</Text>
                  )}
                  {result.ettnNumber && (
                    <Text>ETTN: {result.ettnNumber}</Text>
                  )}
                </BlockStack>
              ) : (
                <Badge tone="critical">✗ {result.error}</Badge>
              )}
            </Box>
          </InlineStack>
        </Box>
      ))}
    </BlockStack>
  </Section>
)}
```

### Step 6: Environment Configuration
**File**: `.env` (add these variables)

```env
# Checkbox API Configuration
CHECKBOX_LICENSE_KEY=your_license_key_here
CHECKBOX_LOGIN=your_login_here
CHECKBOX_PASSWORD=your_password_here
```

### Step 7: Testing Checklist

1. **Test Authentication**:
   - Verify credentials work with Checkbox API
   - Test token expiration handling

2. **Test Shift Management**:
   - Verify shift opening/checking works
   - Test multiple requests with same shift

3. **Test Receipt Creation**:
   - Test with single order
   - Test with multiple orders
   - Verify ETTN extraction from orders

4. **Test Error Handling**:
   - Orders without tracking numbers
   - Invalid credentials
   - Network failures

5. **Test UI Integration**:
   - Button states during processing
   - Results display
   - Error messages

### Step 8: Deployment Steps

1. **Environment Setup**:
   ```bash
   # Add environment variables to your deployment
   ```

2. **Type Check**:
   ```bash
   npx tsc --noEmit
   ```

3. **Build and Test**:
   ```bash
   npm run build
   npm run dev  # Test in development
   ```

4. **Deploy**:
   ```bash
   # Deploy using your standard process
   ```

## Integration Points

- **Existing Extension**: Uses your current order selection and display
- **Nova Poshta**: Leverages existing ETTN tracking numbers
- **Product Mapping**: Uses your existing Ukrainian variant mapping
- **Order Processing**: Integrates with your Gadget backend

## Success Metrics

- ✅ Automatic receipt generation for orders with ETTN
- ✅ Fiscal codes stored in order metafields
- ✅ Error handling for missing data
- ✅ UI feedback for receipt status
- ✅ Compliance with Ukrainian fiscal requirements

## Troubleshooting

- **Authentication Issues**: Check credentials and license key
- **No ETTN Found**: Verify Nova Poshta integration is working
- **Receipt Creation Failed**: Check shift status and order data
- **UI Not Updating**: Verify API route is accessible

## Next Steps

After implementation:
1. Test with real orders in development
2. Verify fiscal compliance with Ukrainian tax authorities
3. Monitor receipt generation success rates
4. Add PDF receipt download functionality (optional)
5. Set up monitoring and logging for production use