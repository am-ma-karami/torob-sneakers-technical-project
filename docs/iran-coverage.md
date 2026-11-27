# Iranian purchase-link coverage

Verified locally on **2026-11-27 (Asia/Tehran)**. The user's constraint is actual
domestic inventory: Iranian intermediaries offering orders from abroad are excluded.
Research targets canonical models with no existing Iranian link, retaining exact
generations, waterproof/GTX, age and width editions. No new catalog models, technical
measurements, colorway associations or size inventory were created.

## Applied batch

| Merchant | Reviewed links |
| --- | ---: |
| PL Kicks (`plkicks.com`) | 21 |
| Mahabad Running (`mahabadrunning.ir`) | 24 |
| Colobis (`colobis.net`) | 5 |
| Fandug (`fandug.ir`) | 4 |
| Total | 54 |

These links gave **52** previously uncovered models their first Iranian listing.
Domestic model coverage increased **296 → 348 of 1167**; **819** models still have
no Iranian link. Offer storage increased **13016 → 13070**; `ShoeStoreLinks`
contains **871** domestic and **7375** foreign listings. Coverage includes historical
links and is not equivalent to currently verified available stock for all 348.

Examples of newly covered models include Saucony Endorphin Speed 5/Pro 4, Reebok
Nano X5, Nike Zegama 2 and Brooks Ghost 16. Canonical IDs come from the actual local
catalog. Broad search/fuzzy candidates never become approved mappings automatically.

## Evidence and price treatment

Public product pages were checked against their own primary title/model, positive
price and stock indicators, excluding related-product cards. WooCommerce public
Store API snapshots corroborate PL Kicks/Mahabad Running stock and backorder status.
Colobis requires the primary cart and no primary unavailable message; Fandug pages
explicitly report warehouse availability and one-business-day dispatch.

Domestic fulfillment evidence: [PL Kicks product shipping terms](https://plkicks.com/product/کتونی-نایکی-اورجینال-nike-air-max-dn/),
[Mahabad Running dispatch banner](https://mahabadrunning.ir/),
[Colobis shipping policy](https://colobis.net/pages/shipping_procedure),
[Fandug product dispatch information](https://fandug.ir/product/brooks-ghost-16-original-grey-black-442).
Seller originality assertions remain seller claims, not an independent certification.

All amounts retain explicit IRT/toman units and original observation timestamps.
Mahabad Running's visible discounted primary-page price differed from its Store API
price; the reviewed batch uses the visible current product price, excluding crossed
out prices. No guessed exchange rate, shipping charge or installment amount is used.
Normal 24-hour stock expiry still applies; importing/reimporting does not reverify
the store or promise present-day availability. There is no live refresh scheduler.

Rejected/pending examples include Ultra Flow pages whose H1 actually says Ultra
Flow 2, HOKA codes `1134501F`/`1155150` indicating GTX versions despite generic titles,
a Salomon X Ultra 360 code indicating LTR GTX, and an unresolved Brooks wide edition.
Manufacturer evidence for HOKA codes: [official product sheet](https://www.hoka.com/on/demandware.static/-/Library-Sites-HOKA-EMEA-SHARED/default/dw8a6f013f/images/2025/pdf/Hoka_FW_Product_Sheet.pdf),
[official Speedgoat 6 GTX listing](https://nz.hoka.com/products/m-speedgoat-6-gtx-1155150-bckt-bckt).
Ambiguous products stay pending rather than borrowing the base model's measurements.

## Private artifacts and repeatable import

The ignored `.local/iran-coverage/` directory contains the baseline catalog,
`approved-store-links.csv`, per-row `approved-audit.json` (source URLs, capture
timestamps/hashes, stock and match basis), exclusions, dry-run/apply reports and
live/UI verification results. Source/public-page captures stay private and are not
shipped in frontend assets. They must be transferred separately to another checkout.

The existing `app.importers.store_links` schema/services own these model-level
links. Retailer identities are the exact domain keys above, with operator-reviewed
hosts in `backend/app/content/store-retailers.json`. The private wrapper dry-ran the
actual importer inside a rolled-back session, then applied the identical CSV after
a fresh `pg_dump` backup whose archive catalog passed `pg_restore --list`.

All **13016** prior offers were fingerprinted and remained unchanged. A second
apply changed neither listings nor observations; history stayed **17809**. Source
catalog counts remain 1167/27048/3845 and no schema/dependency change was required.

## Fresh verification and remaining work

- **135 backend tests** passed; Ruff and mypy passed.
- All **54** new offers were checked through the running API for source price,
  stock and model-level variant behavior; admin groups were present and each of
  the four merchant hosts produced the correct safe outbound redirect.
- Existing desktop/mobile store browser journeys passed. Additional private
  desktop/mobile checks verified the new Mahabad Running row and primary-page
  price on Endorphin Speed 5, without page overflow. All used DNT=1.
- Allsport's original review/snapshot hashes remained unchanged. Its **6727** rows
  were registered as a private pending review, adding **zero** purchase offers;
  details and guards are in [domestic crawls](domestic-crawls.md).
- Frontend unit/lint/type/build checks were not rerun for this follow-up: production
  frontend code did not change. The previous 2026-11-26 results are historical.

This is a completed reviewed batch, not full market coverage. Large-store research
did not yield sufficient accessible exact-model/current-stock evidence for this
batch. Partial additional specialist discovery remains unapproved. Resume from
private cached candidates only after checking identity, source freshness and local
fulfillment; never import proxies, unverified candidates or Allsport rows en masse.
Publication was deferred during import; the user authorized committing and pushing
all completed work on 2026-11-27. No raw dataset, private capture or backup is published.
