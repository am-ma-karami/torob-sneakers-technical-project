# Nocturne redesign — delivered 20 November 2026

The app runs at **http://127.0.0.1:5173**. Work is on `feat/dark-shoe-experience`. The recoverable bright baseline is commit `f8e7231f7434179212ea57739761bccfc4837a3b`, preserved on `baseline/bright-ui-2026-11-20`. No database migration, destructive reset, force push, merge or deployment was performed.

## Product changes

Home is now a shoe editorial: a real-product hero, four curated models, two short anatomy/finder previews and a restrained footer. Search, facets and pagination live at `/shoes`; deeper research is on `/shoes/:slug`; comparison, finder, brands, categories and credits retain their own pages. Legacy `/shoe/:slug` links redirect with their query/hash, and old root catalog-query links redirect to `/shoes`. Browser back restores catalog search, filters and sort.

The softer slate palette, warm accent, cool technical accent, Vazirmatn Persian typography and selective Latin Bodoni treatment extend through cards, filters, tables, charts, dialogs and all destinations. Unmodified JPEG product photos use a pale photographic stage rather than fabricated cutouts. [Tokens and motion decisions](design-system.md).

The four featured catalog IDs are **40586 adidas Adizero EVO SL**, **40390 Nike Pegasus 41**, **41349 ASICS Novablast 6**, and **40830 Saucony Endorphin Speed 5**. Their actual image loads, measurements, links and distinct foam descriptions were verified. A desktop GSAP ScrollTrigger pins one wrapper over 1,200 px; a clamped four-interval index updates React only when the product changes. Motion owns the inner presence transition. Product indicators and previous/next controls jump directly into each interval; a visible catalog link skips browsing onward. No wheel/touch interception, Lenis or extra animation loop. Mobile, reduced-motion, save-data and low-core devices show all four cards in normal flow. Scope cleanup removes the pin on navigation and resize; image/font loads refresh measurements.

Gallery color selection now changes the main photo and thumbnail group together. Only explicitly mapped variant images appear in color views. Unmapped images remain in a general gallery. Thumbnails paginate seven at a time, rather than rendering a 97-image archive on entry. The native fullscreen dialog supports keyboard arrows, Escape, focus containment/restoration, scroll locking, touch swipe, and broken-image fallbacks. No initial full-resolution download of every colorway.

Stale retailer offer tables and purchase links, public source panels/badges and footer source lists are removed. Original offers, currencies, image relations, licenses, source URLs and measurement provenance remain intact internally. Required attribution is on `/about`. There are no live inventory claims.

## Measurements and charts

- Side profile: real heel/forefoot stacks and drop; available photo-estimated toe-rocker length, toe-tip lift, heel-bevel length and lift. A common 300 mm longitudinal reference and 2 SVG units/mm govern the side drawing. Lab stack values retain their test size; photo curves are explicitly labelled as estimates.
- Assembled view: a coherent upper/sole cross-section, actual insole/outsole thickness bands when measured, and a plate only when its presence is verified. Stack height is labelled as the **whole sole**, never inferred as pure foam thickness.
- Exploded view: distinct mesh upper, insole footprint, midsole volume, optional plate and outsole tread. Measured insole/outsole thickness changes their drawn thickness. Available external platform breadth controls the projected footprint, separately from internal fit. Every selectable layer has a real material, property or measurement.
- Internal fit: internal length, forefoot width, big-toe width and toe height control the drawing and dimensions when present. Unmeasured outline segments are a guide; they are not a reconstructed factory last. Internal fit never substitutes external platform breadth.
- Unavailable fields are omitted. Entire modes disappear if they lack sufficient data. No generic unknown cards or CAD disclaimer paragraph remain. Every original null stays null in the records.
- One compact per-use score panel uses the shoe's actual usage keys, including non-running categories. Histograms are empirical counts from models sharing the **primary category, score key and score source**. Percentiles require at least five valid 0–100 values and use midrank for ties. No fitted bell curve or cross-source average. The running showcase's comparison population is 491 models per usage key.
- Secondary energy return, firmness and bending-force gauges plus detailed measurements are expandable. Independent supplementary evaluations remain separate. Harder/stiffer/higher is not styled as automatically better.

Reference pricing is hidden by default. To intentionally enable a converted manufacturer-list reference, configure **both** `REFERENCE_USD_TOMAN` (toman per USD, not rial) and timezone-aware `REFERENCE_RATE_AT` in the private root `.env`, then restart the API. Missing, future or timezone-free timestamps hide prices. Original amount/currency, rate and timestamp remain in the response; visible prices say “قیمت مرجع تبدیل‌شده”, never current Iranian retail price. No market exchange rate was guessed or configured for this delivery.

All 9,248 unique existing review phrases have stored Persian output; originals are unchanged. Translation is a one-time content process with footwear terminology and 120 editorial overrides, including all four featured models and frequent phrases. No page-load translation or paid translation service. The initial local Argos model was tested and rejected for poor terminology; its output was not shipped. Remaining long-tail prose is machine-assisted and has not received a complete human linguistic review; further editorial corrections belong in `backend/app/content/review-overrides-fa.json` and are applied by `scripts/translate_reviews.py`.

