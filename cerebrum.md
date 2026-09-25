# CEREBRUM — Refurbnics project brain

> Read this first when fixing anything. It records how the system fits together, the
> invariants that are easy to break, and the bug patterns that have actually bitten us.
> Last full analysis: 2026-09-25 (working tree ahead of commit `3e22db8`).

---

## 1. What this is

Admin + client + technician platform for a **battery repair workshop** (UK, GBP).
Batteries arrive by truck from clients, get repaired/tested by workshop staff, then are
returned (dispatched) or recycled. Three apps share one Express/Postgres API:

| App | Path | Stack | Who uses it |
|---|---|---|---|
| API | `backend/` | Node 18+, Express 4, `pg`, Socket.IO, JWT, multer, exceljs, nodemailer | everyone |
| Web | `frontend/` | React 19, Vite 8, Redux Toolkit (auth only), React Router 6, Tailwind 3, axios, jspdf | admins, clients, technicians |
| Mobile | `mobile/` | Expo 57 / RN 0.86, React Navigation 6, NativeWind, expo-camera | technicians (scan) + clients |

No test suite exists anywhere. Verification = `cd frontend && npx vite build`, `node -e "require('./src/app')"` in backend, and manual runs.

---

## 2. Run / build / deploy

```bash
# DB: local Postgres, name from backend/.env (default refurbinics)
cd backend  && npm i && npm run migrate && npm run dev     # :5000 (+ :5443 https if certs/ exist)
cd frontend && npm i && npm run dev                         # :5173, VITE_API_URL=<origin>/api
cd mobile   && npm i && npx expo start                      # infers http://<LAN-IP>:5000/api from Metro hostUri
```

- **Env loading is unusual**: `backend/src/config/env.js` loads `.env`/`.env.local` from BOTH repo root and `backend/`, **most-recently-modified file wins** (`override: true`). If a value "won't change", check which file was touched last.
- Frontend `vite.config.js` sets `envDir: ..` → Vite reads the **repo-root** `.env` for `VITE_*`.
- Migrations run automatically on server boot (`server.js` → `runMigrations(false)`) and via `npm run migrate`. Tracked in `schema_migrations` by **filename**; files applied in sorted order, never re-run. Two pairs share a number (`015_*`, `023_*`) — harmless because names are unique, but don't reuse a number again.
- Prod: `docker-compose.yml` (postgres16 + backend + frontend(nginx :8080) + Caddy TLS). Only Caddy publishes ports. `VITE_API_URL` is baked at image build time. Required env: `DOMAIN, API_DOMAIN, DB_PASSWORD, JWT_SECRET, CLIENT_URL, VITE_API_URL`.
- `CLIENT_URL` is comma-separated CORS allow-list (`config/cors-origin.js`).

---

## 3. Backend architecture

```
src/
  app.js            express setup, static /uploads mounts, /api router, error handler
  server.js         DB connect → migrations → http(+https) → realtime.init()
  config/           env.js, db.js (pool + query), permissions.js, cors-origin.js
  middlewares/      auth.js (requireAuth/optionalAuth/requireRole/requirePermission), error-handler.js
  routes/*.routes.js   one per module; index.js mounts under /api/<module>
  controllers/*.controller.js   req parsing, role checks, audit/trash recording, realtime broadcasts
  models/*.model.js  raw SQL via db.query / db.pool.connect() transactions. No ORM.
  realtime/index.js  Socket.IO, same JWT as HTTP
  services/mailer.service.js  nodemailer (invoice emails)
  db/migrations/NNN_name.sql
```

Conventions:
- Controllers `try { … } catch (err) { next(err) }`. Throw `err.status = 4xx` for user-facing messages; anything without status is logged and masked as 500 in prod (`error-handler.js`).
- Multi-step writes use `const client = await db.pool.connect(); BEGIN … COMMIT/ROLLBACK … release()`.
- Paged lists return `{ rows, hasMore, total }` (fetch `limit+1`).
- Every status change calls `realtime.broadcastBatteryUpdated(battery)`.
- Deletes by admins go through `trashModel.record(...)` first (soft "Trash Bin" audit, migration 048) then hard delete. Key actions also `auditLogModel.record({ userId, action, entity, entityId, details })`.

