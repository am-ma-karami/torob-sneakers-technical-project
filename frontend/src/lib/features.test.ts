import { afterEach, describe, expect, it, vi } from "vitest";
import { showcaseIndex, canPinShowcase } from "./features";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("bounded showcase and independent fallbacks", () => {
  it("clamps progress at both ends and only crosses four product boundaries", () => {
    expect(
      [-1, 0, 0.24, 0.25, 0.5, 0.75, 1, 2, NaN].map((p) => showcaseIndex(p, 4)),
    ).toEqual([0, 0, 0, 1, 2, 3, 3, 3, 0]);
  });
  it("uses native flow for mobile, reduced motion, save-data and low power", () => {
    expect(canPinShowcase(1440, false)).toBe(true);
    expect(canPinShowcase(390, false)).toBe(false);
    expect(canPinShowcase(1440, true)).toBe(false);
    expect(canPinShowcase(1440, false, true)).toBe(false);
    expect(canPinShowcase(1440, false, false, 2)).toBe(false);
  });
  it("disables depth independently from scrolling and vice versa", async () => {
    vi.stubEnv("VITE_ENABLE_DEPTH", "false");
    vi.resetModules();
    let module = await import("./features");
    expect(module.features.depth).toBe(false);
    expect(module.features.scrollShowcase).toBe(true);
    vi.stubEnv("VITE_ENABLE_DEPTH", "true");
    vi.stubEnv("VITE_ENABLE_SCROLL_SHOWCASE", "false");
    vi.resetModules();
    module = await import("./features");
    expect(module.features.depth).toBe(true);
    expect(module.canPinShowcase(1440, false)).toBe(false);
  });
});
