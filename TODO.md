# Smart Inventory Billing System - Cloud Upgrade TODO

## Step 1: Repo reconnaissance (done)
- Identified current frontend offline/UI sync simulation in `src/contexts/SystemContext.tsx`
- Identified current demo-only authentication in `src/contexts/AuthContext.tsx`
- Identified current local persistence + background Supabase upsert calls in `src/lib/storage.ts`

## Step 2: Add mandatory new backend + DB + sync structure (next)
- Create `backend/main.py` and module folders: auth, billing, inventory, products, payments, customers, reports, sync
- Create `database/postgres/` and `database/sqlite/` directories
- Add initial Postgres schema file(s) under `database/postgres/`

## Step 3: Implement JWT auth + role middleware (next)
- `POST /auth/login`, `GET /auth/me`
- Role checks: admin vs employee

## Step 4: Implement billing + sync endpoints (next)
- `POST /bills` (employee create)
- Sync endpoints: `POST /sync/push`, `POST /sync/pull`

## Step 5: Implement offline outbox + idempotent sync logic
- Add SQLite local queue/outbox tables
- Add server-driven upsert by `client_bill_id`

## Step 6: Frontend service layer + context integration
- Add `frontend/src/services/` (api, authService, billingService, syncService)
- Update `AuthContext` and `SystemContext` to use FastAPI + real sync

## Step 7: Testing checklist
- Offline create bill -> reconnect -> appears in cloud once (no duplicates)
- Employee cannot access admin-only endpoints
- Billing workflow remains unchanged