### 3.1 Auth & roles

- JWT (`JWT_EXPIRES_IN` default 7d). `requireAuth` **re-fetches the user from DB on every request** so role/permission edits apply instantly. Token accepted via `Authorization: Bearer` **or `?token=`** (for `<img>`/`<a>` to protected uploads).
- `users.role` DB CHECK (migration 030): `super_admin | admin | client | technician | recycle_client`.
  **⚠ `'staff'` is NOT a valid users.role** even though many routes/frontend guards list it (`requireRole('staff', …)`, `roles={['super_admin','admin','staff']}`). Those branches are dead until a migration widens the CHECK. Don't rely on them.
- Workshop sub-roles live in **`staff.role`**, CHECK-constrained (migration 052) to exactly **`technician | supervisor`**. Only `supervisor` may test / complete / pass-to-tech; guard is `staffRole === 'supervisor'` (backend `battery.controller.js`, web `Technician*.jsx`, mobile `BatteryDetailScreen`/`ServiceScreen`). `staff.controller.js` rejects any other value (400). Manager/tester/qa were removed on 2026-09-25. Resolved via `staffModel.findByUserId(req.user.id)`. **Every workshop login is `users.role = 'technician'`** and must have a linked `staff` row (`staff.user_id`).
- Admin module permissions: `config/permissions.js` `PERMISSIONS[]` (mirrored by hand in `frontend/src/utils/permissions.js`). `super_admin` bypasses all. Client portal modules: `CLIENT_PERMISSIONS[]`; an empty array on a client = **all allowed** (backwards-compat in `hasClientPermission`).
- Permission matrix (routes):
  - super_admin only: `/users`, `/finance`, PATCH/DELETE on most entities, trash clear-all.
  - `requirePermission(module)`: create/list on truck_intakes, repairs, staff, parts, returns, recycle, audit_logs, clients, issue_reasons, services.
  - client self-service under `/clients/me/*` (`requireRole('client')`).
  - `/batteries/:code` is `optionalAuth` (public QR lookup).

### 3.2 Battery lifecycle (the core state machine)

`batteries.status` CHECK (migration 047):
`in_repair | in_progress | in_testing | repaired | returned | unserviceable | recycled | tested_parts_removed`

```
client packs / admin intake → truck_intakes(status='pending_arrival')  batteries: in_repair
   └─ admin verify-arrival → truck_intakes.status='verified', verified_at   (+ battery_visits row)
technician scan → start-work        in_repair → in_progress (work_started_at, started_by_user_id)
                                     (auto-applies mandatory services, migration 046)
technician logs part (repairs row)  in_progress → in_testing (repair.model.create, first in batch)
                                     testing_started_at = NULL until a tester scans
tester start-testing                testing_started_at = COALESCE(existing, now())
tester complete-testing             in_testing → repaired (testing_duration_seconds)
tester pass-to-tech                 in_testing → in_progress
anyone workshop report-issue        in_progress|in_testing → unserviceable (battery_issues row, ≤3 photos)
remove-parts (after failed test)    unserviceable → tested_parts_removed (parts restocked, repairs.removed_*)
returns.create                      repaired → returned  (returns + return_batteries)
returns.verifyReceipt (client)      returns.status='verified'
recycle.create                      unserviceable|tested_parts_removed → recycled
```

