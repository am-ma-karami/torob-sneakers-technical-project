# CLIP product embeddings — stage 1

Subsequent stage: [hybrid search API](hybrid-search.md) now supplies query encoding
and backend retrieval. The embedding-only boundaries below describe stage 1.

Implemented and populated locally on **2026-11-27 (Asia/Tehran)**. This stage creates
embeddings only. Catalog search, finder rules, public API responses and the UI keep
their existing behavior. No query encoder, hybrid ranking, approximate-search index,
search endpoint or scheduled refresh has been added.

## Stored result

| Item | Verified local result |
| --- | ---: |
| Canonical products | 1167 |
| Primary product-photo vectors | 1167 |
| Product-specification vectors | 1167 |
| Total vectors | 2334 |
| Dimensions per vector | 512 |
| Source text chunks processed | 12443 |
| Longest model input, including special tokens | 77 tokens |
| Failed products/images in the completed run | 0 |

The model is [`openai/clip-vit-base-patch32`](https://huggingface.co/openai/clip-vit-base-patch32),
pinned to revision `3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268`. Both encoders project
to the same 512-dimensional space. The exact model/recipe descriptor is recorded in
`app/embeddings/spec.py` and `embedding_models.configuration`; its SHA-256 model key
is `eeaaff8590188a20ac6d11a7268f0805284cfc928365ea95d9ab3923cb57770b`.

Images and text remain **separate**, with L2-normalized float32 vectors. They are
not concatenated or assigned a retrieval weight at this stage. PostgreSQL's
[`pgvector`](https://github.com/pgvector/pgvector) stores them beside existing model
identities, with foreign keys and transactional updates; no separate vector service
or duplicated product database is needed.

## Inputs and provenance

The job reads the actual normalized `shoes` and `measurements` tables. It does not
embed unapproved retailer discovery rows as new canonical products.

- **Image:** one existing canonical `summary.image_url` per product, with its exact
  `product_primary/SHOE_ID/` path. It is not every gallery/variant image. Lab charts,
  fabricated pictures, another model's photos and arbitrary URL hosts are excluded.
  A primary photo is model-level; no exact variant/color identity is inferred.
- **Specifications:** English name/brand, sourced category/use/terrain/fit/material/
  construction attributes, source pros/cons, and all stored measurements with units,
  origin, source and available method/uncertainty context. Missing fields stay absent;
  known `false` and numeric zero are retained. Full source metric provenance remains
  in the embedding row's `provenance.facts`, including original source URLs.
- Volatile store prices, inventory, offer counts, visitor/admin data, size-stock
  assumptions, and retailer descriptions do not become product specification facts.

CLIP's context is short. The worker tokenizes complete statements without truncation,
packs/splits the payload into contexts of at most 77 tokens, and repeats the exact
product name in each context. Each chunk feature is normalized; their mean is
normalized again to produce the single text vector. Decoded chunks/token counts are
retained for audit. A name too long to fit fails explicitly instead of losing identity.

This is a baseline representation, not evaluated search quality. CLIP is trained
primarily for English image/text alignment; [its model card](https://huggingface.co/openai/clip-vit-base-patch32)
does not establish Persian retrieval quality or precise numeric reasoning. A later
Persian query strategy and ranking evaluation are still needed. Exact numeric
conditions should continue using sourced structured SQL fields. Text pooling weights
and eventual image/text retrieval weights require evaluation before search rollout.

## Code and persistence

| Responsibility | Path under `backend/` |
| --- | --- |
| Migration/pgvector extension | `alembic/versions/005_product_embeddings.py` |
| ORM tables | `app/models/embeddings.py` |
| Pinned model/recipe/hash | `app/embeddings/spec.py` |
| Deterministic fact documents | `app/embeddings/documents.py` |
| Optional local CLIP adapter/chunking | `app/embeddings/clip.py` |
| Bounded source photo cache | `app/embeddings/images.py` |
| DB reads/upserts/coverage | `app/repositories/embeddings.py` |
| Batch orchestration | `app/services/embeddings.py` |
| Plan/apply/status CLI | `app/embeddings/__main__.py` |
| Regression tests | `tests/test_embeddings.py` |

Migration **005** enables `vector` in `public` and adds `embedding_models` plus
`product_embeddings`. A vector row is keyed by `(shoe_id, model_key, modality)`.
It carries a content hash, provenance and created/updated timestamps. SQL constraints
enforce modality, 512 dimensions and unit norm. Downgrade removes only these two
tables, retaining the potentially shared extension. Other dimensions require an
explicit future schema change; vectors from different models/recipes must not mix.

Runtime dependencies add `pgvector==0.4.2` and NumPy; heavy ML dependencies remain an
optional offline installation. HTTP workers never import/load a CLIP model. The
local execution used torch **2.15.0**, Transformers **4.57.6**, Pillow **12.3.0** and
Apple MPS. CPU and explicit CUDA are also supported by the worker, but only MPS
execution was verified here. `requirements-embeddings.lock` pins the worker's
Python packages; CUDA platform dependencies may differ on Linux.

## Installation and commands

Install pgvector **on the PostgreSQL server** before migration. Installing just the
Python package cannot provide `CREATE EXTENSION vector`. The operator applying the
migration needs extension/schema permissions. For Homebrew PostgreSQL 18, the normal
command is `brew install pgvector`; use [official installation instructions](https://github.com/pgvector/pgvector#installation)
for another platform. This workstation's Homebrew route failed on an unrelated
untrusted MongoDB tap; it was left untouched. Official pgvector **0.8.7** was compiled
from tag `v0.8.7` in ignored `.local/pgvector-src`, with this machine's active Xcode
SDK rather than the stale SDK path in Homebrew's PGXS configuration.

```sh
# Existing core environment and privately configured DB; don't overwrite .env.
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python -m pip install --no-deps -e .
.venv/bin/python -m pip install -r requirements-embeddings.lock
# Back up the DB and verify the archive before applying a schema change.
.venv/bin/alembic upgrade head

# Read-only plan: no model load, downloads or embedding writes.
.venv/bin/python -m app.embeddings
# Persist actual local CLIP inference; default batches 16, photo workers 4.
make embeddings
# Stored counts for this pinned model/recipe; no inference or download.
make embeddings-status

# Targeted run and separate report; no catalog reimport is required.
.venv/bin/python -m app.embeddings --apply --shoe-id 40586 \
  --report .local/embeddings/targeted-run.json
```

The default model/image cache and report live under ignored `.local/embeddings/`.
Public weights download with `token=False`/`trust_remote_code=False`; product facts
are encoded locally, not sent to a hosted inference API. Source images are fetched
only from the reviewed RunRepeat CDN host, with validated redirects/product paths,
timeouts, byte/pixel limits and image decoding checks. Original response time and
content SHA-256 remain attached to cached bytes; a cache hit does not claim a new
source observation. Original raw input files remain untouched.

## Resume, refresh and failure behavior

Run the same command after interruption: committed batches survive. Source facts and
photo-content hashes skip unchanged work; a completely unchanged rerun does not
instantiate CLIP. Changed spec facts regenerate text without recalculating the image.
`--refresh-images` explicitly refetches photo bytes so an update at the same URL can
be detected. `--device cpu`, `--device mps`, `--device cuda`, `--limit`, `--batch-size`,
`--workers`, `--cache-dir` and `--report` are available. An advisory lock prevents
concurrent CLI writers for this model/recipe; it is released after exit.

Controlled photo failures are recorded by product ID/reason; text and other products
continue. Completed output is `status=partial`, exit **2**, when any photo failed.
A fatal encoder/DB interruption stops the current batch, records `interrupted`, and
can be rerun. The last good vector is retained until successful replacement. Its
stored provenance/hash remains an old snapshot; never treat failed refreshes as fresh.
Existing rows are not automatically invalidated by later catalog imports. Rerun
the worker after source changes and compare current input hashes before using
snapshots in a future retrieval implementation. CLI `--status` reports stored
coverage, not an automatic stale-input audit or a promise of retrieval readiness.

`compose.yaml` and CI now use `pgvector/pgvector:0.8.7-pg18`. The Docker configuration
was updated, not executed here. For an existing volume created with the former
`postgres:18-alpine` image, use a verified logical backup/restore into a separate
pgvector volume; don't blindly replace its operating-system image or delete it.

## Fresh verification — 2026-11-27

- **152 backend tests passed**, including populated migration/metadata comparison
  and 17 embedding tests for source/provenance, lossless token splitting, safe image
  caching, invalid vectors, real pgvector storage/cosine operators, unchanged reruns,
  changed specs, failed-image resume and preservation of catalog/commerce data.
  All 17 embedding tests were rerun after the final token-warning adjustment and passed.
  CI needs no model download; the Pillow-specific cache test skips if the optional
  image dependency is absent. Actual inference was verified separately on this machine.
- Ruff/mypy and `pip check` passed; editable installation was refreshed. A fresh
  private DB backup was created and its archive catalog validated before migration.
- Final CLI status confirmed 1167 complete pairs; running readiness, catalog and
  existing shoe-detail APIs returned 200 with DNT=1. Compose/CI YAML parsed successfully.
- A real four-product smoke run generated eight vectors, then the full run completed
  all **1167** products with **zero failures**. Repeat full run wrote **zero** vectors,
  skipped 1167 per modality and loaded no encoder.
- All 2334 vectors have dimension 512; observed norms were
  **0.999999886–1.000000153**. The 12443 retained text chunks use **8–77** input tokens.
- A read-only comparison of the pre-migration backup's selected product/commerce
  COPY rows and the current DB matched every row in shoes (1167), measurements
  (27048), variants (3845), offer listings (13070) and observations (17809). The backup
  was not restored over the working database. No visitor identifiers were inspected.
- Private evidence: `.local/embeddings/{smoke-run,catalog-run,reimport-run,verification,backup-comparison}.json`.
  The verified pre-migration backup is
  `.local/backups/before-domestic-crawls-20261127T104924Z.dump`. Weights, photo cache,
  embeddings/data backups and private reports remain outside Git. Transfer a private
  database backup or rerun this job on another machine; a Git checkout alone has no vectors.
- No production frontend changes; frontend/browser suites and Docker execution were
  not rerun for this backend-only stage. No commit or push was authorized.
