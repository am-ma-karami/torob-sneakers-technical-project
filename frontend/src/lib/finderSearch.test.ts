import { describe, expect, it } from "vitest";
import { buildFinderSearch } from "./finderSearch";
import type { FinderPrefs } from "./types";

const empty: FinderPrefs = { category: "", brands: [], weight_max: null, drop_max: null, width: "any", weight: "any", cushion: "any" };
describe("combined finder search", () => {
  it("keeps unset filters empty and accepts text alone", () => {
    expect(buildFinderSearch("  کفش نرم  ", empty)).toEqual({ q: "کفش نرم", filters: {}, limit: 9 });
    expect(buildFinderSearch("", empty).q).toBe("");
  });
  it("appends selected fields without losing text, brands or numeric zero", () => {
    const request = buildFinderSearch("برای پیاده‌روی", { ...empty, category: "walking-shoes", brands: ["Nike", "ASICS"], weight_max: 250, drop_max: 0, width: "wide", cushion: "soft" });
    expect(request.q.startsWith("برای پیاده‌روی\n")).toBe(true);
    expect(request.q).toContain("Nike، ASICS");
    expect(request.q).toContain("حداکثر دراپ: 0");
    expect(request.q).toContain("نرم‌تر");
    expect(request.q).not.toContain("ترجیح وزن");
    expect(request.filters).toEqual({ category: ["walking-shoes"], brand: ["Nike", "ASICS"], weight_max: 250, drop_max: 0 });
    expect(buildFinderSearch("", { ...empty, brands: ["Nike"] }).q).toContain("Nike");
  });
});
