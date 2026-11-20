# RAD 3D introduction — 21 November 2026

Open the local app at <http://127.0.0.1:5173>. The introduction uses one Three.js WebGL2 canvas. Scroll through four shoes, see their upper, heel, toe, sides and tread, then keep scrolling to the homepage. Previous/next and numbered chapter controls jump to a product. «رفتن به صفحهٔ اصلی» skips the scene and focuses the main homepage. Product links still open the matching catalog colorway.

## Models and references

**All four models are original approximate reconstructions.** The renderer draws subdivided volumetric meshes for the patterned upper, sculpted midsole, layered rubber and tread, lining, collar and tubular laces. The outsole and upper have real depth and respond to studio lighting from multiple directions. The models are artistic proportions, and the surface embellishments, interior and unseen tread features are simplified. Product statistics are fetched independently from the existing catalog. Fit and technical views still use their own measured data.

| Product | Catalog identity | Main visual references |
| --- | --- | --- |
| adidas Adizero EVO SL | 40586 · 1986833 · black with white stripes | [adidas JP7149 photos](https://www.adidas.com/us/adizero-evo-sl-shoes/JP7149.html), [RTINGS original scan viewer](https://www.rtings.com/running-shoes/tools/3d-model-shape-compare/3d/adidas-adizero-evo-sl) |
| Nike Pegasus 41 | 40390 · 1980982 · black/white FD2723-002 | [Nike multi-view photos](https://www.nike.qa/en/pegasus-41-womens-road-running-shoes/NKFD2723-002.html), [RTINGS external shape](https://www.rtings.com/running-shoes/reviews/nike/pegasus-41) |
| ASICS Novablast 6 | 41349 · 2003386 · cream/beige with pale green rubber as shown in the catalog photo | [RTINGS original shape and construction views](https://www.rtings.com/running-shoes/reviews/asics/novablast-6), [ASICS product and color page](https://www.asics.com/vn/vi-vn/novablast-6/p/1011C243-700.html) |
| Saucony Endorphin Speed 5 | 40830 · 1994463 · Citron/Lapis in the catalog photo | [RTINGS original scan viewer](https://www.rtings.com/running-shoes/tools/3d-model-shape-compare/3d/saucony-endorphin-speed-5), [RTINGS construction views](https://www.rtings.com/running-shoes/reviews/saucony/endorphin-speed-5) |

The existing [featured media manifest](../../frontend/src/lib/featuredMedia.json) lists the four source photographs and variant keys. Some external reference views show other colorways, so catalog photos anchor the colors. Brand names and markings identify the pictured products. Reference photographs and scans were used for shape review. The scene uses original geometry and generated material maps. No external scan file, copied vendor texture, or commercial mesh was acquired or bundled. A commercial [EVO SL model listing](https://www.cgtrader.com/3d-models/character/clothing/adidas-adizero-evo-sl-lowpoly-shoe-2025) and scan viewers were located, but no set of matching files with documented reuse rights was obtained. The existing photo posters are credited in the [Glass Studio asset notes](../glass-studio/assets.md). [Three.js is MIT licensed](https://github.com/mrdoob/three.js/blob/dev/LICENSE).

## Interaction and rendering

Each chapter makes one complete turn with a tilt that exposes the upper and outsole. The last part of each chapter overlaps the outgoing and incoming products. Both poses and the visible name derive from the same native scroll position, so backward movement retraces the same animation. CSS sticky keeps the stage below the navigation while the fixed-length sequence runs. It releases into the catalog invitation and existing homepage panels after the fourth shoe.

The scene code loads separately on the home route. It creates the first mesh on demand and prepares the remaining three shortly afterward. Rendering runs in response to scroll and resize while visible. A pixel ratio cap limits the mobile drawing buffer. Unmount releases scene resources. Browsers without WebGL2, devices with a low core count, Save Data, reduced motion, and a lost WebGL context get the four existing transparent photographs in normal flow. Those photos also serve as the loading poster. The anatomy viewer retains its existing Motion controller.

UI UX Pro Max's reduced motion and native navigation guidance informed the static and touch layouts. Frontend Design informed the single product composition and charcoal palette. Authenticated 21st discovery found 51 tools. Its free search returned **3D Coverflow Carousel** and **Scroll Rotating Product Slider** as motion references. The implementation uses original code.

## Captures

| Display | Before | After |
| --- | --- | --- |
| Desktop | [2D opening](before/desktop.png) | [3D opening](after/desktop.png) |
| Mobile | [2D opening](before/mobile.png) | [3D opening](after/mobile.png) |

[Browser recording](scroll-demo.webm) shows the four products followed by the homepage. [Upper](after/upper.png), [outsole](after/outsole.png), [Pegasus](after/pegasus.png), [Novablast](after/novablast.png), [Speed](after/speed.png) and [homepage reveal](after/homepage.png) are separate captures.

## Verification

- 48 Playwright checks passed across Chromium desktop, tablet and mobile emulation. The introduction checks verify real indexed triangle draws, four catalog IDs and headings, repeatable canvas frames when scrolling backward, release into the main homepage, resizing, skip focus, route cleanup, photo fallback and WebGL context loss. The rest of the matrix covers search, filters, galleries, comparison, and anatomy replay.
- 24 frontend unit/component tests and 46 backend tests passed. ESLint, TypeScript and the production build passed. The home-only WebGL scene chunk is 139.12 kB gzip. Vite flags its uncompressed bundle size at 549.48 kB.
- Desktop and mobile captures were reviewed in Chromium. Mobile was tested with viewport and touch emulation on this host.

## Recovery

Set `VITE_ENABLE_3D_INTRO=false` for a regular-flow photo introduction. To try it locally, stop Vite and start it with:

```sh
VITE_ENABLE_3D_INTRO=false npm --prefix frontend run dev
```

The anatomy depth switch remains `VITE_ENABLE_DEPTH`. The existing `VITE_ENABLE_SCROLL_SHOWCASE=false` also opts out of the pinned intro. Vite reads the root environment on startup or build.

To restore the previous release, preserve any local edits, stop Vite and switch to the saved branch at `c28c511`:

```sh
git switch baseline/glass-studio-2026-11-21
npm --prefix frontend ci
npm --prefix frontend run dev
```

Return by switching to `feat/volumetric-shoe-intro` and reinstalling its lockfile. No database migration is needed.