- "Effective status" `registered`: a battery with status `returned` but no return_batteries, no visits and no intake is shown as **registered** (QR generated but never sent). See `effectiveStatusExpr` in `battery.model.findPage`.
- Filter `status=unserviceable` must also include `tested_parts_removed` (UI shows it as "Unserviceable · Test Failed"). Handled for single and comma-separated multi-status.
- `intakedOnly` typeahead must only suggest batteries whose **current** intake is verified (or already `in_testing`). Never match on "has any historical visit".
- `battery_visits` = one row per workshop cycle; `findTimeline` builds the detail-page history.
- Battery codes: client-prefixed sequential internal IDs (`maxSequenceByClientName`), `serial_number` unique per client (migration 022). Client ownership = `truck_intakes.client_id` **or** `lower(batteries.client_name)` — the name fallback must never match `''`.

### 3.3 Other domain tables

`users, staff, clients, truck_intakes, batteries, battery_visits, battery_issues, issue_reasons, repairs, parts, part_stock_adjustments, services, battery_services, returns, return_batteries, recycle_batches, recycle_batteries, invoices, support_tickets, support_ticket_messages, battery_ratings, milestone_certificates, audit_logs, trash_items, client_sort_groups`

- `parts.in_stock` is a generated column (`quantity > 0`). Stock moves via `decrementStock/addStock` + `part_stock_adjustments`.
- `repairs` = one row per part fitted (price, labor_charge, batch_id per visit, duration_seconds, removed_at/removed_by_staff_id).
- `services` / `battery_services` (043, 046): per-battery service fees; `is_mandatory` ones auto-applied on start-work. Diagnostic fee shown on detail page **only** if such a row exists.
- `recycle_batches` (051): `total_weight_kg`, `price_per_kg` default 3.40.
- `client_sort_groups` (049): `id` is a client-generated string; `replaceSortGroups` is **DELETE-all-then-INSERT** for the client — a caller sending `[]` wipes everything.
- `returns.document_url/document_name` (050) → files in `uploads/return-docs`.

### 3.4 Uploads

`backend/uploads/` (git-ignored). Mounted in `app.js`:

| Prefix | Auth | Used for |
|---|---|---|
| `/uploads/client-logos` | public | `<img>` logos |
| `/uploads/staff-docs` | requireAuth | passport/NI scans |
| `/uploads/issue-photos` | requireAuth | report-issue photos |
| `/uploads/return-docs` | requireAuth | dispatch notes/receipts |
| `/uploads/invoices` | streamed via `/api/invoices/:id/download` | PDFs |

Rule: any new sensitive prefix needs (a) its own `requireAuth` mount **above** the catch-all `/uploads`, and (b) adding the prefix to `needsAuth` in `frontend/src/utils/image-url.js` **and** `mobile/src/utils/imageUrl.js` so the `?token=` is appended.
Multer filters must require **both** mimetype AND extension (extension decides served Content-Type → stored XSS otherwise). Filenames are built from `originalname` after `[^a-zA-Z0-9._-] → _`.

### 3.5 Realtime (Socket.IO)

Server emits (all broadcast, no rooms): `battery:updated`, `batteries:unserviceable-count`, `parts:out-of-stock`, `intakes:repeats`, `intakes:new`, `returns:new`, `tickets:new`, `ticket:created`, `ticket:message`, `ticket:updated`.
Frontend: single shared socket in `services/socket-client.js`, connected by `DashboardLayout` when a token exists. Origin = `new URL(VITE_API_URL).origin`.

---

## 4. Frontend (web)

```
src/
  main.jsx / App.jsx      verifySession() on boot; renders "Checking session…" until authChecked
  routes/AppRoutes.jsx    ALL routes + guards (roles / permission / clientPermission)
  routes/HomeRoute.jsx    "/" → role dashboard (admin / client / technician / recycle_client)
  routes/ProtectedRoute.jsx
  app/store.js            Redux: only `auth` slice (features/auth/auth-slice.js). Everything else is local state + hooks.
  services/api-client.js  axios, Bearer from localStorage.token, 401 → wipe + /login
  services/socket-client.js, time-api.js (external clock sync: timeapi.io, Europe/London)
  utils/                  permissions.js, image-url.js, sort-groups.js, extract-battery-code.js,
                          generate-battery-invoice.js (jspdf), generate-qr-sheet.js, use-fetch-list / use-infinite-list hooks
  components/layout/shell DashboardLayout, Sidebar, PortalHeader   components/ui/*  Badge, tables, overlays, charts
  features/<module>/      Page + Form + (portal|admin|technician) subfolders
  context/ThemeContext    light/dark + client accent color (customTheme.accentColor)
```

