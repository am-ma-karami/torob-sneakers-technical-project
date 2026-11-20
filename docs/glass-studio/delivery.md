# Glass Studio refinement — 21 November 2026

The application is available at **http://127.0.0.1:5173**. Work is on `feat/glass-studio-and-anatomy-motion`. The previous Nocturne interface is preserved at `1cece00` on `baseline/nocturne-ui-2026-11-20`.

## Delivered changes

A shared dark-glass system now covers navigation, search, catalog cards, filters, directories, product details, comparison, finder, dialogs, controls and the footer. It uses translucent charcoal/slate surfaces, fine edge highlights, restrained atmospheric gradients, soft shadows and consistent radii. Blur is selective rather than nested on every card; an opaque-first feature-query fallback keeps unsupported browsers legible. Persian typography, focus rings, selected states and native touch scrolling remain intact. [Design tokens and motion ownership](design-system.md).

The duplicated hero and showcase became one product-led opening. Four transparent catalog-photo cutouts float in a quiet studio, with a concise Persian heading, model identity, three available facts, catalog/product actions, position controls and a bounded 1,200 px desktop sequence. Source model/colorway identity is explicit in the asset manifest and product links. White rectangles, photographic discs and image-container halos have been removed. Mobile and reduced-motion paths show all products in normal flow, with the first catalog action reachable without a long pinned introduction.

The four products remain **adidas Adizero EVO SL (40586), Nike Pegasus 41 (40390), ASICS Novablast 6 (41349) and Saucony Endorphin Speed 5 (40830)**. Their local responsive WebP images retain alpha and are bound to exact verified variant keys. The original galleries and backend image records are unchanged.

**Genuine 3D is not implemented in this delivery.** No usable verified matching GLB/glTF assets were obtained. The current opening is the photographic fallback, with in-plane movement/rotation and coherent crossfades; it is not described as full 3D. No unrelated generic model, invented mesh or placeholder GLB URL is presented as a named shoe. No Three.js dependency or idle GPU loop was added. [Asset research, file locations, prompts and limitation](assets.md).

Fourteen recognizable brand marks replace generic shoe icons where a reliable asset was obtained: **adidas, Nike, ASICS, Saucony, New Balance, PUMA, Reebok, Under Armour, Jordan, Salomon, Altra, Merrell, ANTA and The North Face**. Other brands use a tasteful text fallback. The original mark proportions/colors are preserved, with a readable neutral carrier for dark marks. Accessible alt text and broken-image fallback are included. Source/license metadata is retained and credits are discreetly placed on About.

## Layer animation repair

Git history established the regression: the bright baseline used animated `motion.g` groups; the Nocturne rewrite replaced them with fixed SVG groups and separate render branches. There was no evidence that global ScrollTrigger cleanup caused the static layers.

Construction modes now share stable Motion SVG nodes. A coherent assembly separates through restrained translation, small per-layer rotation and stagger; users can assemble again or replay separation. Actual available layer thicknesses, materials, foam properties and verified plate presence remain bound to source data. Separation spacing is purely presentation and is never labelled as a physical dimension. Missing layers/attributes remain omitted. Material-only construction can assemble without inventing missing stack values, while the measured side-profile mode stays hidden when stacks are missing.

The viewer's controller is local to the component. CSS transform transitions are disabled on Motion-owned nodes; reduced motion uses immediate states without residual CSS micro-transitions. Upper/lower layer spacing and the SVG viewport were adjusted to prevent clipping. Compact comparison drawings keep their small layout. Layer selection works through both diagram and keyboard-accessible controls. Side profile and internal fit retain their separate measured views.

## Verification