## Verification

Current results:

| Check | Result |
|---|---|
| PostgreSQL-backed backend tests | 46 passed |
| Frontend unit/component tests | 20 passed |
| Playwright desktop/tablet/mobile | 33 passed (1.1 minutes); affected comparison recheck 3 passed |
| Ruff / Mypy | Passed; 21 backend source files |
| ESLint / TypeScript | Passed |
| Production build | Passed; GSAP/ScrollTrigger and product routes split into chunks |
| Live API readiness | 200; ready |
| Original database counts | 1167 shoes / 27048 measurements / 3845 variants / 4739 dated offers |
| Persian stored phrase coverage | 9248 / 9248; originals retained |
| Actual visual inspection | Desktop profile/product and mobile home; screenshot QA for destinations/modes |

Tests cover old routes, browser back, search/facets, URL restoration, main-photo/thumbnail mapping, empty/mapped galleries, keyboard/modal focus and swipe, Persian reviews, removed stale commerce, valid toman conversion and rejected conversion bases, null preservation, mode availability, measurement-driven paths, meaningful layer selection, empirical bins/ties/percentiles, optional flags, clamped showcase transitions, route cleanup, reduced motion, mobile flow, broken images, API errors and horizontal overflow.

A repeated browser matrix hit the normal API's 240 requests/minute limit and correctly received HTTP 429. The final matrix uses a **separate loopback test API** on 8001 with `RATE_LIMIT=10000` and a test Vite proxy on 5174. The original application's rate limit on 8000 was not changed. Temporary test servers are stopped after verification. Docker was not run; this redesign introduces no Docker or schema changes.

```sh
.venv/bin/pytest -q
.venv/bin/ruff check backend scripts
.venv/bin/mypy
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
# Normal one-off browser run:
npm --prefix frontend run test:e2e
# For repeated full matrices, use separate terminals and stop both afterward:
RATE_LIMIT=10000 .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001
API_PROXY_TARGET=http://127.0.0.1:8001 npm --prefix frontend run dev -- --port 5174
E2E_BASE_URL=http://127.0.0.1:5174 npm --prefix frontend run test:e2e
```

## Before and after

Screenshots are from the running application, with real catalog images. The preserved bright baseline is in `before`; current home, catalog, product, assembled, side profile, fit, exploded and comparison captures are in `after`, at desktop 1440×1000, tablet 820×1180 and mobile 390×844. Screenshot runs use reduced motion for stable captures; the normal-motion showcase is verified in browser journeys.

| View | Before | After |
|---|---|---|
| Desktop home | [Before](before/home-desktop.png) | [After](after/home-desktop.png) |
| Mobile home | [Before](before/home-mobile.png) | [After](after/home-mobile.png) |
| Desktop catalog | [Before](before/catalog-desktop.png) | [After](after/catalog-desktop.png) |
| Mobile catalog | [Before](before/catalog-mobile.png) | [After](after/catalog-mobile.png) |
| Desktop construction | [Before](before/anatomy-desktop.png) | [After](after/anatomy-desktop.png) |
| Mobile construction | [Before](before/anatomy-mobile.png) | [After](after/anatomy-mobile.png) |
| Desktop exploded | [Before](before/exploded-desktop.png) | [After](after/exploded-desktop.png) |
| Mobile comparison | [Before](before/comparison-mobile.png) | [After](after/comparison-mobile.png) |

Additional current captures: [side profile](after/profile-desktop.png), [internal fit](after/fit-desktop.png), [mobile product](after/product-mobile.png).

## Restore or simplify

Exact steps are in [rollback.md](rollback.md). To restore the bright UI, preserve current work, stop Vite, switch to `baseline/bright-ui-2026-11-20`, run `npm --prefix frontend ci`, then `npm --prefix frontend run dev`. Return using `git switch feat/dark-shoe-experience` and reinstall the corresponding lockfile. Database rollback is unnecessary.

After stopping the current frontend dev server, disable **only depth** with:

```sh
VITE_ENABLE_DEPTH=false npm --prefix frontend run dev
```

Or disable **only enhanced scrolling** with:

```sh
VITE_ENABLE_SCROLL_SHOWCASE=false npm --prefix frontend run dev
```

The same variable prefix works with `npm --prefix frontend run build`. For a persistent setting, edit the respective `VITE_` variable in the private root `.env`; Vite reads this directory explicitly. Restart/rebuild is required. The other flag remains independent and all products remain accessible. No WebGL engine or 3D model assets need removal.

## Remaining data limits

Photo geometry is approximate and may disagree across photos; the app retains uncertainty metadata and separate measurement methods. Exact upper/plate shapes and unmeasured layer thicknesses remain schematic. Some shoes have only a subset of useful anatomy modes. Product images remain on their original host, so external image failures use a fallback. Reference conversion is optional and is not an Iranian market price feed. Long-tail review translations need continued editorial curation.
