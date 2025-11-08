# CLAUDE.md

This file provides guidance to Claude Code when working with this Gadget-based Shopify app.

## Build Commands

- **Development**: `npm run dev` or `yarn dev` - Shopify app dev server
- **Build**: `npm run build` or `yarn build` - Production build with Vite
- **Gadget Dev**: `npm run ggt` or `yarn ggt` - Gadget development environment
- **Shopify CLI**: `npm run shopify` - Access Shopify CLI tools

## Project Architecture

**Gadget-based Shopify app** with multi-supplier integration and e-commerce functionality.

**Core Structure:**
- `/api/` - Gadget framework backend (TypeScript)
- `/web/` - React frontend with Polaris UI
- `/api/utilities/` - Business logic modules

**Path Aliases** (tsconfig.json):
- `utilities` → `api/utilities`
- `routes/*` → `api/routes`
- `types/*` → `api/types`

**Key Integrations:**
- Multi-supplier system: Brain, Rozetka, Easy, Schusev (in `/api/utilities/suppliers/`)
- AI features: OpenAI embeddings, product recommendations (in `/api/utilities/ai/`)
- Logistics: Nova Poshta API integration
- Token management: Singleton pattern for Rozetka (auto-refresh with buffer)

---

## CRITICAL: Gadget Development Patterns

### 1. Frontend Data Fetching - ALWAYS Use Gadget Hooks

❌ **NEVER** use manual `fetch()` calls for Gadget actions/models

✅ **ALWAYS** use Gadget React hooks:

```typescript
// Global Actions
import { useGlobalAction } from '@gadgetinc/react';
import { api } from '../api';

const [{ data, fetching, error }, runAction] = useGlobalAction(api.myGlobalAction);
const result = await runAction({ param1: 'value' });

// Model Actions (Create/Update/Delete)
import { useAction } from '@gadgetinc/react';

const [{ data, fetching, error }, create] = useAction(api.todo.create);
await create({ title: 'New todo' });

const [{ data, fetching, error }, update] = useAction(api.todo.update);
await update({ id: '123', title: 'Updated' });

// Reading Data
import { useFindMany, useFindOne } from '@gadgetinc/react';

const [{ data, fetching, error }, refetch] = useFindMany(api.todo, {
  filter: { completed: { equals: false } },
  sort: { createdAt: 'Descending' },
  first: 10
});

const [{ data, fetching, error }] = useFindOne(api.todo, '123');

// Backend Routes
import { useFetch } from '@gadgetinc/react';

const [{ data, fetching, error }, makeRequest] = useFetch('/api/my-route');
const result = await makeRequest({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'value' })
});
```

### 2. Backend API Calls - Use API from Context

✅ **ALWAYS** destructure `api` from context in actions/routes:

```typescript
export const run: ActionRun = async ({ api, logger, params }) => {
  // Read data with select for performance
  const todos = await api.todo.findMany({
    filter: { completed: { equals: false } },
    select: {
      id: true,
      title: true,
      category: { id: true, name: true } // Related data
    }
  });

  // Create with relationship
  const newTodo = await api.todo.create({
    title: 'New task',
    category: { _link: 'category-id-123' } // belongsTo relationship
  });

  // Update
  await api.todo.update('456', { completed: true });

  // Delete
  await api.todo.delete('789');
};
```

### 3. Background Jobs Pattern

✅ **ALWAYS** enqueue long-running operations:

```typescript
// Enqueue actions to run in background (avoids timeouts)
await api.enqueue(api.todo.create, { title: 'Background task' });
await api.enqueue(api.sendWelcomeEmail, { userId: '123' });
```

### 4. Shopify Integration

✅ **Get Shopify client** from connections:

```typescript
export const run: ActionRun = async ({ connections, logger }) => {
  // Current shop
  const shopify = await connections.shopify.current;

  // OR specific shop
  const shopify = await connections.shopify.forShopId('shop-id-123');

  // Make GraphQL calls
  const result = await shopify.graphql(`
    query {
      products(first: 10) {
        edges {
          node {
            id
            title
          }
        }
      }
    }
  `);
};
```

✅ **ALWAYS** use `writeToShopify` for mutations (rate limit safe):

```typescript
export const onSuccess: ActionOnSuccess = async ({ api, record }) => {
  await api.enqueue(api.writeToShopify, {
    shopId: record.shopId,
    mutation: `
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id title }
        }
      }
    `,
    variables: {
      input: {
        id: `gid://shopify/Product/${record.id}`,
        title: 'Updated Title'
      }
    }
  });
};
```

### 5. Model Action Structure

✅ **Standard pattern** for model actions:

```typescript
import { applyParams, save, preventCrossShopDataAccess, ActionRun } from "gadget-server";

