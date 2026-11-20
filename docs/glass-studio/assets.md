# Glass Studio assets and identity — 21 November 2026

## Brand marks

The exact brand-to-file mapping and provenance are in `frontend/src/lib/brandLogos.json`. Fourteen verified marks are bundled locally: **adidas, Nike, ASICS, Saucony, New Balance, PUMA, Reebok, Under Armour, Jordan, Salomon, Altra, Merrell, ANTA and The North Face**. Other catalog brands retain a plain wordmark fallback; no generic shoe glyph is presented as a brand logo. A failed logo load also falls back to the brand name.

Sources: [Simple Icons](https://github.com/simple-icons/simple-icons), pinned source package **16.38.0**; Wikimedia Commons for ASICS, Saucony, Altra and Merrell; and [Salomon's official site](https://www.salomon.com/en-us) for its header SVG. Source URLs, license metadata and original-file URLs are retained per mark. The Simple Icons license ships in `frontend/public/media/brands/SIMPLE-ICONS-LICENSE.md`. Marks retain their original paths, colors and proportions. Only SVG line endings and unnecessary external DTD declarations were normalized; no arbitrary CSS recoloring or inversion is applied. Original black/navy marks sit on a quiet pale carrier so they stay readable against dark glass.

21st's **free `search_logo` tool** was discovered and called for 15 major shoe brands; its svgl.app catalog returned no matches. This was a successful empty search, not an unavailable-tool claim. Wikimedia candidate searches were reviewed manually; unrelated results (for example an Altra result for On, or adidas results for Salomon) were rejected. Some candidate downloads were inaccessible; On's official favicon was only a 48px opaque raster, so it was not substituted as a high-quality logo. Reliable text is preferable to a wrongly mapped, distorted or poor-quality mark.

## Opening photography

Four catalog models and the exact first verified colorway records remain selected. `frontend/src/lib/featuredMedia.json` binds each processed image to its shoe ID, slug, variant key, original colorway label and original image URL:

| ID | Product | Served assets |
|---|---|---|
| 40586 | adidas Adizero EVO SL | `/media/featured/adidas-adizero-evo-sl.webp`, `-640.webp` |
| 40390 | Nike Pegasus 41 | `/media/featured/nike-pegasus-41.webp`, `-640.webp` |
| 41349 | ASICS Novablast 6 | `/media/featured/asics-novablast-6.webp`, `-640.webp` |
| 40830 | Saucony Endorphin Speed 5 | `/media/featured/saucony-endorphin-speed-5.webp`, `-640.webp` |

Files are in `frontend/public/media/featured/`. The product action includes the matching `colorway` URL parameter. Generic unmapped gallery images are not reassigned to a chosen color. Original backend image relationships remain untouched.

The original catalog photographs were inspected before editing. Background extraction used the **built-in image_gen tool**, once per product; no CLI/API fallback or user API key was used. This is processed photography, not a 3D reconstruction. The large PNG masters remain outside the deployed frontend; two responsive WebP sizes preserve alpha. Local Sharp 0.35.5 performed only resize/compression, and is not an application dependency. Large files are 148–204 KB each; mobile versions are 41–62 KB. The former opaque photographic disc, white rectangle, frame and halo were removed from the opening DOM/CSS. A subtle separate contact shadow supplies depth.

Prompt set, with each exact model's original catalog photo as the edit target:

- EVO SL and Pegasus 41: “Background-extraction only: remove the plain white background to actual transparent alpha. Preserve the original shoe exactly: same side view, facing direction, proportions, silhouette, colorway, materials, stitching, branding, outsole texture, laces, shadows inside the shoe. Do not redesign, recolor, relight or invent detail. White shoe components and white logos must remain opaque; only the exterior white backdrop and any white fringe should disappear. Clean anti-aliased edges against a dark charcoal website. One complete shoe only, uncropped, tightly framed with a little transparent margin; no text, frame, halo, floor or added shadow. Product fidelity is more important than stylization.”
- Novablast 6 and Endorphin Speed 5: “Remove only the plain exterior white backdrop and replace it with actual transparent alpha. Preserve the photographed shoe's pixel appearance and exact side-view silhouette, proportions, facing direction, original colorway, logos, text, mesh, laces, outsole, materials and details. Do not rotate, redesign, recolor, relight, stylize or change perspective. Preserve white/light shoe materials as opaque. No added floor, frame, halo, extra objects or shadow. Clean anti-aliased edges without white fringes on dark charcoal; complete uncropped single shoe with a small transparent margin. Keep the original shoe width-to-height ratio and all product identity details.”

Actual results were inspected on the dark background and tested for transparent corner pixels. The gallery keeps the original catalog photography for close inspection; processed hero images do not replace the source records or claim pixel-perfect scientific imagery.

## Genuine 3D asset limitation

The project contained **no GLB/glTF models**. Searches for matching EVO SL, Pegasus 41, Novablast 6 and Endorphin Speed 5 assets did not yield a verified usable mesh with matching product/colorway identity and an established redistribution basis. Nearby results included a [different Air Force 1 model](https://sketchfab.com/3d-models/nike-air-force-1-b580fb8a337e4609807185f1fab2f305) and a [demonstration repository that explicitly uses placeholder model paths](https://github.com/Ekdeepgill22/3d-animation-gsap). Neither was relabelled as one of our selected shoes.

**This delivery does not contain a genuine 3D product renderer.** The opening is the polished photographic fallback: transparent catalog assets with bounded 2D translation, slight in-plane rotation and crossfades. `model_url` is explicitly null in the manifest. No unrelated generic shoe, invented geometry, WebGL canvas or fake GLB URL is shipped, and no flat-image tilt is described as true 3D. A real 3D implementation still requires matching licensed meshes and a renderer. The current opening works when WebGL is unavailable and does not run an idle GPU render loop.
