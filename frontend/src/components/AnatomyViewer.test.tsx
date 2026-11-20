import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AnatomyViewer } from "./AnatomyViewer";
import { anatomyData } from "../lib/anatomy";
import { shoe } from "../test/fixtures";
describe("measured anatomy", () => {
  it("selects useful layers by keyboard and renders genuinely distinct exploded shapes", async () => {
    const user = userEvent.setup();
    const { container } = render(<AnatomyViewer shoe={shoe} />);
    const layer = screen.getByRole("button", { name: "انتخاب کفی داخلی" });
    layer.focus();
    await user.keyboard("{Enter}");
    expect(layer).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2.4 mm")).toBeVisible();
    expect(screen.getByTestId("insole-band")).toHaveAttribute(
      "data-thickness-mm",
      "2.4",
    );
    fireEvent.click(screen.getByRole("button", { name: "لایه‌های جدا" }));
    const shapes = Array.from(
      container.querySelectorAll(".exploded-layer>path"),
    ).map((p) => p.getAttribute("d"));
    expect(new Set(shapes).size).toBeGreaterThan(2);
    fireEvent.click(screen.getByRole("button", { name: "فضای داخلی" }));
    expect(screen.getByTestId("fit-outline")).toBeVisible();
  });
  it("hides unmeasured modes/layers and never fills missing fields", () => {
    const sparse = {
      ...shoe,
      summary: {
        ...shoe.summary,
        heel_stack_mm: null,
        forefoot_stack_mm: null,
        plate: null,
        foam: null,
        upper_material: null,
        outsole_material: null,
        removable_insole: null,
      },
      metrics: {},
    };
    const { container } = render(<AnatomyViewer shoe={sparse} />);
    expect(container).toBeEmptyDOMElement();
    expect(sparse.summary.heel_stack_mm).toBeNull();
    expect(anatomyData(sparse).modes).toEqual([]);
  });
  it("keeps a useful profile while hiding construction when only stack data exists", () => {
    const minimal = {
      ...shoe,
      summary: {
        ...shoe.summary,
        plate: null,
        foam: null,
        upper_material: null,
        outsole_material: null,
        removable_insole: null,
      },
      metrics: {
        heel_stack_mm: shoe.metrics.heel_stack_mm,
        forefoot_stack_mm: shoe.metrics.forefoot_stack_mm,
      },
    };
    expect(anatomyData(minimal).modes).toEqual(["profile"]);
    render(<AnatomyViewer shoe={minimal} />);
    expect(screen.getByTestId("sole-profile")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "ساختار کامل" }),
    ).not.toBeInTheDocument();
  });
  it("can reassemble verified material layers without inventing missing stack dimensions", () => {
    const partial = {
      ...shoe,
      summary: {
        ...shoe.summary,
        heel_stack_mm: null,
        forefoot_stack_mm: null,
        upper_material: "Mesh",
        foam: "Lightstrike Pro",
        outsole_material: null,
        plate: null,
        removable_insole: null,
      },
      metrics: {},
    };
    expect(anatomyData(partial).modes).toEqual(["assembled", "exploded"]);
    const { container } = render(<AnatomyViewer shoe={partial} />);
    fireEvent.click(screen.getByRole("button", { name: "لایه‌های جدا" }));
    fireEvent.click(screen.getByRole("button", { name: "مونتاژ دوباره" }));
    expect(screen.getByRole("button", { name: "ساختار کامل" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.queryByRole("button", { name: "نمای جانبی" }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll(".inspector-metric")).toHaveLength(0);
    expect(partial.summary.heel_stack_mm).toBeNull();
  });
  it("binds stack, rocker and fit geometry to measurements rather than only replacing labels", () => {
    const { rerender } = render(
      <AnatomyViewer shoe={shoe} initialMode="profile" />,
    );
    const before = screen.getByTestId("sole-profile").getAttribute("d");
    const changed = {
      ...shoe,
      summary: { ...shoe.summary, heel_stack_mm: 20, forefoot_stack_mm: 15 },
    };
    rerender(<AnatomyViewer shoe={changed} initialMode="profile" />);
    expect(screen.getByTestId("sole-profile").getAttribute("d")).not.toBe(
      before,
    );
    expect(anatomyData(changed).ground - anatomyData(changed).heelY).toBe(40);
    fireEvent.click(screen.getByRole("button", { name: "فضای داخلی" }));
    const originalFit = screen.getByTestId("fit-outline").getAttribute("d");
    rerender(
      <AnatomyViewer
        shoe={{
          ...shoe,
          metrics: {
            ...shoe.metrics,
            interior_forefoot_width_mm: {
              ...shoe.metrics.interior_forefoot_width_mm,
              value: 110,
            },
          },
        }}
        initialMode="profile"
      />,
    );
    expect(screen.getByTestId("fit-outline").getAttribute("d")).not.toBe(
      originalFit,
    );
  });
  it("omits missing rocker dimensions and unknown plates while keeping measured stacks", () => {
    const sparse = {
      ...shoe,
      summary: {
        ...shoe.summary,
        toe_rocker_pct: null,
        toe_tip_height_mm: null,
        plate: null,
      },
    };
    const { container } = render(
      <AnatomyViewer shoe={sparse} initialMode="profile" />,
    );
    expect(
      container.querySelector("[data-measurement=toe_rocker_pct]"),
    ).toBeNull();
    expect(
      container.querySelector("[data-measurement=heel_stack_mm]"),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "ساختار کامل" }));
    expect(
      screen.queryByRole("button", { name: "انتخاب صفحه تقویتی" }),
    ).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ثبت نشده|نامشخص|اسکن یا CAD/);
  });
});
