# Architecture, actual controls and tradeoffs

The current [Glass Studio refinement](glass-studio/delivery.md) adds shared glass surfaces, verified brand marks, transparent catalog photography and restored anatomy motion. The [previous redesign](redesign/delivery.md) established the dedicated home, canonical catalog/product routes, read-only Persian presentation fields and empirical score context. Original data/security decisions below remain in force.

The API is a modular monolith. Routes handle HTTP/dependencies and delegate to catalog services and repositories. Pydantic validates query, summary and import contracts. SQLAlchemy models and Alembic persist brands, categories, conservative browsing families, exact shoes, chosen measurements with full provenance, verified variants, dated offers and original JSONB source payloads. PostgreSQL GIN indexes cover normalized text with pg_trgm and JSONB facets; ordinary indexes support stable numeric sorting. No separate search service or WebGL is needed at this scale.

React uses route-based code splitting, TanStack Query keys/cancellation, URL search parameters and a bounded localStorage comparison selection. Detail and comparison requests do not contain the raw archive. Motion owns route and anatomy transitions; lazy-loaded GSAP/ScrollTrigger owns the bounded desktop opening, with separate transform wrappers and scoped cleanup. CSS handles small feedback and native dialog entry. No genuine 3D renderer is present; the opening uses explicitly identified processed photography. SVG input values are clamped for rendering while original measured values remain visible. Outlines are always labeled schematic. Known layer thickness, platform width, stack, rocker, bevel and internal dimensions affect the view. Unknown fields never become apparent measured zeroes.

Security controls actually implemented:

- Bound SQLAlchemy parameters, escaped LIKE wildcards, allowlisted sort keys and typed bounds. Query length 160, page size <=48, comparison <=4, facet values and lists bounded.
- Request-body limit 16KiB enforced before parsing, including streamed/chunked input. Long URL query strings rejected. Malformed content length is a 400.
- Per-client-IP sliding-window rate limiter (240 requests/minute), bounded to 4096 IP entries. It does not trust forwarded client-IP headers.
- Explicit CORS origins, no cookies or credentials required, predictable safe error envelopes, production API docs disabled, database exception logs include only exception class names.
- No registration, public administration/import endpoint, backend URL-fetch endpoint, source-HTML injection, untrusted SVG import, frontend developer credentials, or client-side archive download.
- React text escaping, generated SVG, HTTPS retailer URL validation, noreferrer/noopener on external links, sponsored annotation on affiliate offers.
- Non-root application containers, internal database/backend networks, loopback-only frontend publishing, persistent DB volume. Nginx adds CSP, nosniff and referrer policy.
- Local secrets/raw data/build output/venv/node_modules are ignored. A staged-file scan rejects the supplied secret pattern before commits. Fonts are local and ship license notices.

Limits: the in-process rate limiter is intended for one API process; replicated workers need a shared or edge limiter. Behind a reverse proxy, the default peer-IP limiter can group requests under that proxy, so configure a trusted-proxy strategy deliberately before public hosting. Corpus search is token substring/prefix ranking with aliases, not semantic or medical advice. Family labels are a browsing heuristic. Images are external and may fail; the UI has fallbacks. Offers are dated snapshots, not live stock. There is no currency conversion or compatibility averaging. Large future corpora would benefit from aggregate facet SQL, reduced payload projection and a richer family/variant editorial taxonomy. No public deployment, external account messages, purchase or subscription was performed.

Docker configuration was structurally checked but could not be executed because Docker is absent on the implementation host. Local PostgreSQL, migrations, import, backend, frontend and real-browser tests are the executed reference environment.