- Role landing: admin → `DashboardPage`; client → `ClientDashboardPage` (or first permitted module); technician → `TechnicianHomePage` (scan) / `/my/dashboard`; recycle_client → recycle dashboard.
- Technician web flow lives in `features/batteries/technician/` — `TechnicianRepairPanel.jsx` is the big state machine (start-work, log parts, testing, report issue, remove parts). Guard: **all** pending parts must be selected before `remove-parts`.
- Client sorting tool `ClientBatterySortPage.jsx` (+ mobile `ClientSortingScreen.js`): groups persisted server-side via `/clients/me/sort-groups`. **Never persist after a failed load** (see §7).
- Demo quick-fill logins: `config/demo-credentials.js` (web + mobile lists).
- Dark mode via Tailwind `dark:` classes; surfaces use `surface-800/900/950` custom colors.

---

## 5. Mobile (Expo)

```
src/navigation/RootNavigator.js  Login/SetPassword → Main(tabs) + BatteryDetail + client stack screens
src/navigation/MainTabs.js       role === 'client' ? Dashboard/MyBatteries/ScanQR/Profile : Service/Dashboard/History/Profile
src/screens/technician/*         ServiceScreen = scan + repair flow;   shared/BatteryDetailScreen = per-battery actions
src/screens/client/*             dashboard, batteries, scan, sorting, invoices, transactions, notifications, support
src/services/api-client.js       base URL: Metro LAN IP :5000 → EXPO_PUBLIC_API_URL → hard-coded 192.168.31.243 fallback
src/store/auth-slice.js          token in AsyncStorage; 401 → logout via injected store
src/utils/imageUrl.js            mirrors web image-url.js (token query for protected uploads)
```
Babel CLI via `babel.config.js` fails standalone (expo preset needs Metro env) — syntax-check with `@babel/parser` instead. `npx expo start --tunnel` domains must not get `:5000` appended (handled).

---

## 6. Where to look for X

| Symptom / task | Start here |
|---|---|
| Battery shows wrong status / missing from list | `battery.model.findPage` (`effectiveStatusExpr`, status branch, `intakedOnly`) |
| Technician can't start/complete something | `battery.controller.js` (`startWork` intake-verified guard, `startTesting`/`completeTesting` require `staff.role === 'supervisor'`) then `battery.model.js` `WHERE … status IN (…)` |
| 409 "not linked to a staff record" | user has `role=technician`/admin but no `staff.user_id` row → create staff record |
| Permission denied for admin | `users.permissions[]` vs `config/permissions.js`; frontend mirror in `utils/permissions.js`; route `requirePermission` |
| Client sees another client's data | `client.model.js` ownership predicates (`client_id` OR `client_name`, guarded `$3 <> ''`) |
| Upload accepted/served wrongly | route multer `fileFilter` (AND!), `app.js` mounts, `image-url.js` `needsAuth` |
| Realtime badge stale | `realtime/index.js` broadcaster not called in controller |
| Money numbers wrong | `finance.model.js` (`recycleRevenueByPeriod` reconciles invoices vs weight), client balance/transactions via `BILLABLE_BATTERIES_CTE` in `client.model.js`, `repairs.price/labor_charge`, `battery_services` |
| Invoice PDF | backend `invoice.controller` (upload/stream) + frontend `generate-battery-invoice.js` (jspdf client-side) |
| New DB field | add `NNN_name.sql` (next number ≥ 053), `ADD COLUMN IF NOT EXISTS`, update model SELECTs, restart server |
| Deploy/CORS | `CLIENT_URL` list, `VITE_API_URL` baked into image, Caddy `DOMAIN/API_DOMAIN` |

