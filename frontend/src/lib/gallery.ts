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
export function galleryImages(shoe: Shoe, colorway?: string | null): string[] {
  if (colorway) {
    const variant = shoe.variants.find((v) => v.key === colorway);
    // Only explicitly mapped images belong to a colorway. Never borrow general photos.
    return variant?.image_url ? [variant.image_url] : [];
  }
  const media = (shoe as Shoe & { media?: { images?: string[] } }).media;
  return [
    ...new Set(
      [shoe.summary.image_url, ...(media?.images || [])].filter(
        (v): v is string => Boolean(v),
      ),
    ),
  ];
}
