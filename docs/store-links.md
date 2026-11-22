# Domestic and foreign store prices

The supplied `shoe-store-links.csv` is imported as the independent `ShoeStoreLinks` source. The original remains unchanged in Downloads; the byte-identical working copy lives in ignored `.local/imports/shoe-store-links.csv`. CSV rows and database credentials are not bundled into the frontend or committed.

The supplied 7557 rows cover all 1167 exact catalog model IDs and names. Six rows share three identical Backcountry purchase URLs across distinct model IDs (Rebel/Propel, Supernova Rise/Solution and Hurricane XLT3/Closed Toe). Both conflicting assignments are quarantined before writing listings. The accepted 7551 rows comprise 176 domestic and 7375 foreign links. 7274 have prices; 277 explicitly remain unpriced. Historical catalog feeds remain intact.

## Monetary contract

Original amounts and currencies are preserved. IRT is the application's explicit toman unit; it is not an ISO currency. IRR is divided by 10. A supplied domestic `price_toman` must reconcile with `price` and its declared unit. Foreign currency is never inferred from the country/domain. Missing amounts/currencies stay null, not zero or MSRP. The domestic IRR example is 68,463,000 rial = 6,846,300 toman.

Foreign USD, EUR, GBP and AUD amounts are multiplied by a separately stored free-market quote using Decimal, rounded half up to whole tomans only for display. Conversion does not rewrite source prices or create price-history observations. `price_toman` and `conversion` in the offer API provide the result, rate, source URL, retrieval timestamp, source's own time label and stale-cache indicator. Shipping, customs and taxes are not added without source data.

The public fixed TGJU profile pages provide explicit IRR units. The parser reads only `info.last_trade.PDrCotVal` and the table's published quote-time label, validates them and divides the rate by 10. The retrieval time is separate from the source label; a source date such as `1 آذر` is not falsely expanded into a precise update timestamp. No central-bank rate, USD/USDT equivalence, guessed cross-rate or fallback constant is substituted. Failed or malformed refreshes preserve the last good quote per currency. After 24 hours without a successful retrieval the conversion is marked stale; absent quotes leave the toman amount unknown while keeping the original amount visible.

## Refresh and import

```sh
make migrate
make rates
make import-stores
# For a new file, with a properly quoted path:
.venv/bin/python -m app.importers.store_links /absolute/path/shoe-store-links.csv
```

Set `FX_AUTO_REFRESH=true` to retrieve the four references on backend startup and every `FX_REFRESH_SECONDS` (default 3600). This runs asynchronously, with bounded timeouts; rendering a store list reads the four cached database rows and does not call external sites. Shutdown cancels the refresh task. `FX_STALE_HOURS` defaults to 24. Local startup enables refresh in the private environment, and Compose enables it for the internal backend. Tests explicitly disable network refresh.

Compose users can place the CSV in `.local/imports/shoe-store-links.csv` and run `docker compose --profile tools run --rm stores-importer`. The importer mounts the file read-only. This workstation has no Docker runtime; container execution is not claimed as tested.

The reviewed exact-host manifest is `backend/app/content/store-retailers.json`. Incoming CSV rows cannot grant their own hosts trust. HTTP links on the two original origins (`www.adidas.com`, `runningxpert.com`) are normalized to HTTPS after checking their TLS transport; automated requests may receive vendor bot protection, so this does not certify each product page. URL path spaces/non-ASCII text are percent encoded; control characters and unapproved hosts are rejected. Original source assertions (`page_verified`, `listed_by_source`, authenticity and matching flags) remain provenance, not new verification claims by the application. The CSV does not provide exact color/size inventory; offers remain model-level.

The report `.local/store-links-report.json` contains the source hash, accepted/unpriced/market/rejection counts and reasons. Repeated or reordered imports create no new listings/history. Import never overwrites other sources; general catalog reimports also preserve the store source. A fresh source observation timestamp is required before reporting current stock; old CSV stock becomes unknown after the normal stock TTL.

## Product experience

Each detail page has a direct link to the store section, a domestic/foreign/all market filter, six listings per page and ascending toman prices with unknown prices last. Foreign rows also show the original amount. A shared rate basis shows the source link, retrieval time and source's published time label. Store links open a new tab with `noopener noreferrer nofollow`. Missing prices, missing exchange references, empty markets and retryable API failures have explicit states. Numerals remain Latin in both amounts and dates. Responsive rows become cards on narrow screens without horizontal overflow.

Use `GET /api/shoes/{slug}/offers?source=ShoeStoreLinks&sort=price_toman&market=iran` (or `foreign`). `market_counts` provides counts for the model/source; `sort=price_toman` uses explicit cached rates to compare converted amounts. Existing `sort=price` still requires a currency. Existing MSRP catalog filters retain their previous semantics. Migration `003` adds quote storage, market indexing and nullable original amounts. Its downgrade refuses to discard unpriced listings.

## Verification (2026-11-23, Asia/Tehran)

- 88 backend PostgreSQL/API tests passed, including native toman, IRR division, foreign conversion, missing quotes, provider failure retention, CSV idempotency, market filtering and ambiguous model assignments. Populated migration/schema parity remains covered.
- 25 frontend unit tests, lint, TypeScript and production build passed.
- Seven existing desktop search/detail/comparison/finder journeys and two real-browser store journeys passed at desktop/mobile sizes. Both layouts were visually inspected, with Latin digits, visible quote provenance, correct domestic prices and no horizontal overflow.
- Reimport of all 7557 input rows took 15 seconds and changed no listing/history counts: 12375 total offers and 17114 observations, preserving all 4824 earlier-source offers. The store source contributes 7551 usable links and 6 deduplicated quarantine records. Original input SHA-256: `686839945ff3a42cc1d7ac92a02bca99beb5e9aa1793a849d4b4818c43878cdf`.
- The local database was backed up before migration 003. Raw input, credentials and private backups remain outside Git.
