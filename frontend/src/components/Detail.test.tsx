import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DetailContent } from "../pages/Detail";
import { ComparisonProvider } from "../lib/comparison";
import { shoe } from "../test/fixtures";
import { galleryImages } from "../lib/gallery";
import type { Shoe } from "../lib/types";
function show(product: Shoe = shoe, url = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["scores", product.slug], {
    rows: [],
    category: product.summary.categories[0],
  });
  client.setQueryData(["store-offers", product.slug, "all", 1], {
    items: [],
    total: 0,
    page: 1,
    page_size: 6,
    pages: 0,
    market_counts: {},
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <ComparisonProvider>
          <DetailContent shoe={product} />
        </ComparisonProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("verified galleries and quiet product presentation", () => {
  it("changes main image and thumbnails together without stale retailer offers", () => {
    const { container } = show();
    fireEvent.click(screen.getByRole("button", { name: "رنگ مشکی · JP7149" }));
    expect(container.querySelector(".main-product-image img")).toHaveAttribute(
      "src",
      "https://cdn.runrepeat.com/black.jpg",
    );
    expect(container.querySelectorAll(".photo-thumbnails button")).toHaveLength(
      1,
    );
    expect(container.querySelector(".photo-thumbnails img")).toHaveAttribute(
      "src",
      "https://cdn.runrepeat.com/black.jpg",
    );
    expect(screen.queryByText("Black shop")).not.toBeInTheDocument();
    expect(screen.queryByText("White shop")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /RunRepeat|SoleHunt|ShoeGeometry|MSRP|USD|ثبت نشده/,
    );
  });
  it("paginates general thumbnails instead of requesting the whole archive at once", () => {
    const product = {
      ...shoe,
      media: {
        images: Array.from(
          { length: 30 },
          (_, i) => `https://example.com/photo-${i}.jpg`,
        ),
      },
    };
    const { container } = show(product);
    expect(container.querySelectorAll(".photo-thumbnails img")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "تصاویر کوچک بعدی" }));
    expect(container.querySelectorAll(".photo-thumbnails img")).toHaveLength(7);
    expect(container.querySelector(".photo-thumbnails img")).toHaveAttribute(
      "src",
      "https://example.com/photo-6.jpg",
    );
  });
  it("keeps the lab chart separate from both the general and color galleries", () => {
    const base =
      "https://cdn.runrepeat.com/storage/gallery/product_content/40586/adidas-adizero-evo-sl-";
    const chart = base + "shock-absorption-heel-23147094-720.jpg";
    const labPhoto = base + "energy-return-23147095-720.jpg";
    const product = {
      ...shoe,
      media: {
        images: [chart, labPhoto, base + "shock-absorption-heel.jpg"],
      },
    };
    const { container } = show(product);
    const charts = screen.getByRole("region", { name: "نمودارهای آزمایشگاهی" });
    expect(charts.querySelectorAll("img")).toHaveLength(1);
    expect(charts.querySelector("a")).toHaveAttribute("href", chart);
    expect(galleryImages(product)).toContain(labPhoto);
    expect(galleryImages(product)).not.toContain(chart);
    expect(
      container.querySelector(".gallery img[src*='shock-absorption']"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "رنگ مشکی · JP7149" }));
    expect(charts.querySelector("img")).toHaveAttribute("src", chart);
  });
  it("restores colorway URLs and keeps unmapped images out of color views", () => {
    const { container } = show(shoe, "/?colorway=white");
    expect(
      screen.getByRole("button", { name: "رنگ سفید · JR1912" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".main-product-image img")).toHaveAttribute(
      "src",
      "https://cdn.runrepeat.com/white.jpg",
    );
    expect(
      galleryImages(
        { ...shoe, variants: [{ ...shoe.variants[0], image_url: null }] },
        "black",
      ),
    ).toEqual([]);
    expect(galleryImages(shoe, "nonexistent")).toEqual([]);
  });
  it("shows stored Persian reviews and only an explicit toman reference", () => {
    show({
      ...shoe,
      reviews_fa: { pros: ["وزن کم"], cons: ["کیفیت پایین بندها"] },
      reference_price: {
        amount_toman: 10500000,
        kind: "converted_msrp_reference",
        original_amount: 150,
        original_currency: "USD",
        rate_toman_per_usd: 70000,
        rate_at: "2026-11-20T00:00:00Z",
      },
    });
    expect(screen.getByText("وزن کم")).toBeVisible();
    expect(screen.getByText("کیفیت پایین بندها")).toBeVisible();
    expect(screen.getByText(/10,500,000 تومان/)).toBeVisible();
    expect(screen.getByText("قیمت مرجع تبدیل‌شده")).toBeVisible();
  });
});
