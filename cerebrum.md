# CEREBRUM — Refurbnics project brain

> Read this first when fixing anything. It records how the system fits together, the
> invariants that are easy to break, and the bug patterns that have actually bitten us.
> Last full analysis: 2026-10-05 (commit `0ecaf21`; see §9 for what changed since 2026-09-25).
>
> **Before touching anything: read §8 (open risks) and §7 (bug patterns).** Two of the §8 items
> are live security holes that were fixed once and then re-opened by later commits.

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
Quick API smoke test: mint a JWT for a local user (`jwt.sign({id}, env.jwt.secret)`) and `curl` the route with `Authorization: Bearer` — the role guards in §3.1 were verified that way on 2026-10-02.

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
- **Actual hosting (since 2026-10-01)** — not the docker-compose stack:
  - API: **Render** web service `refurbincsuk` → `https://refurbincsuk.onrender.com` (Docker build from `backend/Dockerfile`, runs migrations on start). DB: **Neon** Postgres via `DATABASE_URL` (takes priority over `DB_*` in `config/db.js`, `ssl: { rejectUnauthorized: false }`). Free tier sleeps after ~15 min idle; first request takes ~50 s. A deploy that fails with `28P01 password authentication failed for user 'neondb_owner'` means the Neon password was rotated → paste the new connection string into Render's `DATABASE_URL`. **Uploads live on the container disk and are wiped on every deploy** (no persistent disk attached) — see §8.
  - Web: **Vercel** (`refurbincs-uk-….vercel.app`, auto-deploy from `main`). `VITE_API_URL` must be set in Vercel env; `vite.config.js` reads the repo-root `.env` locally, which Vercel doesn't have. Root `.env` has `NODE_ENV=development`, so a **local `vite build` is a dev-mode build** (jsxDEV, `import.meta.env.DEV === true`) — to reproduce the Vercel bundle run `NODE_ENV=production npx vite build --outDir /tmp/x`.
  - Mobile: **EAS** project `b0487851-…` (owner `work.adarsh`, slug `refurbinics-technician`, Android package `com.refurbinics.technician`). `mobile/eas.json` `preview` profile = internal APK with `EXPO_PUBLIC_API_URL=https://refurbincsuk.onrender.com/api` baked in. `eas build -p android --profile preview` → share the link. `mobile/.env` is for dev only (LAN IP) and is tracked in git on purpose (holds only the URL).
- Docker alternative: `docker-compose.yml` (postgres16 + backend + frontend(nginx :8080) + Caddy TLS). Only Caddy publishes ports. `VITE_API_URL` is baked at image build time. Required env: `DOMAIN, API_DOMAIN, DB_PASSWORD, JWT_SECRET, CLIENT_URL, VITE_API_URL`.
- CORS (`config/cors-origin.js`): `CLIENT_URL` comma-list + **any `https://*.vercel.app` origin** (widened 2026-10-03 from `refurbinics*.vercel.app`) + the refurbnics domain regex; everything allowed outside production. Native apps send no Origin and always pass.

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

- JWT (`JWT_EXPIRES_IN` default 7d). `requireAuth` **re-fetches the user from DB on every request** so role/permission edits apply instantly. Token accepted via `Authorization: Bearer` **or `?token=`** (for `<img>`/`<a>` to protected uploads — this also puts tokens in Render access logs; known risk).
- `POST /auth/login` has an in-memory brute-force limiter (`middlewares/login-rate-limit.js`: 10 failures per IP+email per 15 min → 429; `app.set('trust proxy', 1)` so `req.ip` is the real client behind Render/Caddy).
- **`POST /auth/register` is public and creates a `super_admin`** (`auth.controller.js` `register`, since commit "Configure create page specifically for Super Admin accounts" 2026-10-03). Web pages `/register` and `/create-account` (`RegisterPage.jsx`). The audit fix (bootstrap-only via `userModel.anyExist()`) was overwritten. The `anyExist()` helper still exists in `user.model.js`. **Treat as a live critical hole until re-locked** (§8).
- Wrong current password on `/auth/change-password` returns **400**, not 401 — both apps treat any 401 as "session expired" and log out. The forced first-login screen skips the current-password check via `must_change_password`.
- `/auth/me` (`me()`) has try/catch — before 2026-10-02 any DB error there was an unhandled rejection that killed the process. `server.js` also has a global `unhandledRejection` logger and `db.js` no longer `process.exit(1)`s on idle-client errors (Neon drops idle connections routinely).
- `users.role` DB CHECK (migration 030): `super_admin | admin | client | technician | recycle_client`.
  **⚠ `'staff'` is NOT a valid users.role** even though many routes/frontend guards list it (`requireRole('staff', …)`, `roles={['super_admin','admin','staff']}`). Those branches are dead until a migration widens the CHECK. Don't rely on them.
