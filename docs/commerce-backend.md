# Retailer ingestion foundation

This change prepares storage and read APIs for retailer datasets. The initial foundation is extended by the supplied retailer CSV, sourced exchange references and storefront UI described in [store links](store-links.md). Checkout and scraping remain outside this implementation.

## Storage and migration

Run `alembic upgrade head` before starting the new backend. Revision `002` adds typed `offer_listings`, `source_products`, immutable `offer_observations` deduplicated `offer_rejections`, and per-source completed-snapshot watermarks. Monetary amounts use PostgreSQL `numeric(14,4)` and Python Decimal. Negative, boolean, non-finite and malformed prices are rejected before writes. ISO currency codes are validated; amounts in different currencies are never compared. `price` stays a JSON number for existing clients; `price_amount` is the exact decimal string.

The old `offers` table remains an archive. Migration validates and copies usable legacy offers, preserving rejected rows in both the old table and rejection storage. Apply this online; copying legacy JSON requires validation in Python. No table containing existing source offers is dropped. The migration regression test upgrades a populated v001 schema, verifies copies/rejections/archive preservation and compares the resulting schema to SQLAlchemy metadata. Its version table is explicitly isolated from the public schema.

Re-run the catalog importer after migration to populate the newly retained raw inventory fields and the previously ignored SoleHunt offers. In the supplied snapshot, 4739 RunRepeat and 85 SoleHunt listings have usable HTTPS purchase links. The 118 HTTP RunRepeat links and 218 SoleHunt records without purchase URLs are quarantined, not invented or upgraded to HTTPS without verification. Original records remain in private source storage. `.local/import-report.json` includes rejection counts. The older `docs/import-report.json` is a historical report, not the current database count.

## Import contract

`OfferInput` in `backend/app/schemas/offers.py` is the normalized contract. `source`, `retailer_id`, `external_id` (listing identity) and `source_product_id` (product identity) are mandatory. An offer key is a hash of source, retailer and external listing ID, never array position, price or timestamp. The RunRepeat adapter has no vendor listing ID, so it derives an identity from retailer ID, exact color ID (or explicit any-color) and the source listing URL. A changed source URL can therefore create a distinct listing; new feeds should provide stable listing IDs.

Mappings are explicit. Within one transaction, call `map_product(session, source, external_id, shoe_id, variant_key, sku=..., gtin=...)` for reviewed exact matches, then `refresh_offers(session, shoe_id, source, normalized_rows)`. Register a stable source product ID for each exact model/color identity. A model-level listing uses a null variant. No fuzzy name or family heuristic is used for purchase links. GTIN checksum and SKU length are validated; neither identifier is fabricated. Existing mappings cannot silently move to another shoe or color. Composite database foreign keys also enforce shoe/color and source-product ownership.

The importer owns `catalog` measurements and variants, and updates only its own offer sources. It preserves independently owned measurements, variants, listings and mappings. Existing color records remain available for external references. All catalog changes stay in one transaction. Feed refreshes take a transaction-scoped lock per source and shoe; older observations cannot replace newer ones. Repeated identical imports add no duplicate listings or history rows. Conflicting duplicates in one batch are quarantined instead of choosing a row by array order.

Refreshes are partial by default. To retire absent offers, explicitly pass `complete=True, snapshot_at=<timezone-aware snapshot time>` for a complete snapshot of **one source and one shoe**. Missing offers then become unknown/expired, rather than being deleted. Dirty batches do not retire absent offers; an older complete snapshot cannot retire newer observations. An adapter that rejects rows before calling the service must pass their number as `rejected_rows`. A live stock provider/scheduler is a separate future integration.

## Stock and sizes

`availability` is `in_stock`, `out_of_stock` or `unknown`. `checked_at` must describe a source stock observation, not the import time. A collection `snapshot` alone does not verify stock. `expires_at` is capped at `checked_at + OFFER_TTL_HOURS` (24 hours by default, maximum 168). Missing/expired checks yield effective unknown availability. `observed_availability` retains the historical state and `freshness` explains its age. `live_verified` always remains false for imported snapshots.

Exact stock rows contain `size`, `size_system` (`EU`, `US_M`, `US_W`, `UK`, `CM`, `JP`), optional `width` and their own availability. Size/width filters must match the **same** in-stock inventory row and a fresh in-stock offer. No Cartesian combination of sizes and widths is assumed. RunRepeat's raw compressed size string and width bitmask are retained as `sizes_available_raw` and `available_widths_raw`; generic brand conversion charts are never used as inventory.

