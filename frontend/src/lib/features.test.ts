import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("introduction switch", () => {
  it("leaves anatomy depth enabled when the introduction is switched off", async () => {
    vi.stubEnv("VITE_ENABLE_3D_INTRO", "false");
    vi.stubEnv("VITE_ENABLE_DEPTH", "true");
    vi.resetModules();
    const { features } = await import("./features");
    const { allowStudio } =
      await import("../components/shoe-studio/eligibility");
    expect(allowStudio()).toBe(false);
    expect(features.depth).toBe(true);
  });
});
