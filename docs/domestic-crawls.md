# Reviewed domestic retailer crawls

Nine supplied 2026-11-26/27 crawl packages supplement, rather than replace, the
existing `ShoeStoreLinks` feed. The website and admin funnel already consume that
source, so no schema migration or new frontend production component is needed.

## Current import

| Retailer | Source rows | Accepted model-level links |
| --- | ---: | ---: |
| Kafshesport | 1111 | 0 |
| Mahabad Katoni | 285 | 74 |
| NP Style | 145 | 85 |
| Padoon | 451 | 46 |
| Pelaza | 29 | 0 |
| Red Kicks | 949 | 397 |
| Safir Sport | 193 | 39 |
| Xtep Iran | 50 | 0 |
| Allsport (2026-11-27) | 6727 | 0 — pending |
| Total | 9940 | 641 |

The original eight-package import added 641 listings covering 195 canonical models and 270 shoe/store pairs.
Domestic `ShoeStoreLinks` listings increased from 176 to **817**; foreign listings
remain **7375**. Total offer storage is **13016**, retaining all **12375** earlier
offers. Existing shoes, measurements and variants remain 1167/27048/3845.

The remaining 2572 rows are pending, not guessed matches. Kafshesport and Pelaza
have unresolved product-level originality evidence; mixed-store claims are not
silently upgraded to individual original-product assertions. Xtep has no matching
canonical brand/models in the supplied catalog. Other pending rows include missing
exact model/generation evidence, conflicting style codes, unknown age editions,
zero/test prices and variant-dependent price ranges. For example, a shared source
code attributed to both Supernova Rise and Stride was left pending. A correct brand
or a similar family name is insufficient.

### Allsport review — 2026-11-27

The additional package is one merchant, `allsport.ir`, with **6727** unique product
rows. All remain **pending**, without canonical assignments or new purchase offers.
Its cards explicitly mark **5994** unavailable; **733** have unknown stock. **725**
have positive IRT prices, which do not establish stock. One source row (`9243`) has
an empty title and cannot validate as an offer. An offline candidate pass found
824 possible title matches (95 not explicitly unavailable); these are suggestions,
not approvals. Ten representative product pages across candidate model groups were
checked: their primary quality property says `تولید داخل`. This is unresolved
evidence for attaching them to the catalog's original branded product identities;
it is not a finding about every listing or an independent authenticity judgment.
`Adidas Originals` and `طرح اصلی` are not automatically treated as authenticity proof.

Original files remain unchanged in the supplied `allsport-2026-11-27/` directory.
The complete pending copy is `.local/domestic-crawls/reviews/allsport.csv`; private
hashes, candidates, public-page captures and no-op import reports are in
`.local/iran-coverage/`. No incoming crawler/export/loader script was executed.
The adapter now registers Allsport's exact host and ID-bearing PrestaShop paths.
It blocks conflicting observations, unknown/out-of-stock Allsport rows and
unresolved child collections, in addition to the product-originality review
requirement. Do not fill approval fields to bypass missing source evidence.
All **9299** pending rows across the nine packages remain outside purchase results.

Separately, the [Iranian coverage review](iran-coverage.md) added 54 discovery links.
Current combined storage is **13070** offers with **871** Iranian and **7375**
foreign `ShoeStoreLinks`, covering **348** models domestically. These are link
coverage counts, not a claim that all old listings remain in stock.

## Source and review inputs

The supplied `review.csv` files originally contain no canonical IDs and all rows
have `approved=no`. They are review forms, not immediately importable price feeds.
Each package's sibling `listings.jsonl` provides the actual prices/currency, stock
assertion, stable product ID, direct URL and original observation time. Incoming
scripts/README files are reference material; the app does not execute them.

Original packages remain unchanged outside Git. Completed review **copies** are
at ignored `.local/domestic-crawls/reviews/STORE.csv` on this workstation. Most
accepted rows have an exact brand/model/generation in the title; additional
bilingual rows were reviewed with corroborating identical style codes. Neither
fuzzy suggestions nor bare store SKUs automatically authorize a mapping. Ambiguous
color/size mappings remain null; stock options do not become inventory rows.

