import raw from "./fixtures-data.json";
import type { Shoe, Summary } from "../lib/types";
export const summaries = raw.shoes.map((s) => ({
  ...s.summary,
  slug: s.slug,
  family: s.summary.name,
  variants_count: 2,
  catalog_image_url: s.summary.image_url,
  colors: ["black", "white"],
})) as unknown as Summary[];
export const shoe = {
  ...raw.shoes[0],
  summary: summaries[0],
  metrics: {
    ...raw.shoes[0].metrics,
    insole_thickness_mm: {
      value: 2.4,
      unit: "mm",
      source: "RunRepeat",
      origin: "lab_measured",
    },
  },
  variants: [
    {
      key: "black",
      name: "Black (JP7149)",
      colors: ["black"],
      image_url: "https://cdn.runrepeat.com/black.jpg",
      source: "RunRepeat",
      source_id: 1986833,
    },
    {
      key: "white",
      name: "White (JR1912)",
      colors: ["white"],
      image_url: "https://cdn.runrepeat.com/white.jpg",
      source: "RunRepeat",
      source_id: 1999801,
    },
  ],
  offers: [
    {
      key: "a",
      variant_key: "black",
      retailer: "Black shop",
      price: 96,
      currency: "EUR",
      country: "DE",
      url: "https://example.com/black",
      snapshot: "2026-11-20",
      source: "RunRepeat",
      colorway: "Black",
    },
    {
      key: "b",
      variant_key: "white",
      retailer: "White shop",
      price: 106,
      currency: "EUR",
      country: "DE",
      url: "https://example.com/white",
      snapshot: "2026-11-20",
      source: "RunRepeat",
      colorway: "White",
    },
  ],
} as unknown as Shoe;
export const taxonomy = {
  categories: [
    { value: "running-shoes", label: "دویدن", count: 2 },
    { value: "sneakers", label: "روزمره", count: 1 },
  ],
  brands: [
    { value: "adidas", label: "adidas", count: 2 },
    { value: "Nike", label: "Nike", count: 2 },
  ],
  total: 4,
};
export const facets = {
  groups: { brand: taxonomy.brands, category: taxonomy.categories },
  count_mode: "disjunctive",
  price_basis: "USD",
};
