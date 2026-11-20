# RAD Glass Studio — surfaces and motion

The subject is a shoe research platform, and the opening's job is to invite discovery through the shoes themselves. The signature is one floating product against a softly lit slate studio; glass frames the interaction rather than enclosing every number in another panel. This replaces the duplicated hero/showcase image and pale photographic discs.

## Shared surface system

`frontend/src/glass.css` extends the existing semantic tokens and shared components. Canvas #171D27, slate #222C3B, raised glass #263448, text #F3F2EE, secondary #BEC9D8, cool light #A6C8E9 and champagne #C7AC88. Reusable surface classes are `glass-surface`, `glass-surface--quiet` and `glass-surface--blur`; existing navigation/cards/panels/dialogs receive the corresponding shared variants. Primary radii are 18px for surfaces, 12px for inner groups and 7–10px for small controls. Fine translucent edges and inset highlights express the material; shadows stay soft.

Opaque surfaces are declared first. Feature queries introduce translucent backgrounds and backdrop blur only where supported. Blur is selective: navigation, filters, dialogs and the comparison tray; cards and nested measurements do not each get a blur layer. Mobile blur drops from 14px to 8–9px, and background attachment returns to native scroll. Technical SVG canvases stay stable and dark for contrast. Inputs and selected states have stronger boundaries than decorative glass edges. Focus rings remain visible.

Vazirmatn remains the Persian font. Bodoni is limited to Latin editorial model titles, with balanced wrapping. Technical numbers use JetBrains Mono. Product identity, units and mixed-language text retain correct direction. The mobile opening trims duplicate editorial prose and keeps its catalog action visible in the first product chapter.

## Motion ownership

GSAP ScrollTrigger owns the bounded desktop pin and the **outer product drift wrapper**. React state changes only at product boundaries. Motion owns the inner chapter presence transition. Fonts/images have reserved dimensions and refresh the initial pin measurements; resize/media scopes and per-instance cleanup remove the pin when leaving home. Chapter progress is clamped to its final pose at the end, avoiding an end-of-scroll rotation reset. Indicators, previous/next and catalog navigation remain ordinary controls. Native wheel/touch scrolling is never intercepted.

Mobile, reduced-motion, save-data and low-core devices show all products in normal flow. `VITE_ENABLE_SCROLL_SHOWCASE=false` disables only the pin. `VITE_ENABLE_DEPTH=false` removes the optional in-plane depth treatment; the glass design and data remain. No genuine 3D renderer is present because verified meshes were unavailable; see [asset notes](assets.md).

The anatomy viewer owns its own stable Motion SVG layer groups. Assembled/exploded views share nodes; separating uses restrained per-layer translation, small rotation and a 65ms stagger over an 820ms movement. Replay remounts only these scoped layers from the assembled pose. Selection survives mode changes. CSS transitions are explicitly disabled on Motion-owned groups, preventing a second transform interpolator. Reduced motion has immediate poses and no CSS micro-transitions inside the viewer. Side profile and internal-fit modes retain their separate measured geometry.

## Applied tools

The installed UI UX Pro Max workflow was used for the overall system plus focused glassmorphism and reduced-motion searches. Its light palette was rejected in favor of the requested charcoal/slate direction; selective blur, contrast, spatial continuity and readable static fallbacks were applied. The frontend-design skill informed the single-scene composition and restrained typography.

Authenticated 21st discovery confirmed 51 tools. Free logo search returned empty results for the requested sports brands. Free component discovery returned **Glassmorphism Navigation #15025** and **Elevate Navbar #26786**. Their surface hierarchy informed the navigation review; animated text swaps on every link were rejected as unnecessary motion. No paid component-code retrieval or hosted generation was invoked. All frontend component code is original project code.
