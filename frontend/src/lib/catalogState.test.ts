import { describe, expect, it } from "vitest";
import { apiParams, toggleFacet } from "./catalogState";
describe("shareable catalog state", () => {
  it("restores repeated facets and preserves ordering while excluding foreign parameters", () => {
    const params = new URLSearchParams(
      "brand=Nike&brand=adidas&page=2&sort=weight&color=black&secret=no",
    );
    expect(apiParams(params)).toBe(
      "brand=Nike&brand=adidas&page=2&sort=weight&color=black",
    );
  });
  it("keeps OR selections and resets pagination without destroying other groups", () => {
    const initial = new URLSearchParams(
      "brand=Nike&category=running-shoes&page=4",
    );
    const next = toggleFacet(initial, "brand", "adidas");
    expect(next.getAll("brand")).toEqual(["Nike", "adidas"]);
    expect(next.get("category")).toBe("running-shoes");
    expect(next.has("page")).toBe(false);
    expect(toggleFacet(next, "brand", "Nike").getAll("brand")).toEqual([
      "adidas",
    ]);
    expect(initial.get("page")).toBe("4");
  });
});
