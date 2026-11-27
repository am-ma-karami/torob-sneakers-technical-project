import type { FinderPrefs } from "./types";
import { label } from "./format";

export function buildFinderSearch(text: string, prefs: FinderPrefs) {
  const parts: string[] = [];
  const filters: Record<string, unknown> = {};
  if (prefs.category) { parts.push(`نوع استفاده: ${label(prefs.category)}`); filters.category = [prefs.category]; }
  if (prefs.brands.length) { parts.push(`برندهای انتخابی: ${prefs.brands.join("، ")}`); filters.brand = prefs.brands; }
  if (prefs.weight_max !== null) { parts.push(`حداکثر وزن: ${prefs.weight_max} گرم`); filters.weight_max = prefs.weight_max; }
  if (prefs.drop_max !== null) { parts.push(`حداکثر دراپ: ${prefs.drop_max} میلی‌متر`); filters.drop_max = prefs.drop_max; }
  if (prefs.width !== "any") parts.push(`ترجیح فضای جلوی پا: ${prefs.width === "wide" ? "جادار" : "متوسط"}`);
  if (prefs.weight !== "any") parts.push(`ترجیح وزن: ${prefs.weight === "light" ? "سبک، تا 250 گرم" : "متعادل، 250 تا 320 گرم"}`);
  if (prefs.cushion !== "any") parts.push(`ترجیح حس فوم: ${prefs.cushion === "soft" ? "نرم‌تر" : "سفت‌تر"}`);
  return { q: [text.trim(), ...parts].filter(Boolean).join("\n"), filters, limit: 9 };
}