---

## 7. Bug patterns that have actually happened (check for these first)

1. **Load-failure → destructive save.** A fetch `.catch(() => set([]))` followed by an effect/`PUT` that *replaces* server state wiped client sort groups. Rule: on load error set an error flag, render it, and **block persistence** until reload. (web `ClientBatterySortPage`, mobile `ClientSortingScreen`, `utils/sort-groups.js` now rethrows.)
2. **Widening a route's roles without keeping the staff-row guard.** `battery_issues.staff_id` is NOT NULL; `removed_by_staff_id` is the audit trail. Always resolve `staffModel.findByUserId` and 409 if absent, for *every* allowed role.
3. **"Select all" guards silently removed.** `remove-parts` must require every pending part; button label says "All".
4. **Multer OR-filter** (`!mime && !ext`) → `.html` upload stored XSS. Use OR-reject (`!mime || !ext`).
5. **New upload folder served by catch-all `/uploads`** → unauthenticated PII. Add explicit mount + `needsAuth` in both image-url utils.
6. **Ownership fallback on empty string** (`lower(client_name) = lower('')`) → cross-tenant delete. Guard `$3 <> ''`.
7. **Multi-value filter branch ordered before the single-value special cases** → lost `unserviceable→tested_parts_removed` expansion.
8. **Over-broad `OR EXISTS (battery_visits)`** made pending-arrival batteries scannable.
9. **Nulling a timer column** (`testing_started_at = NULL` in repair.model) made `EXTRACT(EPOCH FROM now() - NULL)` = NULL; use `COALESCE(col, now())`.
10. **Validation against a list still loading** (`registeredBatteries`) reported valid codes as "not registered". Track `loaded` + `loadError` and message accordingly.
11. **Hard-coded fallback money** (£5.00 diagnostic fee) shown to clients with no backing row. Render "Not configured" instead.
12. **All-time flags shown as current state.** `pending_parts_count` / `is_passed_back` counted every repair / pass-back ever, so repaired batteries showed "Passed to Remove Parts". Any per-battery flag must be scoped to the **current cycle** (`cycle` lateral = latest `battery_visits.created_at`) and to a live status.
13. **Billing keyed on `batteries.truck_intake_id`.** That column is overwritten on every re-pack, so charges from earlier visits vanished. Bill from the battery's **first verified visit** (`BILLABLE_BATTERIES_CTE` in `client.model.js`), never from the current intake.
14. **Ownership widened to "any battery with my name".** Let Client B edit/delete Client A's intake. Name-match fallback only for intakes with `client_id IS NULL`.
15. **`Math.max` across revenue sources** discarded whichever was smaller; per-period reconciliation (`recycleRevenueByPeriod`: invoice if present else weight estimate) is the rule.
16. **Guard added to one save path but not its siblings** (`handleSaveAndLeave` bypassed `groupsLoadError`). Grep every caller of the persist function.
17. **Optimistic update + swallowed PUT error** → UI lies. Surface the error and re-fetch.
18. **"Any one battery is mine" ownership on untagged intakes** let a client claim/delete a mixed workshop intake. Rule now lives in ONE place — `findOwnedIntake()` in `client.model.js`: `client_id = me`, or `client_id IS NULL` **and all** batteries carry my name.
19. **Feature flag read from the query string instead of the role** (`includeTesting=true`) let technicians bypass the supervisor guard. Derive privilege flags from `req.user`, never from `req.query`.
20. **Return-batch union pulled in other clients' batteries** (`CLIENT_BATTERY_IDS_CTE`): a mis-picked battery on a dispatch form billed two clients. The returns branch now excludes batteries tagged to a different `client_name`.
21. **`LEFT JOIN clients … OR …` fan-out** duplicated fee rows in finance when intake client ≠ battery client_name. Use a `LATERAL … LIMIT 1` to pick exactly one client.
22. **Typeahead status list dropped `in_progress`** so technicians couldn't find batteries they'd already started. When replacing a filter (`activeOnly` → `intakedOnly`), diff the status sets.
23. **File written before the DB row** — orphaned uploads on INSERT failure. Validate input first, write file, wrap the DB call and unlink on throw (`return.controller.js`).
24. **Moved JSX SVG path lost tokens** (`… 9.75-9.75 9.75S…`). Diff icon paths against an intact copy.