- Workshop sub-roles live in **`staff.role`**, CHECK-constrained (migration 052) to exactly **`technician | supervisor`**. Only `supervisor` may test / complete / pass-to-tech; guard is `staffRole === 'supervisor'` (backend `battery.controller.js`, web `Technician*.jsx`, mobile `BatteryDetailScreen`/`ServiceScreen`). `staff.controller.js` rejects any other value (400). Manager/tester/qa were removed on 2026-09-25. Resolved via `staffModel.findByUserId(req.user.id)`. **Every workshop login is `users.role = 'technician'`** and must have a linked `staff` row (`staff.user_id`).
- Admin module permissions: `config/permissions.js` `PERMISSIONS[]` (mirrored by hand in `frontend/src/utils/permissions.js`). `super_admin` bypasses all. Client portal modules: `CLIENT_PERMISSIONS[]`; an empty array on a client = **all allowed** (backwards-compat in `hasClientPermission`).
- Permission matrix (routes) — tightened 2026-10-02 after the security audit; **a client/technician token used to reach all of the "office"/"workshop" rows below**:
  - super_admin only: `/users`, `/finance`, PATCH/DELETE on most entities, trash clear-all.
  - `requirePermission(module)`: create/list on truck_intakes, repairs, staff, parts, returns, recycle, audit_logs, clients, issue_reasons, services.
  - **office** = `requireRole('super_admin','admin','staff')`: `GET /staff`, `GET /staff/:id`, `GET /clients`, `GET /clients/:id`, `GET /dashboard/summary`, `POST /batteries/generate`, `POST /batteries/generate-bulk`, `PATCH /batteries/:id/client`, `/uploads/staff-docs/*`.
  - **workshop** = office + `technician`: `GET /batteries` (list), `/batteries/count-by-client|serial-numbers|repeat-intakes-this-month|unserviceable-count`, `GET /parts`, `GET /parts/:id`, `GET /services`, `GET /issue-reasons`.
  - `PATCH /batteries/:id/serial-number`: workshop + `client` (controller enforces client ownership).
  - `/tickets/*`: `client, recycle_client, super_admin, admin, staff` (never technicians); a client-role user with no linked `clients` row gets 409 everywhere, never an unscoped query.
  - `GET /invoices/:id/download`: client/recycle_client only for their own `client_id`; otherwise super_admin/admin only.
  - `POST /ratings`: client roles + office.
  - client self-service under `/clients/me/*` (`requireRole('client')`). `GET /clients/me/notifications?type=` is whitelisted to `intake|return|invoice` (was string-interpolated SQL → injection).
  - `/batteries/:code` is `optionalAuth` (public QR lookup). **Anonymous callers get `price`, `labor_charge`, `staff_id`, `user_id`, `removed_by_staff_id` and service `rate` nulled** in `battery.controller.getByCode` — codes are sequential and scrapeable.
  - `GET /staff/me` (technician's own dashboard/history feed) returns only `staff: {id,name,role,email,phone}` + `repairs` (no `price/labor_charge`) + `issues` + `tests`. `GET /staff/:id` (admin) keeps prices.

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
- Battery codes: client-prefixed sequential internal IDs, **zero-padded to 7 digits since 2026-10-02** (`HUM-0000001`; `BATTERY_NUMBER_DIGITS = 7` in `battery.model.js` and `GenerateQrPage.jsx`). Older rows are 4-digit (`HUM-0042`); `maxSequenceByClientName` parses the numeric suffix so numbering continues across both formats. `createManyForClient` pre-checks the numeric range against existing codes of either width and throws `code 23505` (→ the controller's 409) — the UNIQUE constraint alone wouldn't catch `HUM-0000001` vs `HUM-0001`. Prefix = first 3 letters of the client name, so two clients sharing those letters share one sequence (known). `serial_number` unique per client (migration 022). Client ownership = `truck_intakes.client_id` **or** `lower(batteries.client_name)` — the name fallback must never match `''`.
- **Client packing guard** (`assertClientCanPack()` in `client.model.js`, used by `packBatteryForRepair`, `recordClientTruckIntake`, `addBatteriesToClientTruckIntake`): the typed/scanned code must belong to this client (by name, by intake `client_id`, or be unassigned) → else 403; and must not be `in_progress/in_testing/testing/repair_testing/repaired/unserviceable/tested_parts_removed/unserviceable_parts_removed/recycled`, nor `in_repair` on an already-verified intake → else 409. Before this, re-scanning any code (even another client's, or one mid-repair) force-reset it to `in_repair` and moved it onto the new truck.
- **Client "Packed" bucket is a history view** (`findMyBatteries(…,'packed')`): every truck ever packed for the client with every battery that was on it (via `battery_visits` ∪ current `truck_intake_id` ∪ unassigned `in_repair`), so completed/returned batteries stay in the truck detail table. A battery since re-packed on a newer truck reports `status='returned'` for the older visit; `current_status` keeps the live value. The web client portal's **Stage 2 "In Service" page was removed** (2026-10-01): `/my/batteries/pending` redirects to `/my/batteries/packed`; the mobile app still requests `bucket=pending` and the backend still serves it.
- `verifyArrival` only updates `status IS DISTINCT FROM 'verified'`; a second verify → 409. Re-verifying used to reset every battery on the truck (incl. tested/returned) to `in_repair`.
- `removeParts` locks the battery row, refuses `repaired/returned/recycled` (409), and when zero repair rows match it rolls back **without** changing status (it used to commit `tested_parts_removed` alongside the 409).
- `createIntakeWithBatteries` caps `batteryCount` at `MAX_NEW_BATTERIES_PER_INTAKE = 5000` (a typo'd count built millions of code strings in memory).
- `battery_issues.failed_testing` (migration 053) marks QA-time failures; `reason_id` is nullable since 045 — **always `LEFT JOIN issue_reasons`** (an inner join silently dropped testing failures from history).

### 3.3 Other domain tables

`users, staff, clients, truck_intakes, batteries, battery_visits, battery_issues, issue_reasons, repairs, parts, part_stock_adjustments, services, battery_services, returns, return_batteries, recycle_batches, recycle_batteries, invoices, support_tickets, support_ticket_messages, battery_ratings, milestone_certificates, audit_logs, trash_items, client_sort_groups`

- `parts.in_stock` is a generated column (`quantity > 0`). Stock moves via `decrementStock/addStock` + `part_stock_adjustments`.
- `repairs` = one row per part fitted (price, labor_charge, batch_id per visit, duration_seconds, removed_at/removed_by_staff_id).
- `services` / `battery_services` (043, 046): per-battery service fees; `is_mandatory` ones auto-applied on start-work. Diagnostic fee shown on detail page **only** if such a row exists.
- `recycle_batches` (051): `total_weight_kg`, `price_per_kg` default 3.40.
- `client_sort_groups` (049): `id` is a client-generated string; `replaceSortGroups` is **DELETE-all-then-INSERT** for the client — a caller sending `[]` wipes everything.
- `returns.document_url/document_name` (050) → files in `uploads/return-docs`.

### 3.4 Uploads

`backend/uploads/` (git-ignored — but `git ls-files backend/uploads` shows 3 staff ID-card PNGs, invoices, issue photos and a logo were committed in `24265f1` and are still in history). **One gate** in `app.js` decides by the *normalised, decoded* first path segment (`path.posix.normalize(decodeURIComponent(req.path))`), then a single `express.static(uploads)`:

| Folder | Auth | Used for |
|---|---|---|
| `client-logos` | public | `<img>` logos |
| `issue-photos`, `return-docs` | requireAuth | report-issue photos, dispatch docs |
| `staff-docs` | requireAuth + office role | passport/NI scans |
| `invoices` and anything else | **404** here | invoice PDFs stream only via `/api/invoices/:id/download` |

Why one gate: the old per-folder `app.use('/uploads/staff-docs', requireAuth, …)` mounts matched the raw URL, so `/uploads//staff-docs/x`, `/uploads/%73taff-docs/x` or `/uploads/invoices/../staff-docs/x` skipped them and fell through to a public `/uploads` catch-all (verified 2026-10-02: now 401). Rule: a new folder = one new branch in that gate + add the prefix to `needsAuth` in `frontend/src/utils/image-url.js` **and** `mobile/src/utils/imageUrl.js` so the `?token=` is appended.
Multer filters must require **both** mimetype AND extension (extension decides served Content-Type → stored XSS otherwise). Filenames are built from `originalname` after `[^a-zA-Z0-9._-] → _`.

### 3.5 Realtime (Socket.IO)

Rooms since 2026-10-02 (`realtime/index.js` `joinRooms` on connection): `workshop` (super_admin/admin/staff/technician), `office` (super_admin/admin/staff), `client:<clients.id>` and `clientname:<lower name>` for client/recycle_client logins (via `clientModel.findByUserId`). **Never `io.emit` to everyone** — before rooms, every client received every other client's ticket messages and battery rows.
- `parts:out-of-stock`, `intakes:repeats`, `batteries:unserviceable-count` → `workshop`.
- `battery:updated` → full row to `workshop`; `{id, battery_code, status}` only to the owning `clientname:` room (web `BatteryDetailPage` just re-fetches on code match).
- `ticket:created|message|updated` → `emitTicketEvent()` = `office` + that ticket's `client:`/`clientname:` rooms.
Frontend: single shared socket in `services/socket-client.js`, connected by `DashboardLayout` when a token exists. Origin = `new URL(VITE_API_URL).origin`, wrapped in try/catch → falls back to `window.location.origin` (an undefined `VITE_API_URL` used to throw at module load and blank the whole app, login included).

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
- Technician dashboard/history (`TechnicianDashboardPage.jsx`, `TechnicianHistoryPage.jsx`, shared `work-outcome.js`) read `GET /staff/me`. Each repair job carries `outcome` (`completed|active|failed`, computed in `staff.model.findRepairs` from later repairs / returns / parts removal / current status) — **never derive "done" from `battery_status` alone**, it's the battery's status today and made old jobs vanish when the battery came back. `tests` = supervisor QA sign-offs from `battery_services.staff_id` (`findTests`; `passed_back` = the "Passed back to Technician" marker row). A test passed with no services ticked leaves no record. History type filters: Repairs / Testing / Unserviceable. Mobile `DashboardScreen`/`HistoryScreen` were updated to the same model on 2026-10-03/04.
- Technician web flow lives in `features/batteries/technician/` — `TechnicianRepairPanel.jsx` is the big state machine (start-work, log parts, testing, report issue, remove parts) and is kept in **feature parity with mobile `BatteryDetailScreen.js`**: scan-time modals (`?fromScan=true`: unverified intake → passed-back/parts-pending → unserviceable/recycled 3-section audit → already-repaired → parts-removed start-work → blocked "Not Available"), testing-failure flow (notes + photos → decision modal → confirm-remove / pass-to-tech), exit guard (`beforeunload` + capture-phase anchor click → confirm modal), lightbox. "Scan Next" goes to `/?autoScan=1` which opens the camera on `TechnicianHomePage`. Needs `history`, `issues`, `returns` props from `BatteryDetailPage`. Guard: **all** pending parts must be selected before `remove-parts`. `TechnicianHistoryPage` has the same calendar range picker as mobile.
- When changing a workshop flow, change **both** `mobile/src/screens/shared/BatteryDetailScreen.js` and `TechnicianRepairPanel.jsx` — they are parallel implementations, not shared code.
- Client sorting tool `ClientBatterySortPage.jsx` (+ mobile `ClientSortingScreen.js`): groups persisted server-side via `/clients/me/sort-groups`. **Never persist after a failed load** (see §7).
- Demo quick-fill logins: `config/demo-credentials.js`. `DEMO_LOGIN_ENABLED` gates the quick-fill buttons, the pre-filled super-admin email/password on `LoginPage`, and (via `null` exports + minifier DCE) whether the credentials exist in the bundle at all. **Current default is ON unless `VITE_ENABLE_DEMO_LOGIN === 'false'`** (flipped 2026-10-02; the audit fix had it off unless `=== 'true'`). Mobile `LoginScreen.js` quick-fill and the "Server" URL override are behind `__DEV__` (dead code in a release APK). Check the built bundle, not the source: `grep -l 'superadmin@gmail.com' dist/assets/*.js` after a `NODE_ENV=production` build.
- Login page (`features/auth/LoginPage.jsx`): light-only, `assets/REFURBNICS.png` logo (the old `logo.png` was deleted — don't re-import it), `features/auth/SplashIntro.jsx` plays a full-screen "Developed by Eswincha Technologies" fill animation **after a successful login** and navigates on the CSS `animationend` of `ew-sweep` (fallback timer 2.8 s; click/key skips). Only the name fades out — the white backdrop stays opaque until navigation, otherwise the login form flashes through. Styles are the `.ew-*` block at the end of `index.css`; the sweep is two counter-moving `transform`s (compositor-friendly), not an animated mask/clip-path (janky).
- `components/layout/shell/AppFooter.jsx` — "Developed by Eswincha Technologies" (blue/red), bottom-left, in every `DashboardLayout` branch; layout columns are `min-h-screen` so it sits at the bottom of short pages; technician layout adds `mb-16 md:mb-0` to clear the fixed bottom nav.
- Form conventions: first letter of every word auto-capitalised while typing (`capitalizeWords` = `value.replace(/(^|\s)(\S)/g, …)`) on Client Name (`ClientForm`), Reason (`IssueReasonForm`), Part Name (`PartForm`), Staff Full Name (`StaffForm`); Recycle Client name capitalises first letter only. Workshop role colour: technician **blue**, supervisor **red** (`StaffForm` select, `StaffPage` Role column, `StaffDetailPage` badge). `StaffForm` no longer auto-generates a temp password when the login toggle is switched on (Generate button remains).
- Generate QR page: selected mode tab (Individual/Bulk) = `bg-violet-600 text-white` in light mode.
- `auth-slice.js` `verifySession`: only a **401** clears the stored session; 5xx/network errors (Render waking) keep it. Same in mobile.
- Dark mode via Tailwind `dark:` classes; surfaces use `surface-800/900/950` custom colors.

---

## 5. Mobile (Expo)

```
src/navigation/RootNavigator.js  Login/SetPassword → Main(tabs) + BatteryDetail + client stack screens
src/navigation/MainTabs.js       role === 'client' ? Dashboard/MyBatteries/ScanQR/Profile : Service/Dashboard/History/Profile
src/screens/technician/*         ServiceScreen = scan + repair flow;   shared/BatteryDetailScreen = per-battery actions
src/screens/client/*             dashboard, batteries, scan, sorting, invoices, transactions, notifications, support
src/services/api-client.js       base URL: Metro LAN IP :5000 (Expo Go only — hostUri is undefined in a release build) → EXPO_PUBLIC_API_URL → fallback https://refurbincsuk.onrender.com/api. timeout 60 s (15 s made Render cold starts look like a broken app)
src/store/auth-slice.js          token in AsyncStorage; 401 → logout via injected store; verifySession only drops the session on a real 401
src/utils/imageUrl.js            mirrors web image-url.js (token query for protected uploads)
src/screens/auth/LoginScreen.js  quick-fill logins + "Server" override are __DEV__-only
src/screens/technician/ProfileScreen.js  change password sends currentPassword + newPassword (it used to omit currentPassword → always 400)
```
Syntax-check a screen with `node -e "require('@babel/core').transformFileSync(f,{presets:['babel-preset-expo'],filename:f})"` from `mobile/`. `npx expo start --tunnel` domains must not get `:5000` appended (handled). Release APK: Android blocks cleartext `http://` — the API URL must be https. Mobile code changes reach phones **only after a new `eas build`**; backend changes are live immediately.

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
| Deploy/CORS | Render env `DATABASE_URL`/`JWT_SECRET`/`CLIENT_URL`, Vercel env `VITE_API_URL`, `cors-origin.js` (any `*.vercel.app` allowed) |
| Render deploy fails at "migrate" with `28P01` | Neon password rotated → update `DATABASE_URL` on Render |
| Mobile login "took too long" / logged out on open | Render cold start; `api-client.js` timeout 60 s, `verifySession` keeps session on non-401 |
| Client sees "In Service" link / old Stage 2 page | removed; `/my/batteries/pending` → `/my/batteries/packed` redirect in `AppRoutes.jsx` |
| Truck detail table in client Packed view missing serviced/returned batteries | `findMyBatteries(…,'packed')` `packed_links` CTE; web `selectedBatch` must NOT swap in the current-intake list for `packed` |
| Client can pack a battery that isn't theirs / is mid-repair | `assertClientCanPack()` in `client.model.js` |
| Technician dashboard numbers wrong / supervisor shows no work | `staff.model.findRepairs` `outcome` CASE, `findTests`; web `work-outcome.js` |
| A role can call an endpoint it shouldn't | route file `requireRole(...)` — matrix in §3.1; smoke-test with a minted JWT |
| `/uploads/...` served without auth | the single gate in `app.js` (first normalised segment) |
| Live events reaching the wrong users | `realtime/index.js` rooms; never `io.emit` |
| Demo credentials in the production bundle | `DEMO_LOGIN_ENABLED` in `config/demo-credentials.js`; verify with a `NODE_ENV=production` build |
| Login page flashes between splash and dashboard | `.ew-splash--leaving .ew-credit` fades only the name; backdrop must stay opaque |
| Bulk QR 409 "already exist" | 7-digit vs legacy 4-digit numeric overlap check in `createManyForClient` |

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
24. **Loose "fallback" query after a strict ownership helper** (`client_id IS NULL` alone) silently re-opened the cross-client intake hole twice. If `findOwnedIntake()` returns nothing, the answer is 404 — never a second, weaker lookup.
25. **Dropping a role guard to "allow testers"** — there is no tester role; `passToTech`/`completeTesting`/`startTesting` are all `staff.role === 'supervisor'`. Keep the three guards identical.
26. **Scan modal offering an action the handler rejects** (Start Work on `tested_parts_removed`). When a status becomes non-startable, update the scan-effect branch AND `BLOCKED_STATUS_MESSAGES`.
27. **Async scan handler without an in-flight lock** → duplicate lookups/navigations from one QR frame burst. `scanInFlightRef` in `TechnicianHomePage`.
28. **`const` referenced in a `useEffect` deps array above its declaration** → TDZ `ReferenceError` on every render; `vite build` does NOT catch it. Declare derived values before the first hook that reads them (or reuse the existing one — `needsPartsRemovalOnScan` was just `isPassedBack`).
29. **Guard checked against the URL's intake, mutation applied to the battery's real intake** (`removeBatteryFromClientTruckIntake`). Validate against `targetBattery.truck_intake_id`; reject a mismatch.
30. **Three copies of the supervisor check drifted** → `resolveTestingStaff(user)` in `battery.controller.js` is the single QA-permission rule for start/complete/pass-to-tech.
31. **Moved JSX SVG path lost tokens** (`… 9.75-9.75 9.75S…`). Diff icon paths against an intact copy.

32. **Query-string value interpolated into SQL** (`WHERE type = '${type}'` in `findMyNotifications`) → UNION-based read of any table from a client login. Whitelist to known literals or use `$n`.
33. **"TEMPORARY" bootstrap endpoint shipped** (`/auth/register`, public, grants super_admin). Fixed with `anyExist()`, then re-opened by a later "Create Account page" commit. Any unauthenticated route that creates privileged rows must be gated by "no users exist yet" or `requireRole('super_admin')`, and the route comment must match the code.
34. **`requireAuth` without a role** on read routes (staff, clients, batteries, parts, dashboard, tickets, invoice download) = every client/technician login could read staff salaries/passports, other clients' billing, all batteries and part prices, and bulk-create 50k rows. Every route needs a role or permission, not just a login.
35. **Ownership check only for one role** (`if (role === 'client')` on invoice download / serial-number) leaves `recycle_client`, `technician`, `staff` unscoped. Check "allowed roles" first, then ownership for the client roles.
36. **Per-folder static mounts matched on the raw URL** → bypass via `//`, `%73`, `..`. Normalise + decode once in a single gate.
37. **`io.emit` to all sockets** = cross-tenant data leak. Rooms per role/client (§3.5).
38. **Public endpoint returning the full admin payload** (`/batteries/:code` with prices and staff ids for anonymous QR scans). Trim by `req.user` presence.
39. **Hard fallbacks in shipped config** (`|| '12345678'` demo passwords, LAN IP API URL, `VITE_ENABLE_DEMO_LOGIN === 'false' ? false : true`). Secrets/dev values must default to *off/empty* in production and be verified in the built bundle.
40. **401 for a user-input error** (`'Current password is incorrect'`) → the global 401 interceptor logs the user out before they see the message. Reserve 401 for "session invalid".
41. **Session wiped on any `/auth/me` failure** (timeout, 5xx while Render wakes). Only a 401 means the token is bad.
42. **Status mutation committed before the error path** (`removeParts` updated `status='tested_parts_removed'` then the controller returned 409 for zero rows). Decide → mutate → commit, in that order; roll back on the "nothing to do" branch.
43. **Idempotency missing on state transitions** (`verifyArrival` twice reset every battery). `WHERE status IS DISTINCT FROM 'verified'` + 409 when 0 rows.
44. **Unbounded count from the request** (`batteryCount` built N code strings → OOM). Cap every user-supplied N.
45. **Async controller without try/catch on Express 4** (`me()`) + `pool.on('error') → process.exit(1)` = whole API down on a Neon idle-connection drop. Every handler catches; pool errors are logged only; global `unhandledRejection` logger.
46. **Form sends half the payload the API requires** (change-password without `currentPassword` on two screens) → feature "always fails". When a backend validation is added, grep every client (web + mobile) that calls the route.
47. **"Done" derived from a mutable foreign status** (`battery_status` on repair rows): history rewrote itself whenever the battery moved. Compute a per-event outcome server-side from facts that don't change (later repairs, returns, removed_at).
48. **Inner join on a nullable FK** (`JOIN issue_reasons`) silently dropped rows after the column became nullable (045). When a migration drops NOT NULL, grep for inner joins on that column.
49. **New-format IDs collide numerically with old-format IDs** (`HUM-0000001` vs `HUM-0001` both "1"; UNIQUE on the string doesn't help). Compare the parsed number range, not the string.
50. **Test inserts into a shared DB without a transaction** (500 `HUM-000xxxx` rows created by a `createManyForClient` test, 2026-10-02; cleaned up). Test write paths inside `BEGIN … ROLLBACK`, or against a throwaway DB, and confirm `DATABASE_URL`/`DB_HOST` first — `env.js` may be pointing anywhere.
51. **Fixed-duration splash vs. real animation end** → either the login form flashed through or the user waited idle. Drive navigation from `animationend`, keep the backdrop opaque, and keep a fallback timer.

Meta-rules: prefer 409/400 with a message over silently writing NULL; anything that *replaces* a set server-side must never run from a default/empty client state; every `requireRole` widening needs a matching DB-constraint check.

---

## 8. Open risks / TODO (not yet fixed)

**Live security holes (as of 2026-10-05, commit `0ecaf21`)**
- 🔴 `POST /api/auth/register` is public and every account it creates is `super_admin` (`auth.controller.js:98`). Confirmed on the Render deployment (returns 400 for an empty body, i.e. reachable). Web pages `/register`, `/create-account`. Fix: `requireRole('super_admin')` on the route (or `anyExist()` bootstrap gate), remove the role hard-code, drop the public pages. **Also audit `users` on the live DB for accounts nobody recognises** — this was open for weeks.
- 🔴 Demo logins (super admin, HumanForest, recycle, two technicians, shared password) are **on by default** in the Vercel bundle (`DEMO_LOGIN_ENABLED` default true). Those passwords are also in git history → rotate them on the live DB regardless.
- 🟠 CORS allows any `https://*.vercel.app` origin. Low impact today (bearer tokens, no cookies) but it's a blanket allow.
- 🟠 Uploads (client logos, invoice PDFs, issue photos, staff docs, return docs) are on Render's ephemeral disk → lost on every deploy/restart; DB rows then 404 "File is no longer on disk". Needs a Render persistent disk mounted at `/app/uploads` or object storage.
- 🟠 Three staff ID-card PNGs, invoices and issue photos are tracked in git (`24265f1`). Removing them properly means a history rewrite + force push.
- 🟠 JWT in `?token=` for `<img>`/`<a>` (upload URLs) → tokens in Render/morgan access logs and browser history.
- 🟡 Deleting a client cascades to invoices, tickets, ratings, certificates, sort groups (`ON DELETE CASCADE`, migrations 032/035/039/040/049); Trash Bin stores only a JSON snapshot of the parent row and has no restore.
- 🟡 `createIntakeWithBatteries` is three separate pool queries (intake insert, `createMany`, `addVisitMany`) — not one transaction.
- 🟡 Returns/recycle/repairs don't validate the battery's current state before writing; `repair.model.remove` can double-restock (ignores `removed_at`, no row lock); labour charge comes from the request body.
- 🟡 Upload filters: issue photos have no file filter; invoice/staff filters use `&&` (pass if mime OR ext looks right); SVG logos served publicly.
- 🟡 `migrate.js` has no advisory lock and the `schema_migrations` insert isn't in the same transaction as the migration → two instances booting together, or a crash between the two statements, re-run a non-idempotent file.

**Older items still open**
- `'staff'` user role referenced everywhere but not in `users_role_check` → either add a migration or strip the dead branches.
- No automated tests; no lint config for frontend (`oxlint` listed but no config), backend has none.
- `time-api.js` depends on public internet clock APIs (`timeapi.io`) — fails silently offline.
- Frontend `hasClientPermission` treats empty permissions as "all" — intentional but surprising.
- Duplicate migration numbers `015`, `023` (safe, but keep numbering strictly increasing from **054**).
- Supervisor QA work only appears in their dashboard/history when at least one test service was ticked (no sign-off record otherwise).
- Mobile client "Packed" tab now shows historical (serviced/returned) batteries too, since the backend bucket became a history view — intended for web, not yet re-designed for mobile.

---

## 9. Fix log

- **2026-10-05** — Full re-analysis for this file. Verified in code which audit fixes survived the 20 commits since 2026-10-01 (all route guards, uploads gate, socket rooms, rate limit, packing guard, 7-digit IDs, `/staff/me` outcome/tests did; registration lock and demo-login default did **not** — see §8).
- **2026-10-03/04 (user)** — Sidebar reorganisation, certificate layout, unserviceable workflow, finance UI, staff & part detail pages, client billing/workshop tracking, mobile technician Dashboard/History parity, supervisor parts-removal flow + test success modal, migration `053_issue_failed_testing.sql`, CORS widened to all `*.vercel.app`, Create Account page (`/register`, `/create-account`) hard-coded to super_admin, demo logins default-on, quick-fill cards for mobile accounts. A "save testing duration on test submit" change was committed and reverted the same day.
- **2026-10-03** — Technician web Dashboard/History: `outcome` per repair job, supervisor `tests` from `battery_services`, `LEFT JOIN issue_reasons`, PII/pricing stripped from `/staff/me` (`staff.model.js`, `staff.controller.js`, `work-outcome.js`). Forms: word-capitalisation on Reason/Part Name/Staff Full Name, technician blue / supervisor red, no auto temp password.
- **2026-10-02** — Security audit (3 read-only review passes: auth/access, data handling, frontend+mobile) and fixes: register bootstrap-only (`anyExist()`), notifications `type` whitelist (SQLi), role guards on ~20 read/write routes, ticket/invoice/rating scoping, `assertClientCanPack()`, single `/uploads` gate (invoices 404, staff-docs office-only), Socket.IO rooms, anonymous QR payload trimmed, login rate limit + `trust proxy`, `removeParts`/`verifyArrival` guards, intake count cap, `me()` try/catch + `unhandledRejection` + pool error no-exit, change-password 400, demo logins gated (web `DEMO_LOGIN_ENABLED`, mobile `__DEV__`), mobile 60 s timeout + session kept on non-401 (web too), `socket-client.js` URL guard, current-password field on mobile Profile + web TechnicianProfile. Verified with 24 curl checks against the local API (client token 403 on office routes, bypass paths 401, limiter 429 on the 11th attempt). Also: 7-digit battery IDs with legacy-overlap check; 500 accidental test rows removed from the local DB.
- **2026-10-01** — Hosting: Render (API) + Neon (DB) + Vercel (web) + EAS Android APK; `mobile/eas.json`, package name, Render URL fallback. Login page light-only with new logo, post-login Eswincha splash, app footer. Client portal: Stage 2 "In Service" removed (redirect), Packed bucket turned into truck history (`packed_links`). Admin Add Client name word-capitalisation. Generate QR tab violet.
- **2026-09-25** — Review of the uncommitted "sort groups / return docs / recycle weight" batch (47 files): fixed the 14 items in §7 across `battery.controller.js`, `battery.model.js`, `client.model.js`, `return.routes.js`, `app.js`, `image-url.js`, `imageUrl.js`, `TechnicianRepairPanel.jsx`, `BatteryDetailPage.jsx`, `ClientBatterySortPage.jsx`, `sort-groups.js`, `ClientSortingScreen.js`. Verified with `vite build` + backend module load.
- **2026-09-27 (later)** — Fifth pass over the fix commit: TDZ crash in `TechnicianRepairPanel` (alias removed, dead Start-Work modal + state deleted), `removeBatteryFromClientTruckIntake` intake-mismatch 400, scan lock held through navigation, `resolveTestingStaff()` helper for all three QA handlers (covers legacy `'staff'` role), leftover inline intake predicate on `BatteryDetailPage`, unreachable notice removed from `ClientBatteriesPage`.
- **2026-09-27** — Fourth pass (10 findings over 18 commits incl. user's mobile/intake work): removed both `client_id IS NULL` fallbacks + remove-battery 404 (`client.model.js`), restored supervisor guard on `passToTech`, scan-effect fixes (parts-removed → blocked, unserviceable+pending → removal modal), scan in-flight lock, shared `isIntakeUnverified()` (web `utils/permissions.js`, mobile `utils/intake.js`), `ClientBatteriesPage` `resolveBatchIntakeId()` + Cancel-Batch guard + notice banner instead of `alert()`, unused mobile import.
- **2026-09-26 (later)** — Web technician panel brought to parity with the mobile app: blocked/repaired-by/unserviceable-audit/parts-removed scan modals, richer passed-back modal with "Continue to Remove Fitted Parts" + confirm, testing-time photos + decision modal, exit-session guard, photo lightbox, `?autoScan=1` camera reopen, history calendar range picker (`TechnicianRepairPanel.jsx`, `TechnicianHomePage.jsx`, `TechnicianHistoryPage.jsx`, `BatteryDetailPage.jsx`).
- **2026-09-26 (later)** — Third pass over `3e22db8..HEAD` (10 findings): `findOwnedIntake()` helper with all-batteries rule, returns-branch guard in `CLIENT_BATTERY_IDS_CTE`, `includeTesting` derived from role only, `LATERAL` single-client join + `buildDateRangeWhere()` in `finance.model.js`, `in_progress` back in the technician typeahead, recycled-date filter no longer matches registration date, dead `unserviceable_*` aliases removed, `parseBatteryIds()` + orphan-file cleanup in `return.controller.js`. SQL smoke-tested against local DB.
- **2026-09-26** — Second review pass (10 findings + 3 lows): cycle-scoped `pending_parts_count`/`is_passed_back` (`battery.model.js`), intake ownership tightened + billing from first verified visit (`client.model.js` `BILLABLE_BATTERIES_CTE`), reconciled recycle revenue with proper period labels (`finance.model.js` `recycleRevenueByPeriod`), async return-doc writes + old-file unlink + `returnedAt` validation (`return.controller.js`), sort-page save guards/error banner, shared `canTestBatteries()` in `utils/permissions.js` (dropped `/staff/me` fetches), `TruckIntakeDetailPage` testing count, mobile no-op re-save skip. All rewritten SQL executed against local DB.
- **2026-09-25** — Workshop roles reduced to `technician` + `supervisor` (manager/tester/qa removed) in backend guards, web + mobile UI, `StaffForm` dropdown; `staff.controller` validates; migration `052_staff_two_roles.sql` converts old rows and adds a CHECK.