| Check | Actual result |
|---|---|
| Backend PostgreSQL tests | **46 passed** |
| Frontend unit/component tests | **24 passed** |
| Complete desktop/tablet/mobile browser matrix | **45 passed** in 1.4 minutes |
| Final affected layer-navigation recheck | **3 passed**, desktop/tablet/mobile |
| ESLint / TypeScript | Passed |
| Production build | Passed; GSAP/ScrollTrigger remain lazy chunks |
| Ruff / Mypy | Passed; 21 backend source files |
| Main API readiness | Ready; HTTP 200 |
| Catalog integrity | **1167 shoes, 27048 measurements, 3845 variants, 4739 dated offers**, unchanged |
| Responsive image assets | Eight alpha WebP files; 148–204 KB large, 41–62 KB mobile |

Browser checks cover exact logo mapping and proportions, transparent image corners, no photographic frames, correct featured identities, WebGL-disabled photo fallback, indexed scroll transitions and cleanup, reduced motion, mobile flow, animated separation/reassembly/replay, keyboard layer selection, route/component independence, URL restoration, search/facets, existing color gallery/modal controls, and comparison. Screenshots were inspected for product edges, readable glass surfaces, mobile action placement and unclipped anatomy layers.

An initial reduced-motion test exposed global 0.01ms CSS transitions on SVG groups; these were removed rather than weakening the motion behavior. Screenshot capture now waits for actual visible-image decoding; lazy offscreen brand images are not awaited indefinitely. The normal API rate limit remains unchanged. Repeated full matrices used a separate local test API on 8001 with `RATE_LIMIT=10000` and a test Vite proxy on 5174; temporary servers are stopped after verification. The primary app remains on 5173/8000. No database migration, data deletion, deployment, push or merge was performed.

Reproduce checks from the repository root:

```sh
.venv/bin/pytest -q
.venv/bin/ruff check backend scripts
.venv/bin/mypy
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

For repeated full browser matrices, use the isolated test-server procedure from the earlier [verification instructions](../redesign/delivery.md#verification), then stop those temporary servers.

## Before and after

Before images were captured before changing the UI. After images come from the real application at desktop 1440×1000, tablet 820×1180 and mobile 390×844. The desktop home capture shows the normal pinned experience; mobile and anatomy captures use reduced motion for settled, reproducible poses.

| View | Before | After |
|---|---|---|
| Desktop home | [Before](before/home-desktop.png) | [After](after/home-desktop.png) |
| Mobile home | [Before](before/home-mobile.png) | [After](after/home-mobile.png) |
| Desktop exploded anatomy | [Before](before/anatomy-desktop.png) | [After](after/exploded-desktop.png) |
| Mobile exploded anatomy | [Before](before/anatomy-mobile.png) | [After](after/exploded-mobile.png) |

Additional after captures: [ASICS showcase](after/showcase-asics-desktop.png), [brand directory](after/brands-desktop.png), [mobile brand directory](after/brands-mobile.png), [assembled construction](after/anatomy-desktop.png), [side profile](after/profile-desktop.png), [internal fit](after/fit-desktop.png), [catalog](after/catalog-desktop.png), [mobile comparison](after/comparison-mobile.png).

## Recovery and remaining limits

[Exact restore and enhancement-switch commands](rollback.md) preserve the current database. Stop Vite, switch to `baseline/nocturne-ui-2026-11-20`, install its frontend lockfile and restart. Return using `feat/glass-studio-and-anatomy-motion`. The earlier bright baseline remains available too.

`VITE_ENABLE_DEPTH=false` disables the optional photographic depth/rotation treatment while keeping glass styling and layer animation. `VITE_ENABLE_SCROLL_SHOWCASE=false` independently disables the pin. Neither switch claims to control a genuine 3D renderer: none is active without verified meshes.

Remaining limits are explicit: genuine 3D model assets/rendering are still absent; some brands have text rather than an unverified logo; structural anatomy shapes remain schematic where dimensions are unmeasured. Existing long-tail review translations remain machine-assisted and need continued editorial curation. Original product photos, measurements, nulls, source provenance and stale commerce records are preserved internally. No current-stock or live-price claims were reintroduced.
