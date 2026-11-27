# My Shoe: three search experiences

Implemented 2026-11-27 using the existing dark RTL Glass Studio tokens, React,
TanStack Query, lucide icons and shared `/api/search` recommendation engine.
No new dependencies, backend changes, migration or changes to other pages.

## Components and behavior

- `pages/Finder.tsx`: shared drafts, validation, taxonomy/brand choices, one query
  lifecycle and one result area. Nothing is submitted on mode selection or typing.
- `components/finder/SearchModes.tsx`: three native keyboard-accessible buttons,
  visible selected state plus aria-pressed; initial page shows only the choice.
- Advanced: mandatory activity/brand/weight/drop, soft width/weight/foam preferences,
  progressively disclosed surface/breathability/flexibility/durability; short
  explanations distinguish drop, stack height, foam and width. No AI textarea.
- Advisor: only `pages/SemanticSearch.tsx`, an auto-growing Persian/English input,
  four editable examples, character count, Ctrl/Cmd+Enter submit and Enter newline.
  Examples populate text, never automatically search. It sends no hidden filters.
- Hybrid: same manual controls on desktop right, same advisor on left, each sized
  to content. Mobile stacks them and provides collapsible manual controls.
- `components/finder/FinderResults.tsx`: applied-criteria chips with an edit action,
  actual backend conflicts (manual/text), optional empty-result adjustment counts,
  explicit AI/semantic degradation, network retry and manual-search alternative.
  Existing ShoeCard detail links and 2–4 shoe comparison remain intact. Valid backend
  match scores are displayed; evidence coverage remains API-only. Manual results omit
  the recommendation explanation block; advisor/hybrid retain it. Score fractions
  and shared ShoeCard badges read left-to-right (`93 / 100`). No generated scores or products.
- `pages/finder.css`: page-scoped responsive layout, existing navy/champagne palette,
  selected/hover/focus states, reduced-motion spinner and touch-sized actions.

Drafts persist in memory across modes, not across refresh. Switching hides previous
results, cancels the old query observer, preserves draft text and selections, and
requires an explicit new submit. Advanced drops text; advisor drops manual and extra
preferences; hybrid sends both as separate typed fields. Reset clears all drafts,
validation and applied results. Per-submit query revision separates consecutive
responses; in-flight submission is guarded, auto retry/focus/reconnect disabled.

Interpreted requirements are reviewed as applied chips; editing returns to the
existing form/text without resetting drafts. Direct inline editing of arbitrary AI
JSON is not exposed: changing an inferred requirement means editing its source text;
manually overriding it can still produce an honest backend conflict. Suggestions
never automatically relax constraints. Unsupported promises remain clarification
states, including examples requesting unverifiable stability/comfort claims.

## Verification and limits

Fresh frontend ESLint, TypeScript/production build and 32 unit tests pass. Ten
updated desktop/mobile search journeys passed, including actual API advanced,
advisor and hybrid requests, hidden-field isolation, reset, comparison selection,
error/fallback, empty adjustments and conflict evidence rendering. Two additional
layout journeys passed at 375px, landscape and reduced-motion, checking desktop
right/left alignment and page overflow. Desktop and mobile screenshots inspected.

An initial test using a different short advisor query failed because the existing
provider validation returned no results. It correctly displayed the failure. The
repeat used the previously validated live query and passed; this is not evidence
that provider variability is solved. Fault/empty/conflict UI tests use controlled
responses; production implementation only calls the real API. Images still use
existing external catalog CDNs and can load slowly/fail. No image pipeline change.
Existing large Three.js production chunk warning remains. Full backend tests were
not rerun because backend is unchanged (181 passed in preceding engine task).

Latest presentation verification: four focused manual/advisor desktop/mobile
journeys passed, including absent manual explanations, absent data coverage and LTR
source/preference scores. TypeScript/build and ESLint passed. No backend changes.
