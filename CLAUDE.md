# CLAUDE.md

Gadget-based Shopify app with multi-supplier integration.

## Build Commands

- `npm run dev` — Shopify app dev server
- `npm run build` — Production build (Vite)
- `npm run ggt` — Gadget development environment
- `npm run shopify` — Shopify CLI

## Architecture

**Structure:**
- `/api/` — Gadget backend (TypeScript)
- `/web/` — React frontend (Polaris UI)
- `/api/utilities/` — Business logic

**Path aliases** (tsconfig.json): `utilities` → `api/utilities`, `routes/*` → `api/routes`, `types/*` → `api/types`

**Integrations:**
- Suppliers: Brain, Rozetka, Easy, Schusev (`/api/utilities/suppliers/`)
- AI: OpenAI embeddings + recommendations (`/api/utilities/ai/`)
- Logistics: Nova Poshta API
- Token management: Rozetka singleton with auto-refresh

## Key Rules

- Frontend: use Gadget hooks (`useGlobalAction`, `useAction`, `useFindMany`, `useFindOne`, `useFetch`) — never `fetch()` directly
- Backend: always destructure `api` from context, always `select` only needed fields
- Long-running ops: `api.enqueue()` — never run inline
- Shopify writes: always `writeToShopify` (rate-limit safe)
- Logging: `logger` structured (not `console.log`)
- belongsTo relationships: `{ _link: 'id' }` syntax
- Pagination: cursor-based, max 250 per page
- Env vars: `config.KEY` backend, `GADGET_PUBLIC_*` prefix for frontend
- Multi-tenant: filter `.gelly` files by shop + `preventCrossShopDataAccess` in actions

See `docs/PATTERNS.md` for full code examples of all 12 patterns.

## Code Quality Checklist

After every change:
- `npx tsc --noEmit` — fix ALL errors before completing
- No `console.log` in actions — use `logger`
- No manual `fetch()` in frontend — use Gadget hooks
- Select only needed fields in all queries
- `_link` for belongsTo, `api.enqueue()` for background work
- Use `image_url` filter (not deprecated `img_url`)