`country` is the listing's source market. `shipping_countries` is independent, explicit delivery coverage. A DE-market offer with no delivery information is not automatically shippable to Germany, Iran or anywhere else. Costs are item prices; shipping, taxes and customs are not included without corresponding source data.

## Read APIs

`GET /api/shoes/{slug}/offers` returns `items`, `total`, `page`, `page_size`, `pages`; maximum 48 items per page. Filters: `source`, `retailer_id`, `variant_key`, `currency`, `country`, `ships_to`, `availability`, `fresh_only`, `size` + `size_system`, `width`, `price_min`, `price_max`. Sorting: `retailer`, `recent`, `price`. Price bounds or price sorting require a currency. Size/system must be supplied together. Missing models return 404; malformed filters return 422.

Example: `/api/shoes/adidas-adizero-evo-sl/offers?currency=EUR&sort=price&page_size=20`.

Existing shoe details include only the first 20 offers with `offers_total` and `offers_page_size`; use the paginated endpoint for the rest. Comparison, featured and score endpoints no longer load offer lists. Existing detail/color/measurement output remains compatible. Raw rejection records and source archives are never returned publicly.

Catalog's existing `price_min`, `price_max` and `sort=price` still mean manufacturer MSRP in USD. Separate `offer_currency`, `offer_country`, `offer_ships_to`, `offer_price_min`, `offer_price_max`, `offer_available=true` and `sort=offer_price` constrain matching store listings. Price sorting/bounds require `offer_currency`. All offer constraints apply to one matching listing. No exchange rate is inferred; the existing converted MSRP display stays a reference price.

## Link policy and deployment

Purchase URLs must be HTTPS, without credentials, IP literals, local names, nonstandard ports or control characters. The source/retailer pair must have an operator-approved exact hostname, including any affiliate network and explicit redirect destination. Feed records cannot approve their own domains. Existing source domains are in `backend/app/core/commerce.py`; additions use reviewed code or the server-only `RETAILER_DOMAINS` JSON setting. Redirects are not fetched and the policy does not claim to verify the final merchant page or live stock.

Compose exposes only nginx. Production `RATE_LIMIT_BACKEND=proxy` uses nginx's shared memory quota by actual peer IP (4 requests/second with a 40-request burst), across nginx workers and backend workers. nginx overwrites forwarded-IP headers. Uvicorn ignores proxy headers; the app never trusts user-supplied forwarding headers. Health probes reach the internal backend directly. Local development uses a bounded in-process limiter; `/api/health` and `/api/ready` do not consume its quota. Do not expose the backend directly with proxy mode. A deployment behind another load balancer must configure nginx's real-IP trust for that infrastructure explicitly; multi-edge/global quotas require an upstream shared limiter.

PostgreSQL regression tests and frontend compatibility tests run locally. Docker/nginx execution requires a container-capable environment; no container runtime is installed on this workstation.

## Adding the next dataset

1. Obtain the feed's stable product/listing IDs, currency, market, stock timestamp, exact size units and purchase URLs.
2. Review merchant/affiliate hosts and configure the allowlist independently of the feed.
3. Build a source adapter that produces `OfferInput` rows; send invalid/unmatched records to rejection storage with a reason.
4. Review exact product/color mappings and register them explicitly. Keep unresolved matches out of purchase results.
5. Refresh through the service in a transaction. Declare complete snapshots only when that guarantee exists.
6. Decide refresh cadence against the source's update policy and test stock expiry before adding the store UI.

## Verification on 2026-11-23 (Asia/Tehran)

- Backend: 81 PostgreSQL/Pydantic/API tests passed, including populated migration, schema parity, reordered imports, cross-source preservation, invalid records, exact size/width pairs, expiry, stale complete snapshots and forwarded-header spoofing.
- Frontend: 22 unit tests passed; TypeScript and production build passed. Seven desktop browser journeys passed for search, detail/color selection, comparison, URL restoration, error fallbacks and finder behavior.
- Live local HTTP: readiness, catalog offer filters, shoe detail, paginated EUR offers, SoleHunt offers, comparison, featured and scores returned 200. Price sorting without currency returned 422.
- Full import repeated: 1167 shoes, 27048 measurements, 3845 variants, 4824 listings, 9563 immutable observations, 336 quarantined records, 4824 source mappings and 1167 source archives stayed unchanged. The repeated full import took 27.3 seconds. Observations include the original migrated snapshot plus the enriched imported records; repeated imports add none.
- A private PostgreSQL backup was created before the additive local migration. No dataset or private environment file is committed. Container/nginx runtime checks remain pending on a host with Docker/nginx installed.

Revision `003` adds explicit domestic IRT/IRR support, nullable unknown prices, market filters and free-market conversion metadata; see [store prices](store-links.md).
