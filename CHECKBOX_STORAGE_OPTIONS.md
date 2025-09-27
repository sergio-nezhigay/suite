# Checkbox Receipt Storage Options

Since metafields are not available on ShopifyOrder, here are the best alternatives:

## Option 1: Custom Gadget Model (Recommended)

Create a new model `CheckboxReceipt` in your Gadget app:

```typescript
// Model: CheckboxReceipt
{
  orderId: string,           // Shopify order ID
  orderName: string,         // Order number (e.g., "#1001")
  receiptId: string,         // Checkbox receipt ID
  fiscalCode: string,        // Fiscal receipt code
  ettnNumber: string,        // Nova Poshta tracking number
  createdAt: datetime,       // When receipt was created
  status: string             // "success" | "failed"
}
```

**Implementation:**
```typescript
// In API route, replace metafields update with:
await api.checkboxReceipt.create({
  orderId: orderId,
  orderName: (order as any).name,
  receiptId: receipt.id,
  fiscalCode: receipt.fiscal_code || "",
  ettnNumber: ettnNumber,
  status: "success"
});
```

## Option 2: Order Notes/Tags

Add receipt info to order notes or tags:

```typescript
// Update order with receipt info in notes
await api.shopifyOrder.update(orderId, {
  note: `${existingNote}\n[Checkbox] Receipt: ${receipt.id}, Fiscal: ${receipt.fiscal_code}`
});

// Or add tags
await api.shopifyOrder.update(orderId, {
  tags: [...existingTags, `checkbox:${receipt.id}`, `fiscal:${receipt.fiscal_code}`]
});
```

## Option 3: Separate Database Table

Create a simple storage table:

```sql
CREATE TABLE checkbox_receipts (
  id SERIAL PRIMARY KEY,
  shopify_order_id VARCHAR(255),
  order_name VARCHAR(255),
  receipt_id VARCHAR(255),
  fiscal_code VARCHAR(255),
  ettn_number VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Option 4: JSON in Order Attributes

Store as JSON in order attributes (if available):

```typescript
await api.shopifyOrder.update(orderId, {
  customAttributes: [
    {
      key: "checkbox_receipts",
      value: JSON.stringify({
        receiptId: receipt.id,
        fiscalCode: receipt.fiscal_code,
        ettnNumber: ettnNumber,
        createdAt: new Date().toISOString()
      })
    }
  ]
});
```

## Option 5: External Storage

Use external storage like Redis, MongoDB, or file system:

```typescript
// Redis example
await redis.hset(`checkbox:order:${orderId}`, {
  receiptId: receipt.id,
  fiscalCode: receipt.fiscal_code,
  ettnNumber: ettnNumber,
  createdAt: new Date().toISOString()
});

// File system example
const receiptData = {
  orderId,
  receiptId: receipt.id,
  fiscalCode: receipt.fiscal_code,
  ettnNumber: ettnNumber
};
await fs.writeFile(`receipts/${orderId}.json`, JSON.stringify(receiptData));
```

## Recommendation

**Option 1 (Custom Gadget Model)** is the best choice because:
- ✅ Integrated with your existing Gadget infrastructure
- ✅ Type-safe with generated APIs
- ✅ Easy to query and display in your admin
- ✅ Persistent and reliable
- ✅ Can be displayed in your extension for order history

Would you like me to implement Option 1 with a custom Gadget model?