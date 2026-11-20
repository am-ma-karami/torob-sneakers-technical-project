export type Metric = {
  value: number;
  unit: string;
  source: string;
  source_url?: string;
  origin: string;
  methodology_version?: string;
  method_version?: string;
  test_size_raw?: string;
  confidence?: number;
  uncertain?: boolean;
  photos_min?: number;
  photos_max?: number;
  reference_length_mm?: number;
};
export type Summary = {
  shoe_id: number;
  slug: string;
  name: string;
  brand: string;
  family: string;
  categories: string[];
  variants_count: number;
  image_url: string | null;
  catalog_image_url?: string | null;
  colors?: string[];
  release_year: number | null;
  weight_g: number | null;
  msrp_usd: number | null;
  runrepeat_score: number | null;
  solehunt_score: number | null;
  heel_stack_mm: number | null;
  forefoot_stack_mm: number | null;
  drop_mm: number | null;
  interior_forefoot_width_mm: number | null;
  toebox_width_mm: number | null;
  toebox_height_mm: number | null;
  toe_rocker_pct: number | null;
  toe_tip_height_mm: number | null;
  heel_bevel_pct: number | null;
  heel_bevel_height_mm: number | null;
  midsole_width_forefoot_mm: number | null;
  midsole_width_heel_mm: number | null;
  geometry_status: string;
  plate: string | null;
  foam: string | null;
  upper_material: string | null;
  outsole_material: string | null;
  pros: string | null;
  cons: string | null;
  terrain: string | null;
  uses: string | null;
  arch_support: string | null;
  fit_label: string | null;
  fit_note: string | null;
  size_fit_votes: number | null;
  tested_size_raw: string | null;
  width_options: Record<string, string> | null;
  removable_insole: boolean | null;
  reflective: boolean | null;
  [key: string]: unknown;
};
export type Variant = {
  key: string;
  name: string;
  colors: string[];
  image_url: string | null;
  source: string;
  source_id: number;
};
export type Offer = {
  key: string;
  variant_key: string | null;
  retailer: string;
  price: number;
  currency: string | null;
  country: string | null;
  url: string;
  snapshot: string | null;
  source: string;
  colorway: string | null;
};
export type Shoe = {
  shoe_id: number;
  slug: string;
  summary: Summary;
  metrics: Record<string, Metric>;
  variants: Variant[];
  offers: Offer[];
  visualization: {
    reference_length_mm: number;
    side_profile: Record<string, number | string | null>;
    fit_section: Record<string, unknown>;
    top_outline: Record<string, unknown>;
  };
  sources: {
    name: string;
    url: string;
    license?: string;
    attribution?: string;
    extracted_at?: string;
    dataset_version?: string;
  }[];
  quality_flags: string[];
  construction: Record<string, unknown>;
  scores: {
    runrepeat: { overall: number | null; usage: Record<string, number> };
    solehunt: Record<string, number | boolean | null>;
    geometry: Record<string, number | null>;
  };
  fit: {
    size_chart: Record<string, unknown>[];
    brand_specs: Record<string, unknown>;
    solehunt: Record<string, unknown>;
    width_variants: Record<string, unknown>[];
  };
  solehunt_source_specific: Record<string, unknown>;
};
export type CatalogResult = {
  items: Summary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};
export type FacetOption = { value: string; label: string; count: number };
export type FacetResult = {
  groups: Record<string, FacetOption[]>;
  count_mode: string;
  price_basis: string;
};
export type Taxonomy = {
  categories: FacetOption[];
  brands: FacetOption[];
  total: number;
};
export type FinderPrefs = {
  category: string;
  width: string;
  weight: string;
  cushion: string;
};
export type FinderResult = {
  items: {
    shoe: Summary;
    points: number;
    reasons: string[];
    unknown: string[];
  }[];
  rules: Record<string, unknown>;
};
