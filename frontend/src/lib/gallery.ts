import type { Shoe, Variant } from "./types";
import { label } from "./format";
export function colorwayLabel(variant: Variant) {
  const colors = variant.colors.map(label).join(" / ");
  const sku = variant.name.match(/\(([^)]+)\)/)?.[1];
  const original = variant.name.replace(/\s*\([^)]*\)/g, "").trim();
  const extra: Record<string, string> = {
    gris: "خاکستری",
    grå: "خاکستری",
    gray: "خاکستری",
    blanc: "سفید",
    noir: "مشکی",
  };
  return (
    (colors || extra[original.toLowerCase()] || original) +
    (sku ? ` · ${sku}` : "")
  );
}
function generalImages(shoe: Shoe): string[] {
  return [
    ...new Set(
      [shoe.summary.image_url, ...(shoe.media?.images || [])].filter(
        (v): v is string => Boolean(v),
      ),
    ),
  ];
}

function impactChart(src: string) {
  // The RunRepeat catalog includes the graph alongside lab photos and lists
  // both the resized and unversioned URLs for the same figure.
  return src.match(
    /^https:\/\/cdn\.runrepeat\.com\/storage\/gallery\/product_content\/\d+\/(.+-shock-absorption(?:-sa)?(?:-(heel|forefoot))?(?:-\d{1,2})?)(?:-\d{6,}(?:-\d+)?)?\.(?:jpe?g|png|webp)(?:[?#].*)?$/i,
  );
}

export function labChartImages(shoe: Shoe) {
  const charts = new Map<string, { src: string; title: string }>();
  for (const src of generalImages(shoe)) {
    const match = impactChart(src);
    if (!match || charts.has(match[1])) continue;
    const area =
      match[2] === "heel"
        ? " پاشنه"
        : match[2] === "forefoot"
          ? " جلوی پا"
          : "";
    charts.set(match[1], { src, title: `جذب ضربه${area}` });
  }
  return [...charts.values()];
}

export function galleryImages(shoe: Shoe, colorway?: string | null): string[] {
  if (colorway) {
    const variant = shoe.variants.find((v) => v.key === colorway);
    // Only explicitly mapped images belong to a colorway. Never borrow general photos.
    return variant?.image_url && !impactChart(variant.image_url)
      ? [variant.image_url]
      : [];
  }
  return generalImages(shoe).filter((src) => !impactChart(src));
}
