export const facetKeys = [
  "brand",
  "category",
  "activity",
  "family",
  "color",
  "terrain",
  "arch",
  "width",
  "fit",
  "plate",
  "foam",
  "upper",
  "geometry",
  "year",
] as const;
export const numericKeys = [
  "weight_min",
  "weight_max",
  "price_min",
  "price_max",
  "score_min",
  "drop_min",
  "drop_max",
  "heel_min",
  "heel_max",
  "forefoot_min",
  "forefoot_max",
  "internal_width_min",
  "internal_width_max",
] as const;
const allowed = new Set<string>([
  ...facetKeys,
  ...numericKeys,
  "q",
  "sort",
  "page",
  "page_size",
]);
export function apiParams(params: URLSearchParams) {
  const clean = new URLSearchParams();
  params.forEach((v, k) => {
    if (allowed.has(k)) clean.append(k, v);
  });
  return clean.toString();
}
export function toggleFacet(
  params: URLSearchParams,
  key: string,
  value: string,
) {
  const next = new URLSearchParams(params);
  const values = next.getAll(key);
  next.delete(key);
  for (const v of values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value])
    next.append(key, v);
  next.delete("page");
  return next;
}
export const facetTitles: Record<string, string> = {
  brand: "برند",
  category: "دسته‌بندی",
  activity: "کاربری",
  family: "خانواده مدل",
  color: "رنگ تأییدشده",
  terrain: "مسیر",
  arch: "حمایت قوس",
  width: "عرض‌های اعلام‌شده",
  fit: "بازخورد قالب",
  plate: "صفحه تقویتی",
  foam: "نوع فوم",
  upper: "جنس رویه",
  geometry: "پوشش هندسه",
  year: "سال عرضه",
  q: "جستجو",
  weight_min: "حداقل وزن",
  weight_max: "حداکثر وزن",
  price_min: "محدودیت قیمت مرجع قدیمی",
  price_max: "محدودیت قیمت مرجع قدیمی",
  score_min: "حداقل امتیاز",
  drop_min: "حداقل دراپ",
  drop_max: "حداکثر دراپ",
  heel_min: "حداقل ارتفاع پاشنه",
  heel_max: "حداکثر ارتفاع پاشنه",
  forefoot_min: "حداقل ارتفاع پنجه",
  forefoot_max: "حداکثر ارتفاع پنجه",
  internal_width_min: "حداقل عرض داخلی",
  internal_width_max: "حداکثر عرض داخلی",
};
