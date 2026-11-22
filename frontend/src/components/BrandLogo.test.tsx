import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrandLogo, brandLogos } from "./BrandLogo";
describe("verified brand artwork", () => {
  it("keeps brand-to-file mapping exact and uses accessible originals", () => {
    render(<BrandLogo brand="Nike" />);
    expect(screen.getByRole("img", { name: "نشان Nike" })).toHaveAttribute(
      "src",
      "/media/brands/nike.svg",
    );
    expect(brandLogos["adidas"].src).not.toBe(brandLogos.Nike.src);
    expect(brandLogos.ASICS.src).toBe("/media/brands/asics.svg");
  });
  it("uses an honest text fallback for unmapped and failed logos", () => {
    const { rerender } = render(<BrandLogo brand="Unknown Brand" />);
    expect(screen.getByLabelText("نام برند Unknown Brand")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<BrandLogo brand="Nike" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByLabelText("نام برند Nike")).toBeVisible();
  });
});
