# Shared search and recommendation engine (v2)

Implemented 2026-11-27. `/finder` keeps its two input panels, one submit button,
up to nine existing comparable ShoeCards and RTL styling. The visual redesign is
separate work. Catalog browsing and legacy `/api/finder` remain unchanged.

## Why v1 failed

Manual selections became prose, numerical prose was not extracted into hard SQL
constraints, and RRF fused lexical/photo/specification similarity without structured
preference scores. CLIP similarity cannot reliably enforce numbers. Name-heavy
pooled documents and separate top-100 candidate channels also limited preference
ranking. Persian queries needed structured English interpretation, not translation
alone. v2 keeps manual fields typed and filters before any semantic scoring.

## Pipeline and ownership

`POST /api/search` → typed request → optional Metis intent → validation → merge →
SQL eligibility → eligible-ID CLIP scoring → deterministic preference ranking →
final SQL and evidence revalidation → evidence-based Persian explanations.

- `backend/app/schemas/search.py`: strict request/intent/preference models.
- `services/search_intent.py`: cached provider extraction, ontology/unit/source-quote
  checks, bounded explicit-number omission guard and controlled surface recovery.
- `services/search_query.py`: manual authority, numeric intersection, conflicts.
- `repositories/recommendations.py`: eligibility, measurement provenance, current
  product evidence and same-product vector lookup.
- `services/recommendation_scoring.py`: centralized versioned weights/heuristics.
- `services/recommendations.py`: shared orchestration, failure handling and output.
- `services/search.py`: cached local CLIP query encoder and public service wrapper.
- `frontend/src/lib/finderSearch.ts`: sends original text and typed selections
  separately; `pages/Finder.tsx` consumes results and explicit failure notices.
- `repositories/search.py`: old RRF retained only for offline baseline evaluation.

## Request and modes

```json
{
  "q": "کفش نرم برای دویدن روزانه روی آسفالت",
  "hard_filters": {"brand": ["adidas"], "weight_max": 250},
  "preferences": {"width": "wide", "priorities": {"width": 2}},
  "mode": "auto",
  "limit": 9
}
```

`q` defaults empty (maximum 1800 characters; current textarea 400), `limit` 1–48.
Empty input is 422. Extra/unsupported fields, nonfinite measurements, invalid ranges
and mode/input mismatches are rejected. Unselected fields stay neutral.

| Mode | Inputs | Processing |
| --- | --- | --- |
| `advanced` | Manual hard filters/preferences | No LLM, encoder or vector retrieval |
| `advisor` | Text only | Extract, filter, retrieve, rank, validate |
| `hybrid` | Text and manual criteria | Same engine, explicit manual authority |
| `auto` | Either/both | Infers one of the three modes |

Hard fields: brand/category arrays, weight_min/max in grams, drop_min/max in mm.
Each bound optionally has a matching `_exclusive` boolean. Unknown mandatory
measurements are excluded. Numerical eligibility requires matching canonical metric
value/unit and `lab_measured` or `manufacturer_stated` provenance; estimates do not
qualify. Brands resolve against the actual catalog; categories use existing slugs.

Soft fields: weight light/balanced, width wide/regular, cushion soft/firm,
surface road/trail, usage jogging/walking/treadmill/hiking/gym/all-day wear,
breathability/durability/flexibility/cushioning high. Priorities are 0.25–4 for active
criteria only. Unsupported mandatory medical, stability or distance claims require
clarification rather than invented measurements. Absence of evidence is unknown.

Manual and extracted numeric bounds intersect. Incompatible ranges or differing
brand/category sets block results and report conflicts. Manual soft values/priorities
win with conflict information. No criterion is counted twice or silently relaxed.

## Intent and vector evidence

Metis OpenAI-compatible Chat Completions, configured model (default gpt-4o), JSON
object response, temperature 0, 15-second timeout. Only the query, supported schema
and catalog brand/category ontology are sent. User text is data. JSON is untrusted:
Pydantic schema, allowed values, quoted source evidence, numeric units and boundary
semantics are checked. Persian/Arabic digits, kg→g and cm→mm are supported.
The bounded numerical guard catches common omitted explicit requirements; it is not
a complete natural-language grammar. Ambiguous intent can fail closed.

The concise English semantic description enters the same pinned local CLIP text
encoder used for the stored 512D vectors. All 1167 products/2334 vectors are reused;
no migration, dependency, index rebuild or product re-embedding was needed. Exact
pgvector cosine scores are restricted to eligible canonical IDs, without a top-100
preference cut-off. Text hashes and primary-image URLs must match current evidence.
Same-URL image content changes still require an explicit image refresh. Long queries
retain lossless token-chunk pooling; cached CPU weights only, no HTTP-time download.
OpenAI text embeddings are not compared with CLIP embeddings.

## Deterministic scoring

`rad-recommendations-v2` scores are engineering heuristics, not fit/comfort
probabilities. Requested preferences only:

- `match_score = 100 × sum(weight × criterion_score_or_zero) / sum(requested_weights)`.
- `data_coverage = sum(weights_with_known_evidence) / sum(requested_weights)`.
- No preferences: both match score and coverage are null, not an invented 100%.
- Semantic score = 0.8 × text cosine + 0.2 × image cosine (clamped 0–1;
  missing channels zero). Lexical score is exact canonical full-name presence.
