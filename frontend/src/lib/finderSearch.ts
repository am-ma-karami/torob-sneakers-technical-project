import type { FinderPrefs } from "./types";

export function buildFinderSearch(text: string, prefs: FinderPrefs) {
  const hard_filters: Record<string, unknown> = {};
  const preferences: Record<string, unknown> = {};
  if (prefs.category) hard_filters.category = [prefs.category];
  if (prefs.brands.length) hard_filters.brand = prefs.brands;
  if (prefs.weight_max !== null) hard_filters.weight_max = prefs.weight_max;
  if (prefs.drop_max !== null) hard_filters.drop_max = prefs.drop_max;
  if (prefs.width !== "any") preferences.width = prefs.width;
  if (prefs.weight !== "any") preferences.weight = prefs.weight;
  if (prefs.cushion !== "any") preferences.cushion = prefs.cushion;
  return { q: text.trim(), hard_filters, preferences, mode: "auto", limit: 9 };
}
