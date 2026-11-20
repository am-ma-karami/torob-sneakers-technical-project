# راد / RAD — footwear, understood

**Current interface:** [Glass Studio tokens and motion](glass-studio/design-system.md). [Previous Nocturne system](redesign/design-system.md). The document below records the preserved bright baseline.

A Persian-first catalog for people choosing shoes by fit and construction. The single job of the catalog is to narrow choices and open a measured anatomy. The signature is a fine-line, exploded shoe instrument diagram, paired with real product photography.

## Tools and references

UI UX Pro Max installed using `npx --yes ui-ux-pro-max-cli@latest init --ai codex`. Its SKILL.md was read; design-system, accessibility/motion, and React state searches were run. The first product match was inappropriate (pharmacy); it was rejected. The narrower shoe/ecommerce query supplied useful hierarchy, whitespace, 200–300ms feedback and responsive guidance. Retail urgency colors and Latin-only typography were replaced to suit this measured, Persian experience. These are deliberate contextual adaptations, not wholesale adoption of unrelated output.

References inspected: [Moshkin](https://moshkin.studio/) for discovery and comparison; [ShoeGeometry](https://shoegeometry.com/) for provenance and geometry explanation; [SoleHunt](https://solehunt.app/) for transparent preference matching; [Torob](https://torob.com/) for separate retailer offers. The visual design is original.

## Tokens

| Role | Value |
|---|---|
| Paper | #f7f9fc |
| Surface | #ffffff |
| Ink | #172638 |
| Muted text | #59677a |
| Blueprint accent | #2458d3 |
| Accent surface | #eaf0ff |
| Technical line | #cbd5e3 |
| Positive | #186449 |

Vazirmatn Variable for Persian body and display; Manrope Variable for English model names; JetBrains Mono Variable for technical numerals. Fonts bundled locally via Fontsource, with font-display swap. Body 16px, secondary 14px, metadata 12–13px; display fluid 36–64px. No letter spacing on Persian. Latin names, prices, measurements and model codes are isolated LTR.

4px base spacing, with 8/12/16/24/32/48/64px steps. Maximum content 1440px. Quiet 12–24px corner radii, hairline borders, shallow shadows. A gridded technical canvas is confined to anatomy. Responsive breakpoint families 640/900/1200px. Mobile filters use a native dialog with focus restoration; long comparison tables scroll inside a labeled region.

## Layout

Catalog: compact navigation → two-column interactive shoe introduction → category tabs → search and result toolbar → right filter rail plus three-column product grid. Detail: breadcrumb → real image and verified colorways + name and key facts → full-width anatomy → progressively disclosed measurements, fit, materials and dated retailer offers. Comparison: selected models → side-by-side profiles → grouped metric rows.

## Motion and accessibility

Motion React is the only animation library. Immediate input feedback, 160ms buttons/chips, 240ms panels/tray, 450ms construction transforms with decelerating easing. No forced intro or looping motion. Exploded layers maintain alignment guides. Interruptions update React state immediately. Reduced motion removes spatial animation and retains final states. SVG layers expose button roles, labels, Enter/Space selection; equivalent HTML controls are always available. Visible focus, 44px controls, source links, honest unknown values and textual explanations accompany graphics.

## Accuracy

The upper and layer outlines are schematic. Only verified values change measured geometry. Missing rocker data yields a straight dimension section, not a guessed curve. Millimetre photo estimates use a 300mm reference and are labeled separately from lab measurements; internal, platform and external widths are separate views. Plate absence and unknown plate information have distinct states. Metrics with different units/methods never share an average. Offers are dated snapshots in their original currency.
