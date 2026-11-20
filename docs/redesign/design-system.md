# RAD / Nocturne — design and motion decisions

The application is a Persian-first footwear research product. Its home is editorial; its catalog is a focused research tool. The signature is a large, calm shoe photograph over a softly lit specimen stage, followed by four real catalog models in a bounded scroll showcase. Technical pages retain the same charcoal, warm metal, and blue-gray vocabulary.

## Tokens

Canvas #171B22; alternate #1C212A; raised #252C36; interactive #2C3542; strong text #F2F0EB; secondary #B7C0CC; muted #A4AFBE (raised from the suggested #8F9BAB for small-text contrast); borders #455160; warm accent #C7A67A; cool accent #8EAED1. The theme uses layered surfaces and restrained ambient lighting, rather than a color inversion. Product photography retains its real colors and a clearly framed pale photographic stage where the provided JPEG is not a transparent cutout.

Vazirmatn Variable remains the Persian heading/body face. Bodoni Moda is confined to large Latin editorial model treatments; Manrope and JetBrains Mono retain technical names/numerals. Persian is never letter-spaced. Mobile text is kept readable and long names wrap. Semantic tokens drive technical SVGs as well as cards and dialogs.

## Tool workflow

The installed UI UX Pro Max skill and frontend-design guidance were read. Design-system and focused motion/accessibility searches were executed. Luxury/footwear recommendations supplied hierarchy, quiet typography and spacing; the generated light palette and liquid-glass blur were rejected because they did not fit this brief. 21st authenticated initialize/tools-list/free search succeeded (51 tools). Free metadata for the segmented-tab search and Carousel #34484 / Image Fan Carousel #26184 informed control patterns. Its service explicitly marks `get_component` code retrieval as paid/quota-consuming, so no code retrieval, generation, install command or paid usage was invoked. The gallery and controls are original project code. The desktop process does not inherit the credential; the ignored local environment supplies the read-only helper without logging it.

## Layout and movement

Home: viewport-scale shoe hero → four-product showcase → two concise anatomy/finder previews → credits/about link. Catalog lives at /shoes, details at /shoes/:slug, with preserved legacy detail redirects. Category, brand, comparison and finder are independent destinations.

Motion owns presence and component feedback. GSAP ScrollTrigger owns only the editorial pin wrapper and scroll-to-index mapping, with no wheel interception or second frame loop. Different wrappers keep transform ownership separate. Match-media scopes, image/font refresh and explicit cleanup handle Strict Mode, route changes and resize. On mobile, reduced motion, save-data devices or disabled flags, all featured products are normal-flow cards.

Optional depth uses lightweight CSS perspective/transform only, independently disabled by VITE_ENABLE_DEPTH=false. Editorial scrolling is independently disabled by VITE_ENABLE_SCROLL_SHOWCASE=false. No WebGL, custom cursor, Lenis or continuous particle loop is introduced.

## Data presentation

No live commerce claims or stale retailer tables. Unavailable rows/modes are omitted without changing their underlying records. Source branding moves to discreet about/credits; internal provenance is retained. Visible measurements distinguish lab values, stated values and photo estimates via concise origin labels. Photo geometry retains its 300mm reference in a compact legend. Empirical score charts use explicitly defined same-category/same-score populations; no fitted bell curve or mixed source averages.

## Implementation references

The scroll implementation follows [GSAP matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia/) and [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/): scoped cleanup, responsive creation and refresh after image/font measurement. React owns the active index, changing only at product boundaries. Previous/next controls jump to a product's interval; Motion crossfades the content. A 1,200 px bounded scroll introduces all four products without intercepting input.

Photo thumbnails are paginated seven at a time; changing color resets the main image and its thumbnail group. Original colorway/SKU labels stay in data and accessible titles; common color names are translated for display. Native dialog provides focus containment, Escape, background scroll lock and focus restoration. General photos remain separate from mapped colorway photos.