- Text with preferences: rank = 100 × (0.8 × preference + 0.15 × semantic +
  0.05 × lexical). Text without preferences: 100 × (0.7 × semantic + 0.3 × lexical).
- Manual mode: rank = preference score; hard filters add no bonus.
- Ties: ranking, coverage, sourced catalog overall score, then canonical ID.

Criterion normalization, all clamped 0–1:

| Criterion | Evidence / heuristic |
| --- | --- |
| Light | (350 − weight_g) / 150 |
| Balanced | Full score 250–320g, linear decay over 100g outside |
| Wide / regular | (interior_width_mm − 94)/6; regular peaks at 97mm |
| Soft / firm | Asker C preferred, threshold 35; Shore A fallback threshold 20; soft = 0.5 + (threshold − value)/(2×threshold); firm inverse |
| Breathability | Actual `1-5` metric: (value−1)/4 |
| Durability | 1 − outsole_wear_mm/2 |
| Flexibility | 1 − bending_force_30deg_n/30 |
| Cushioning | (heel_shock_absorption_SA − 60)/100 |
| Surface / usage | Supported term in actual terrain/uses string or list |

These thresholds are tunable defaults, not validated biomechanical cutoffs. Foam
scales remain distinct; mismatched units are unknown. Each criterion returns actual
value, unit, metric field, provenance, requested priority and match/partial/miss/unknown.
Missing requested data contributes zero without inflating evidence coverage.

Persian explanations are deterministic, based on those criteria: known measurements,
trade-offs and missing evidence. Optional LLM explanation rewriting is deliberately
unused: no per-product calls or generated specifications, IDs, scores or ordering.

## Response and failure contract

Response includes `items`, `mode`, `status`, `interpreted_requirements`,
`applied_hard_filters`, `applied_preferences`, `conflicts`, `eligible_count`,
`candidate_count`, `returned`, `model_key`, `scoring_version`, `score_kind`,
`degraded_reason`, `empty_result`, `unsupported_requirements`,
`suggested_adjustments` and, after scoring, `translated_query`.

Items retain catalog summaries and compatibility `search_score/search_channels/
search_explanation`; add `product_id`, `match_score`, `ranking_score`, `data_coverage`,
`criteria`, `missing_data`, `semantic_scores`, `explanation_source`.
Channel values are cosine evidence now, not old RRF ranks. Counts describe the
eligible pool, not a validated semantic match count.

| Status / degradation | Behavior |
| --- | --- |
| `ok` | Validated ranked results |
| `conflict` | Zero results; blocking conflicts require correction |
| `unsupported_requirements` | Zero results; clarification needed |
| `intent_unavailable` | Text-only fails closed; retry |
| `manual_filter_only` | Hybrid provider failure; explicitly labeled manual-only results, `requires_confirmation=true` |
| `no_matches` | Honest empty result; optional remove-one-field suggestions contain counts and `applied=false` |
| Encoder unavailable / no fresh vectors | Applied structured requirements retained; degraded_reason and visible notice, no claim semantic ranking succeeded |

Final SQL revalidation removes ineligible/nonexistent products; changed evidence is
discarded. Duplicate vector/candidate IDs cannot create duplicate products. Legacy
`filters` supports brand/category/weight/drop only; unsupported nondefault catalog
fields now return 422. Old mode names and RRF score semantics intentionally changed.
`/api/catalog` and `/api/finder` contracts did not change.

## Reliability and verification

Keys remain backend-only SecretStr in ignored configuration. Never log provider
bodies/keys, visitor IDs or full queries. Logs record stage counts/status/timing.
128-entry process-local intent/query caches avoid repeated work; no automatic paid
frontend retries/refocus calls. Existing request limits and no-store responses remain.
No production data was changed during this refactor.

Fresh checks: 181 backend tests passed (four existing deprecation warnings), Ruff and
mypy (53 modules) passed; 32 frontend tests, ESLint, TypeScript and production build
passed. Build retains the existing large Three.js chunk warning. All six final desktop/mobile browser scenarios passed, covering manual payloads,
real advisor results, comparison toggles and visible error/fallback notices.

`python -m scripts.evaluate_search --live-ai` evaluates eight actual-catalog cases
and writes an ignored private JSON report. Final run: 7/8 expected intent/status
scenarios; zero mandatory-constraint violations across all returned results. One
hybrid provider interpretation failed validation and correctly returned labeled
manual-only results. Persian/English numeric cases and brand conflict passed.
The old retrieval baseline violated inferred constraints for 9/9 Persian, 9/9
English and (in an earlier completed hybrid run) 3/9 hybrid results; this isolates
retrieval using the same validated English query, not a complete historical replay.

This small smoke set does not establish general relevance accuracy. Remaining:
provider variability and broader negation/ambiguous-language tests; human-labeled
Persian/English relevance judgments and calibrated weights; load/latency evaluation;
optional better image-angle/text document representation. Scoring all 1167 products
is acceptable locally but is not a production load guarantee. Next requested task is
a separate UI redesign, including richer presentation of interpreted criteria,
conflicts, score breakdowns and suggestions already exposed by this API.
