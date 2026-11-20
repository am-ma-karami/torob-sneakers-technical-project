import { afterEach, describe, expect, it, vi } from "vitest";
import { chapterStart, studioFrame } from "../components/shoe-studio/sequence";

afterEach(() => vi.unstubAllEnvs());

describe("3D scroll sequence", () => {
  it("targets each of the four chapters with the position controls", () => {
    for (let index = 0; index < 4; index++) {
      expect(studioFrame(chapterStart(index, 4), 4).active).toBe(index);
    }
  });

  it("turns a full revolution and tilts to display both upper and outsole", () => {
    const start = studioFrame(0, 4);
    const end = studioFrame(0.84 / 4, 4);
    expect(end.yaw - start.yaw).toBeCloseTo(2 * Math.PI);
    expect(studioFrame(0.27 / 4, 4).tilt).toBeGreaterThan(0.95);
    expect(studioFrame(0.57 / 4, 4).tilt).toBeLessThan(-0.66);
  });

  it("switches the product halfway through the handoff and keeps the final product visible", () => {
    expect(studioFrame(0.895 / 4, 4).active).toBe(0);
    expect(studioFrame(0.905 / 4, 4).active).toBe(1);
    expect(studioFrame(1, 4)).toMatchObject({
      index: 3,
      blend: 0,
      turn: 1,
      active: 3,
    });
  });

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