Meta-rules: prefer 409/400 with a message over silently writing NULL; anything that *replaces* a set server-side must never run from a default/empty client state; every `requireRole` widening needs a matching DB-constraint check.

---

## 8. Open risks / TODO (not yet fixed)

- `'staff'` user role referenced everywhere but not in `users_role_check` → either add a migration or strip the dead branches.
- No automated tests; no lint config for frontend (`oxlint` listed but no config), backend has none.
- `time-api.js` depends on public internet clock APIs (`timeapi.io`) — fails silently offline.
- Mobile fallback API IP `192.168.31.243` is a developer's LAN; set `EXPO_PUBLIC_API_URL` for anyone else.
- Socket.IO broadcasts to *all* connected users (no rooms) — clients receive admin events (data leakage risk if payloads grow).
- `express.json({ limit: '20mb' })` + base64 photo uploads in JSON — consider multipart only.
- Frontend `hasClientPermission` treats empty permissions as "all" — intentional but surprising.
- Duplicate migration numbers `015`, `023` (safe, but keep numbering strictly increasing from 053).

---

## 9. Fix log

- **2026-09-25** — Review of the uncommitted "sort groups / return docs / recycle weight" batch (47 files): fixed the 14 items in §7 across `battery.controller.js`, `battery.model.js`, `client.model.js`, `return.routes.js`, `app.js`, `image-url.js`, `imageUrl.js`, `TechnicianRepairPanel.jsx`, `BatteryDetailPage.jsx`, `ClientBatterySortPage.jsx`, `sort-groups.js`, `ClientSortingScreen.js`. Verified with `vite build` + backend module load.
- **2026-09-26 (later)** — Third pass over `3e22db8..HEAD` (10 findings): `findOwnedIntake()` helper with all-batteries rule, returns-branch guard in `CLIENT_BATTERY_IDS_CTE`, `includeTesting` derived from role only, `LATERAL` single-client join + `buildDateRangeWhere()` in `finance.model.js`, `in_progress` back in the technician typeahead, recycled-date filter no longer matches registration date, dead `unserviceable_*` aliases removed, `parseBatteryIds()` + orphan-file cleanup in `return.controller.js`. SQL smoke-tested against local DB.
- **2026-09-26** — Second review pass (10 findings + 3 lows): cycle-scoped `pending_parts_count`/`is_passed_back` (`battery.model.js`), intake ownership tightened + billing from first verified visit (`client.model.js` `BILLABLE_BATTERIES_CTE`), reconciled recycle revenue with proper period labels (`finance.model.js` `recycleRevenueByPeriod`), async return-doc writes + old-file unlink + `returnedAt` validation (`return.controller.js`), sort-page save guards/error banner, shared `canTestBatteries()` in `utils/permissions.js` (dropped `/staff/me` fetches), `TruckIntakeDetailPage` testing count, mobile no-op re-save skip. All rewritten SQL executed against local DB.
- **2026-09-25** — Workshop roles reduced to `technician` + `supervisor` (manager/tester/qa removed) in backend guards, web + mobile UI, `StaffForm` dropdown; `staff.controller` validates; migration `052_staff_two_roles.sql` converts old rows and adds a CHECK.
