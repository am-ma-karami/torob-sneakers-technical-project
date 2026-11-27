# Hybrid search API

Implemented 2026-11-27. `POST /api/search` combines lexical matching with the existing
CLIP specification and primary-photo indexes. This is a new backend endpoint; the
existing catalog search UI and `/api/catalog` are unchanged. A separate page at
`/semantic-search`, linked as «جست‌وجوی معنایی», now submits descriptions explicitly
and displays up to 10 ranked ShoeCards below the form. It includes loading, retryable
error, empty and lexical-fallback states; desktop/mobile real-API and error journeys passed.

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
to CLIP vectors, even when dimensions coincide. The query worker loads cached weights
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
Limits: query 1–400 characters, results 1–48, provider timeout 12 seconds, bounded
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
