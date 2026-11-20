# Glass Studio refinement baseline

Recoverable baseline: `1cece00` on branch `baseline/nocturne-ui-2026-11-20`. Work branch: `feat/glass-studio-and-anatomy-motion`. The original working tree was clean. Current home and exploded anatomy were captured before UI changes at desktop 1440×1000 and mobile 390×844 in `before/`. No database migration is planned.

The animation regression is visible in Git history: the bright implementation used `motion.g` and per-layer animated offsets. The Nocturne rewrite replaced those groups with fixed `g transform="translate(...)"` nodes and separate assembled/exploded render branches. There is no evidence of a global ScrollTrigger cleanup killing the anatomy animation. The fix will restore scoped Motion groups and replay/reassembly controls while retaining measured geometry and available-layer filtering.

Design direction: a charcoal studio with floating real product photographs, cool diffuse light and restrained dark glass. Persian Vazirmatn typography remains primary; Bodoni is confined to Latin model names. Use one product scene rather than duplicated hero/showcase imagery, a short Persian headline, one catalog action and a quiet finder link. Glass is a surface system, not blur on every nested element.

Tokens: canvas #171D27, slate #222C3B, glass #263448 / ~76%, text #F3F2EE, secondary #BEC9D8, cool light #A6C8E9, restrained champagne #C7AC88. Blur is selective, with an opaque fallback. Keyboard focus, selected states and contrast take precedence over transparency.

UI UX Pro Max design-system, glassmorphism and reduced-motion searches were run. The generated light palette was rejected; its scroll narrative, progressive disclosure and spatial continuity guidance were adapted. 21st free logo search was verified for 15 major shoe brands and returned no matches. No paid retrieval or generation was used.
