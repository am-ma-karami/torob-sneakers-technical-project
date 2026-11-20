import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MotionConfig } from "motion/react";
import { AnatomyViewer } from "./AnatomyViewer";
import { shoe } from "../test/fixtures";
describe("measured anatomy", () => {
  it("keeps layer selection and mode changes usable with reduced motion", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <AnatomyViewer shoe={shoe} />
      </MotionConfig>,
    );
    const layer = screen.getByRole("button", { name: "انتخاب کفی داخلی" });
    fireEvent.keyDown(layer, { key: "Enter" });
    expect(layer).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2.4 mm")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "لایه‌های جدا" }));
    expect(
      screen.getByRole("button", { name: "لایه‌های جدا" }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(
        container.querySelector(".shoe-layer")?.getAttribute("style"),
      ).toContain("translateY"),
    );
    fireEvent.click(screen.getByRole("button", { name: "فضای داخلی" }));
    expect(screen.getByText("فضای شست")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "بازنشانی ساختار" }));
    expect(screen.getByRole("button", { name: "ساختار کامل" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("does not invent a rocker or plate for sparse data", () => {
    const sparse = {
      ...shoe,
      summary: {
        ...shoe.summary,
        toe_rocker_pct: null,
        toe_tip_height_mm: null,
        plate: null,
      },
    };
    render(<AnatomyViewer shoe={sparse} initialMode="profile" />);
    expect(
      screen.getByText("داده راکر ثبت نشده؛ فقط مقطع ساده ابعاد"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "انتخاب صفحه تقویتی" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/اطلاعات نامشخص/)).toBeVisible();
  });
  it("changes measured paths across shoes and supports Space layer selection", () => {
    const { container, rerender } = render(
      <AnatomyViewer shoe={shoe} initialMode="profile" />,
    );
    const before = container
      .querySelector("svg[aria-label] path")
      ?.getAttribute("d");
    rerender(
      <AnatomyViewer
        shoe={{
          ...shoe,
          summary: {
            ...shoe.summary,
            heel_stack_mm: 20,
            forefoot_stack_mm: 15,
          },
        }}
        initialMode="profile"
      />,
    );
    expect(
      container.querySelector("svg[aria-label] path")?.getAttribute("d"),
    ).not.toEqual(before);
    fireEvent.click(screen.getByRole("button", { name: "ساختار کامل" }));
    const layer = screen.getByRole("button", { name: "انتخاب رویه" });
    fireEvent.keyDown(layer, { key: " " });
    expect(layer).toHaveAttribute("aria-pressed", "true");
  });
});
