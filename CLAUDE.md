# CLAUDE.md

@../_shared/informatica-store.md

Gadget-based Shopify app with multi-supplier integration: Gadget backend in `api/`, React + Polaris frontend in `web/`.

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
- Rozetka token management: a singleton with auto-refresh.
- After every change, run `npx tsc --noEmit` and fix all errors.

See `docs/PATTERNS.md` for full code examples of all 12 patterns.
