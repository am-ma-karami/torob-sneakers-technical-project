import { describe, expect, it } from "vitest";
import { buildFinderSearch } from "./finderSearch";
import type { FinderPrefs } from "./types";
const empty: FinderPrefs = { category: "", brands: [], weight_max: null, drop_max: null, width: "any", weight: "any", cushion: "any" };
describe("typed finder request", () => {
  it("keeps natural language separate and omits neutral fields", () => {
    expect(buildFinderSearch("  کفش نرم  ", empty)).toEqual({ q: "کفش نرم", hard_filters: {}, preferences: {}, mode: "auto", limit: 9 });
    expect(buildFinderSearch("", empty).q).toBe("");
  });
  it("sends mandatory numbers and soft preferences as different fields", () => {
    const request = buildFinderSearch("برای پیاده‌روی", { ...empty, category: "walking-shoes", brands: ["Nike", "ASICS"], weight_max: 250, drop_max: 0, width: "wide", cushion: "soft" });
    expect(request.q).toBe("برای پیاده‌روی");
    expect(request.hard_filters).toEqual({ category: ["walking-shoes"], brand: ["Nike", "ASICS"], weight_max: 250, drop_max: 0 });
    expect(request.preferences).toEqual({ width: "wide", cushion: "soft" });
    expect(buildFinderSearch("", { ...empty, brands: ["Nike"] }).q).toBe("");
  });
});
