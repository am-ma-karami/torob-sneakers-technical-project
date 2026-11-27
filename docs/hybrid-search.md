# Hybrid search API

Implemented 2026-11-27. `POST /api/search` combines lexical matching with the existing
CLIP specification and primary-photo indexes. This is a new backend endpoint; the
existing catalog listing API remains unchanged. `/finder` now has a **single search**:
right-side filter controls and a left-side semantic textarea submit together through
one button. Selected controls are appended to the description; explicit category,
brand and numeric limits are also supplied as hard SQL filters. Unselected controls
are omitted (including category, now empty by default). Width/weight/foam preferences
remain soft text preferences. Text-only and filters-only inputs are supported.

One “گزینه‌هایی برای مقایسه” section shows up to **9** results with existing ShoeCard
comparison controls. There is no separate manual result list, rule score, gray slots
or loading cards. `/semantic-search` redirects to `/finder`. The legacy `/api/finder`
endpoint is retained for compatibility, but this UI no longer calls it for results.

Each result includes `search_explanation`, one grounded Persian sentence derived
from known facts or actual retrieval channels. Numeric values and negations are
preserved without fabricated suitability claims or extra provider requests.

```json
{"q":"کفش سبک برای دویدن روی آسفالت","limit":12,"filters":{"brand":["adidas"],"weight_max":250}}
```

Metis uses the supplied OpenAI-compatible Chat Completions endpoint at
`https://api.metisai.ir/openai/v1/chat/completions`, default model `gpt-4o`, to translate
the query to concise English. Only the query goes to the provider; no catalog,
images, credentials or visitor data are included in messages. The provider key is
`METIS_API_KEY` (SecretStr), configured only in the ignored owner-only `.env`.
`METIS_MODEL` changes the model; restart the backend after configuration changes.
No key is sent to the browser, returned by the API or stored in Git/docs.

The local pinned CLIP text encoder generates the query vector in the **same space**
as the 2334 stored CLIP vectors. OpenAI text embeddings cannot be compared directly
to CLIP vectors, even when dimensions coincide. Long translated queries use lossless 77-token chunk pooling with a generic footwear-search prefix; no appended fields are silently truncated. The query worker loads cached weights
only, on CPU, with serialized inference; install the optional embedding dependencies
and provision the stage-1 model cache first. Missing weights/dependencies degrade to
lexical search rather than downloading weights during an HTTP request.

Independent top-100 channels use exact pgvector cosine ordering for specs/photos,
and literal-token/name-trigram ordering for lexical matches. Weighted reciprocal
rank fusion uses `1/(60+rank)`, weights lexical=1, text=1, image=0.7, deterministic
shoe-ID ties. These are initial engineering defaults, not evaluated relevance
weights or probabilities. English prepositions are excluded from lexical matching;
remaining lexical tokens must all match unless name trigram similarity exceeds 0.2.

All explicit catalog filters apply before ranking; `filters.q` is ignored in favor
of top-level `q`. Prices in these filters retain catalog MSRP USD semantics. Numeric
constraints inside prose are preserved in translation but **not automatically turned
into hard filters**: send `weight_max`, `drop_max`, etc. explicitly when required.
Text vectors whose content hash differs from current sourced facts are excluded.
Image vectors whose primary URL changed are excluded; same-URL pixel changes still
require the documented image refresh job. Only this pinned model key is searched.

Responses contain `items` (catalog summaries plus `search_score`, `search_channels`
with channel ranks), `returned`, `candidate_count`, `mode`, `degraded_reason`,
`translated_query`, `model_key`, and `score_kind=weighted_rrf_not_probability`.
Candidate count is a bounded retrieval pool, not an exact semantic match total.
Limits: combined query 1–1800 characters (textarea 400), results 1–48, provider timeout 12 seconds, bounded
128-entry process-local query caches, existing global request limits and no-store
HTTP responses. Provider failures and unavailable encoders return explicit
`mode=lexical_fallback`; provider response bodies/keys do not enter error responses.
There is no image-upload endpoint or generated recommendation text in this version.

Code: `schemas/search.py`, `services/search.py`, `repositories/search.py`,
`api/routes.py` under `backend/app/`. No database migration or product re-embedding.
Tests: `backend/tests/test_search.py`. Real Persian Metis translation and hybrid
retrieval were verified locally. Full backend suite passed 156 tests before the
additional positive dual-modality/stale-vector regression; final targeted results
are recorded in MEMORY.md. Relevance evaluation on labeled Persian queries, load/
cost testing and integrating semantic ranking into the existing catalog remain next steps.

Unified-flow verification: 24 backend search/embedding tests and 32 frontend unit
tests passed; Ruff/mypy/ESLint/TypeScript/build passed. Browser cases cover text-only
submission, combined/filters-only payloads with explicit brand/numeric filters, one
9-result output and comparison toggles. No database migration or vector refresh.
