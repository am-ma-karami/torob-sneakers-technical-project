# Dataset and persistence contract

The original 13 files were copied (not moved) into the project root and verified by byte count and SHA-256. `dataset-verification.json` records their manifest. The importer resolves `DATA_DIR=.` against the repository root, independently of the shell working directory. Only project-local copies are used by the application.

The compact CSV has a UTF-8 BOM and 82 columns. Read it with `encoding="utf-8-sig"`. The authoritative structured input is `shoes-ui.json`: `{schema_version, generated_at, count, shoes}`. Each shoe contains an integer RunRepeat `shoe_id`, slug, summary, metric provenance, visualization, fit, construction, source-specific scores, commerce, media, sources and quality flags. The visualization dataset is cross-checked by ID. `source-records.jsonl` is streamed to recover `runrepeat.flat_row.lab__insole_thickness` and `lab__outsole_thickness`, and retained in private database JSONB. It is never sent in catalog responses.

## Observed coverage

| Property | Coverage |
|---|---:|
| Base models | 1167 |
| Running | 670 |
| Sneakers | 117 |
| Basketball | 71 |
| Tennis | 57 |
| Training | 54 |
| Hiking shoes | 52 |
| Walking | 49 |
| Hiking boots | 47 |
| Track spikes | 26 |
| Hiking sandals | 17 |
| Cross-country | 7 |
| Weight | 1162 |
| Heel stack | 1162 |
| Full rocker profile | 217 |
| Current internal forefoot width | 894 |
| Known plate status/type | 685 |
| Named foam | 315 |
| Upper material | 936 |
| ShoeGeometry matches | 239 |
| SoleHunt shared models | 109 |
| Any enrichment | 319 |

Generated snapshot: 2026-11-20T11:04:47.089677+00:00. ShoeGeometry dataset version: 2026-11-14. RunRepeat offers in this source use EUR and DE and carry individual extraction timestamps. SoleHunt timestamps are retained per record and can be older; they are not refreshed or represented as live prices. `docs/import-report.json` records the complete idempotency run: 1167 updated, zero new identities, 27048 measurements, 3845 colorways, 4739 offers.

## Identity and taxonomy

The primary identity is the original integer shoe ID, with a unique exact slug. Generations, GTX/WP and kids/adult records are never merged by name. Brand, category and family are separate concepts. Family is a conservative *browsing heuristic*: remove a final generation suffix from the model label; it never determines persistence identity. Raw names retain all generation/version qualifiers. SoleHunt duplicate and width records stay under distinct source records and never overwrite the base dimensions. The three known wide source variants remain explicitly labeled in product details.

Categories and brands come from PostgreSQL. Facets include category, activity, brand, family, color, terrain, arch support, declared widths, fit, plate, foam, upper, geometry coverage and release year. Missing facets are unknown. Numeric filters exclude records lacking that measurement. Price sorting/filtering uses manufacturer MSRP in USD exclusively. Retail offers keep their own currencies and are not pooled into that sort.

Search performs Unicode normalization, Persian/Arabic ی/ک and digit normalization, punctuation/spacing normalization and common Persian brand/model/color aliases. All query tokens must match normalized indexed search text. Ranking uses exact model name, then name prefix, then source-specific RunRepeat score, then stable original ID. OR within multi-select groups, AND across groups. Facet counts exclude their own active group while retaining all other constraints (disjunctive counts).

## Measurements

A measurement retains numeric value, unit, source URL/name, origin, method/version, tested size, confidence, photo disagreement interval, uncertainty and reference length where available. Null means missing and is never zero. Measured and manufacturer-stated stack heights are separate keys. Asker C, Shore A and source-specific Shore C are separate scales. BR is a score unit, not percent; the old 1–5 breathability test is separate. SA shock absorption and percentage energy return are separate. Source-specific ratings are never averaged.

Internal forefoot width, big-toe width, platform width and external toe-shape ratio are different boundaries. Old width methods are not substituted for current internal widths. Photo-derived millimetre values use a 300mm reference, not an exact real size. Schematic interpolated curves and upper/layer outlines do not claim factory CAD precision. No rocker curve is drawn when rocker inputs are missing. Unknown plate status and explicit `none` are different states.

## Variants and commerce

Only retailer records with a nonzero color ID and explicit `name_suffix` become verified colorways. Original names (including SKU text), source ID and corresponding CDN image path are retained. Canonical color words are extracted only from recognized color labels; an unrecognized name stays preserved without an invented color. Generic `is_any_color` offers remain model-level. A selected color shows only offers with its matching source ID. No matching offer means unknown snapshot availability, not out of stock. Size conversion tables are generic brand charts, not model inventory; raw size-index encodings are not guessed into available sizes.

## Import guarantees and scope

Validation checks input count, unique IDs/slugs, summary identity, finite measured numbers, metric units/origins, and cross-file identities before writes. A transaction upserts brands, categories, families, shoes and original source payloads and replaces model-owned measurements/variants/offers. Failure rolls back. Re-importing the same files creates no duplicate identities. Source payloads preserve values that are not selected into compact fields. The import does not delete models merely absent from a later input; explicit catalog retirement is a future administrative task.

The browser receives a bounded compact catalog page (18 by default, 48 maximum), then one structured detail record or up to four comparison records. Comparison fetches related records in four batched database queries, independent of model count. Facet calculation issues one bounded small-catalog query per group; this is intentionally simple for 1167 records and should be replaced with aggregate SQL if the corpus grows substantially.

## Attribution

RunRepeat laboratory measurements, supplied source review excerpts, and externally hosted photography retain their source credits. [ShoeGeometry](https://shoegeometry.com/data): ShoeGeometry (2026). Running-shoe geometry dataset, version 2026-11-14, CC BY 4.0. [SoleHunt public data](https://solehunt.app/data), CC BY 4.0. Diagram adaptations are explicitly identified. Per-model and per-metric sources are visible in the UI. Font notices ship at `/font-licenses.txt`.