Each completed review retains all original source product IDs, titles and URLs,
fills the exact catalog `shoe_id`/`shoe_name`/`brand`, records `match_evidence` and
sets `approved=yes` only for reviewed rows. Pending rows keep `approved=no` and a
reason. Additional local candidate columns are audit aids, never approval rules.
Review copies and source snapshots must be supplied privately on another machine;
the importer does not ship the underlying datasets or invent replacements.

## Import and refresh

`backend/app/importers/domestic_crawls.py` uses existing `OfferInput`, exact
`map_product` and transactional `refresh_offers` services. Operator-managed hosts
are in `backend/app/content/store-retailers.json`; `STORES` in the importer provides
the nine fixed merchant identities/display names. Feed rows cannot add hosts.

```sh
# Default: validate through real DB services, then roll back.
.venv/bin/python -m app.importers.domestic_crawls \
  /path/to/npstyle-2026-11-26/review.csv \
  /path/to/padoon-2026-11-26/review.csv \
  --reviews-dir .local/domestic-crawls/reviews
# After inspecting the report and verifying a private DB backup, repeat with --apply.
```

Supply any subset of packages, once per retailer. Without `--reviews-dir`, reviews
are read from the given CSVs; original unapproved files produce no listings. With
it, the importer reads `STORE.csv` copies and the original sibling JSONL snapshots.
Do not run the older standalone loaders or generic CSV adapter for the same crawl:
this adapter uses listing identities `crawl:PRODUCT_ID` and source product mappings
`crawl:STORE:PRODUCT_ID`, independent of URL, price or row order. Reuse this adapter
for subsequent snapshots to preserve identity and analytics attribution.

Checks reject mismatched title/URL/catalog identities, missing evidence, duplicate
IDs/URLs, incomplete reviews, unapproved hosts, incompatible GTX/width/child
qualifiers, explicit copy markers, zero/test/range prices, malformed currency and
future timestamps. Allsport/Kafshesport/Pelaza additionally require explicit product-original
markers and matching product-level evidence/review fields. A reviewed seller claim
still is not an independent authenticity certification.

Prices retain explicit source IRT/IRR units: toman stays unchanged, rial is converted
on read through the existing Decimal monetary contract. No exchange refresh is
needed for domestic prices. Original observation times drive normal stock expiry;
reimporting does not refresh them. `live_verified=false`, inventory empty, variant
null. Partial refreshes do not retire unrelated listings or modify the catalog.

The default CLI report is ignored `.local/domestic-crawls-report.json`. Reports
include snapshot/review hashes, accepted/pending/rejection counts and hypothetical
or applied count changes. Dry-run `offers_after` describes the rolled-back result,
not persisted data. This workstation additionally retains review summary, dry-run,
apply, reimport and verification reports in `.local/domestic-crawls/`; original input
hashes were checked after import. A private pre-import PostgreSQL backup was created
and its archive catalog verified; its path remains under `.local/backups/`.

## Verification — 2026-11-26

- All **127 backend tests** passed, including the new adapter regressions and existing
  catalog, populated migration, source ownership, money, authentication and analytics.
- **30 frontend unit tests** passed; Ruff, mypy, ESLint and TypeScript passed.
- Both desktop/mobile store browser journeys passed: domestic first-page amounts,
  safe outbound redirect, legacy retailer preservation, foreign converted prices,
  source/time metadata, Latin digits and contained mobile layout.
- Reimport added zero listings and zero observations: history stayed **17755**.
  All original review/snapshot hashes remained unchanged. No migration or dependency
  change was required. A production frontend build was not rerun for this backend
  ingestion/test change. General browser tests used DNT=1, preserving real analytics.

Existing contracts: [store prices](store-links.md), [offer ownership and freshness](commerce-backend.md),
[admin analytics](admin-panel.md). Pending rows require additional evidence or future
canonical coverage, not automatic approval of the entire source file.
