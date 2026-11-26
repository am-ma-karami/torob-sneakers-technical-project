# Admin panel and store funnel

The first admin module is at `/admin`. It reports each shoe × source retailer pair's distinct viewers, distinct clickers and click-through rate, with Tehran date ranges, shoe/store search, merchant/market filters, activity-only mode and pagination. All currently displayed `ShoeStoreLinks` merchants are included, even with zero activity. Historical retailer identities remain reportable if a future feed retires their listings. No historical traffic is invented or backfilled.

## Definitions

- A view qualifies when at least 50% of a store row is continuously visible for one second in a visible browser tab. Loading offers off screen does not count. Impressions are batched (at most 24 references/request), with best-effort keepalive delivery.
- Purchase-button clicks navigate through `/api/out/{shoe_id}/{offer_key}`. The destination is looked up and validated on the server, never taken from a URL query. Ordinary, keyboard and new-tab/middle clicks are supported. Prefetches and embedded subresources are not counted. A telemetry write failure does not block an already validated destination.
- One anonymous browser is counted once per shoe/source-retailer within the selected period, regardless of page reloads, multiple listings/colorways for that store, repeated clicks or activity on several days. The stored daily uniqueness supports date filtering; reports use distinct browsers across days, not the sum of daily distinct counts.
- A click also records a corresponding view when necessary, keeping clickers a subset of viewers in the same reporting range. This is a purchase-intent click, not a completed payment or order.
- This identifies browsers, not authenticated people. Another device, a cleared cookie, privacy controls, blocked scripts or automated traffic can affect measurement. Valid admin sessions are excluded. DNT/GPC requests are respected.

The visitor ID is a random 256-bit first-party HttpOnly/Lax cookie, scoped to `/api`, with a 180-day lifetime. Only its SHA-256 digest is stored in traffic rows. Customer IP addresses, user agents and raw cookie tokens are not stored in analytics or exposed in the dashboard. Event dates are generated server-side in `Asia/Tehran`; clients cannot submit their own dates, identities or event types.

## Account setup

Apply migration `004` first. It creates separate admin user/session/throttle tables and `store_traffic_daily`; catalog, store prices and histories are untouched.

```sh
make migrate
# Interactive password entry (12–256 characters):
.venv/bin/python -m app.admin --username admin
# Or generate credentials into an ignored, owner-only local file:
.venv/bin/python -m app.admin --username admin --generate-password
```

Generated credentials are in `.local/admin-access.json` (mode 0600), outside Vite's public root and outside Git. The command never prints the password and refuses to overwrite an existing credential file or admin username. Keep this file private. Accounts are not created from public HTTP endpoints. Docker operators can run the same module interactively with `docker compose exec backend python -m app.admin --username admin`; container execution is not verified on this workstation.

Passwords use salted PBKDF2-HMAC-SHA256 with 600,000 iterations using Python's standard library. See the [OWASP password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Admin sessions are random 256-bit opaque cookies; only hashes are stored in PostgreSQL. They expire after 12 hours by default, rotate on login and are revoked on logout. Cookies are HttpOnly and SameSite Strict. Login uses persistent per-account and per-peer throttles; untrusted forwarded-IP headers are ignored. Logout requires a session-bound CSRF header and an approved origin. Private API responses use `Cache-Control: no-store`, and logout clears the frontend's private report cache. See [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Local HTTP uses `ADMIN_COOKIE_SECURE=false`. For an HTTPS deployment set `ADMIN_COOKIE_SECURE=true` and configure `CORS_ORIGINS` with the exact browser-facing origin. This is forwarded into the backend by Compose. Do not use public plaintext HTTP for admin credentials. `ADMIN_SESSION_HOURS` can be set from 1 to 168. Browser cookies go through the existing same-origin Vite/nginx `/api` proxy; tokens are not stored in localStorage or in URLs.

## Module boundaries

- `backend/app/core/admin_auth.py`: password/session/CSRF/throttle helpers.
- `backend/app/api/admin.py`: protected admin endpoints, public qualified impressions and validated outbound navigation.
- `backend/app/repositories/analytics.py`: filtered aggregation; read-only admin queries.
- `backend/app/models/admin.py`: persistent accounts and measurements, independent of offer import ownership.
- `frontend/src/pages/Admin.tsx`: authenticated admin shell and the first reporting module. Future admin modules should reuse this boundary and server-side auth.
- `frontend/src/lib/storeTracking.ts`: visibility qualification, batching and nonblocking impression transport.

APIs: `POST /api/admin/login`, `GET /api/admin/session`, `POST /api/admin/logout`, `GET /api/admin/analytics/stores`, `POST /api/analytics/store-impressions`, `GET /api/out/{shoe_id}/{offer_key}`. There is no public analytics report endpoint. Date ranges are inclusive Tehran calendar dates (Gregorian inputs), at most one year. Sorting supports viewers, clickers, rate and shoe name.

## Verification

PostgreSQL regressions cover unauthenticated access, password hashing, session expiry/disable/revocation, CSRF and origin rejection, persistent login throttling, repeated events, separate anonymous browsers, unique counts across dates, click-before-observer behavior, admin exclusion, opt-out, prefetch suppression, safe redirect lookup, empty periods, filters and pagination. Existing migration/schema-parity and catalog/store tests continue to pass. UI tests cover session transitions, filter requests, logout cache clearing and continuous visibility qualification; new browser tests load credentials only from the private local file and intercept external navigation. Their exact anonymous test visitor hashes are retained only in ignored `.local/admin-e2e-visitors.json` for targeted cleanup after the run.

Local verification on 2026-11-26: 101 backend tests and 30 frontend unit tests passed, alongside lint/type checks and a production build. Real desktop/mobile browser tests verified login, visible impressions, repeated outbound clicks, merchant filtering, protected responses, private-file denial and logout. The existing store journeys passed on desktop/mobile. Test visitor records were removed by their exact generated hashes; the live store/shoe datasets remained at 1167 shoes and 12375 offers, with zero fabricated traffic rows left after cleanup. Mobile reports use stacked cards so both counts remain visible without horizontal scrolling. The local database was backed up before applying migration 004. General browser tests now send DNT=1; only the controlled analytics-test browser explicitly uses DNT=0.
