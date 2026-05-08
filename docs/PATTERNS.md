# Gadget Development Patterns

Full code examples for the patterns referenced in CLAUDE.md.

## 1. Frontend Data Fetching — Always Use Gadget Hooks

❌ NEVER use manual `fetch()` calls for Gadget actions/models

✅ ALWAYS use Gadget React hooks:

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

## 2. Backend API Calls — Use API from Context

```typescript
export const run: ActionRun = async ({ api, logger, params }) => {
  const todos = await api.todo.findMany({
    filter: { completed: { equals: false } },
    select: {
      id: true,
      title: true,
      category: { id: true, name: true }
    }
  });

  const newTodo = await api.todo.create({
    title: 'New task',
    category: { _link: 'category-id-123' }
  });

  await api.todo.update('456', { completed: true });
  await api.todo.delete('789');
};
```

## 3. Background Jobs Pattern

```typescript
// Always enqueue long-running operations (avoids timeouts)
await api.enqueue(api.todo.create, { title: 'Background task' });
await api.enqueue(api.sendWelcomeEmail, { userId: '123' });
```

## 4. Shopify Integration

```typescript
export const run: ActionRun = async ({ connections, logger }) => {
  const shopify = await connections.shopify.current;
  // OR: const shopify = await connections.shopify.forShopId('shop-id-123');

  const result = await shopify.graphql(`
    query {
      products(first: 10) {
        edges { node { id title } }
      }
    }
  `);
};

// Always use writeToShopify for mutations (rate-limit safe)
export const onSuccess: ActionOnSuccess = async ({ api, record }) => {
  await api.enqueue(api.writeToShopify, {
    shopId: record.shopId,
    mutation: `
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) { product { id title } }
      }
    `,
    variables: { input: { id: `gid://shopify/Product/${record.id}`, title: 'Updated Title' } }
  });
};
```

## 5. Model Action Structure

```typescript
import { applyParams, save, preventCrossShopDataAccess, ActionRun } from "gadget-server";

export const run: ActionRun = async ({ api, record, params, logger, session }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);

  if (record.changed("status")) {
    logger.info({ newStatus: record.status }, "Status changed");
  }

  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ api, record, logger }) => {
  // Runs AFTER transaction commits — use for side effects
  await api.enqueue(api.sendNotification, { recordId: record.id });
};
```

## 6. Access Control — Multi-Tenant

```gelly
// In .gelly file
filter ($session: Session) on shopifyOrder [
  where shop == $session.shop
]
```

```typescript
import { preventCrossShopDataAccess } from "gadget-server/shopify";
export const run: ActionRun = async ({ params, record }) => {
  await preventCrossShopDataAccess(params, record);
};
```

## 7. Logging — Always Use Logger

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
// Good: logger.info({ orderId: '123', amount: 100 }, 'Order processed');
// Bad:  logger.info('Order 123 processed');
```

## 8. Relationships

```typescript
// belongsTo — use _link
await api.todo.create({ title: 'My task', category: { _link: 'category-id-123' } });

// Reading relationships with select
const todos = await api.todo.findMany({
  select: {
    id: true,
    title: true,
    category: { id: true, name: true },
    comments: { edges: { node: { id: true, body: true } } }
  }
});
```

## 9. Pagination

```typescript
const firstPage = await api.todo.findMany({ first: 50, sort: { createdAt: 'Descending' } });
const nextPage = await api.todo.findMany({
  first: 50,
  after: firstPage.endCursor,
  sort: { createdAt: 'Descending' }
});
```

## 10. Environment Variables

```typescript
// Backend
export const run: ActionRun = async ({ config }) => {
  const apiKey = config.MY_API_KEY;
  if (!apiKey) throw new Error('MY_API_KEY not configured');
};

// Frontend — requires GADGET_PUBLIC_* prefix
const publicValue = process.env.GADGET_PUBLIC_FEATURE_FLAG;
```

## 11. AutoComponents for Quick CRUD UI

```typescript
import { AutoTable, AutoForm } from "@gadgetinc/react/auto/polaris";
import { api } from "../api";

<AutoTable
  model={api.todo}
  columns={["id", "title", "category.name", { header: "Custom", render: ({ record }) => <Badge>{record.status}</Badge> }]}
/>
<AutoForm action={api.todo.create} />
<AutoForm action={api.todo.update} findBy={id} />
```

## 12. Scheduled Actions

```typescript
export const run: ActionRun = async ({ api, logger }) => {
  logger.info('Running daily sync');
  const data = await fetchExternalData();
  await api.todo.bulkCreate(data);
};

export const options: ActionOptions = {
  triggers: { scheduler: { frequency: { type: 'daily', hour: 2, minute: 0 } } }
};
```