export const run: ActionRun = async ({ api, record, params, logger, session }) => {
  // 1. Apply params
  applyParams(params, record);

  // 2. Tenancy check (multi-tenant apps)
  await preventCrossShopDataAccess(params, record);

  // 3. Custom logic BEFORE save
  if (record.changed("status")) {
    logger.info({ newStatus: record.status }, "Status changed");
  }

  // 4. Save the record
  await save(record);

  // 5. Post-save logic (still in transaction)
};

export const onSuccess: ActionOnSuccess = async ({ api, record, logger }) => {
  // Runs AFTER transaction commits
  // Perfect for side effects (emails, webhooks, etc.)
  await api.enqueue(api.sendNotification, { recordId: record.id });
};
```

### 6. Access Control - Multi-Tenant Tenancy

✅ **Filter by shop** in access control (e.g., `shopifyOrder.gelly`):

```gelly
filter ($session: Session) on shopifyOrder [
  where shop == $session.shop
]
```

✅ **Backend enforcement**:

```typescript
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record }) => {
  await preventCrossShopDataAccess(params, record);
  // Throws error if cross-shop access attempted
};
```

### 7. Logging - ALWAYS Use Logger

✅ **Structured logging** (not console.log):

```typescript
export const run: ActionRun = async ({ logger, api }) => {
  logger.info({ userId: '123' }, 'Starting process');

  try {
    const result = await api.todo.create({ title: 'Test' });
    logger.info({ todoId: result.id }, 'Created successfully');
    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to create todo');
    throw error;
  }
};

// Good - structured data
logger.info({ orderId: '123', amount: 100 }, 'Order processed');

// Bad - avoid string interpolation
// logger.info('Order 123 processed');
```

### 8. Relationships

✅ **belongsTo** - use `_link`:

```typescript
await api.todo.create({
  title: 'My task',
  category: { _link: 'category-id-123' }
});

// In model actions
record.categoryId = 'category-id-123';
await save(record);
```

✅ **Reading relationships** with select:

```typescript
const todos = await api.todo.findMany({
  select: {
    id: true,
    title: true,
    category: { id: true, name: true },
    comments: {
      edges: {
        node: { id: true, body: true }
      }
    }
  }
});
```

### 9. Pagination

✅ **Cursor-based pagination**:

```typescript
// First page
const firstPage = await api.todo.findMany({
  first: 50, // Max 250
  sort: { createdAt: 'Descending' }
});

// Next page
const nextPage = await api.todo.findMany({
  first: 50,
  after: firstPage.endCursor,
  sort: { createdAt: 'Descending' }
});
```

### 10. Environment Variables

✅ **Backend** - use `config`:

```typescript
export const run: ActionRun = async ({ config, logger }) => {
  const apiKey = config.MY_API_KEY;
  if (!apiKey) throw new Error('MY_API_KEY not configured');
};
```

✅ **Frontend** - requires `GADGET_PUBLIC_*` prefix:

```typescript
const publicValue = process.env.GADGET_PUBLIC_FEATURE_FLAG;
```

### 11. AutoComponents for Quick CRUD UI

```typescript
import { AutoTable, AutoForm } from "@gadgetinc/react/auto/polaris";
import { api } from "../api";

// AutoTable for listings
<AutoTable
  model={api.todo}
  columns={[
    "id",
    "title",
    "category.name",
    {
      header: "Custom",
      render: ({ record }) => <Badge>{record.status}</Badge>
    }
  ]}
/>

// AutoForm for create/edit
<AutoForm action={api.todo.create} />
<AutoForm action={api.todo.update} findBy={id} />
```

### 12. Scheduled Actions

```typescript
export const run: ActionRun = async ({ api, logger }) => {
  logger.info('Running daily sync');
  const data = await fetchExternalData();
  await api.todo.bulkCreate(data);
};

export const options: ActionOptions = {
  triggers: {
    scheduler: {
      frequency: { type: 'daily', hour: 2, minute: 0 }
    }
  }
};
```

---

## Code Quality Requirements

**MANDATORY CHECKLIST** after every code change:

1. ✅ Run TypeScript check: `npx tsc --noEmit`
2. ✅ Fix ALL TypeScript errors before completing task
3. ✅ Use `logger` for logging (not console.log in Gadget actions)
4. ✅ Use Gadget hooks in frontend (never manual fetch)
5. ✅ Use `api` from context in backend
6. ✅ Enqueue background work with `api.enqueue()`
7. ✅ Use `writeToShopify` for Shopify mutations
8. ✅ Select only needed fields for performance
9. ✅ Use `_link` for belongsTo relationships
10. ✅ Use `image_url` filter (not deprecated `img_url`)

---

## Quick Reference

**When to enqueue:**
- Long-running operations
- Shopify API writes (`writeToShopify`)
- Side effects in `onSuccess` hooks

**Multi-tenant tenancy:**
- Add filters in `.gelly` files
- Use `preventCrossShopDataAccess` in actions

**Performance:**
- Always use `select` to limit fields
- Use pagination for large datasets (max 250 per page)
- Enqueue heavy operations

**This app uses Gadget framework v1.4.0 with auto-synced Shopify models.**