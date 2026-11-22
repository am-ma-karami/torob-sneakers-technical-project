import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoreOffers } from "./StoreOffers";
import type { Offer, StoreOffersResult } from "../lib/types";

const domestic: Offer = {
  key: "iran-1",
  variant_key: null,
  retailer: "فروشگاه ایرانی",
  market: "iran",
  price: 38990000,
  currency: "IRT",
  country: "IR",
  price_toman: 38990000,
  url: "https://digizenith.ir/product/evo/",
  source: "ShoeStoreLinks",
  colorway: null,
  snapshot: "2026-11-20T19:00:00Z",
  checked_at: "2026-11-20T19:00:00Z",
  availability: "unknown",
  conversion: { kind: "native_toman", rate_toman_per_unit: "1", stale: false },
};
const foreign: Offer = {
  ...domestic,
  key: "foreign-1",
  retailer: "Amazon",
  market: "foreign",
  price: 99.95,
  currency: "USD",
  price_toman: 26724131,
  url: "https://www.amazon.com/dp/example",
  country: "US",
  conversion: {
    kind: "free_market",
    rate_toman_per_unit: "267375",
    source: "TGJU · بازار آزاد",
    source_url: "https://www.tgju.org/profile/price_dollar_rl",
    source_time_label: "۱ آذر",
    fetched_at: "2026-11-23T00:00:00Z",
    stale: false,
  },
};
function result(
  items: Offer[],
  extra: Partial<StoreOffersResult> = {},
): StoreOffersResult {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 6,
    pages: 1,
    market_counts: { iran: 1, foreign: 1 },
    ...extra,
  };
}
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StoreOffers slug="adidas-adizero-evo-sl" />
    </QueryClientProvider>,
  );
}
afterEach(() => vi.unstubAllGlobals());

describe("store prices in toman", () => {
  it("shows native and converted prices, original amount, source and rate time", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => result([domestic, foreign]),
        }),
    );
    show();
    expect(await screen.findByText("38,990,000")).toBeVisible();
    expect(screen.getByText("26,724,131")).toBeVisible();
    expect(screen.getByText(/99.95 دلار آمریکا/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "TGJU · بازار آزاد" }),
    ).toHaveAttribute("href", foreign.conversion!.source_url);
    expect(screen.getByText(/دریافت نرخ:/)).toBeVisible();
    expect(screen.getByText(/زمان اعلام منبع: 1 آذر/)).toBeVisible();
    const link = screen.getByRole("link", { name: "مشاهده در Amazon" });
    expect(link).toHaveAttribute("href", foreign.url);
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.queryByText("موجود در آخرین بررسی")).not.toBeInTheDocument();
  });
  it("filters markets and resets pagination without mixing results", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (path: string) => ({
      ok: true,
      json: async () => {
        const query = new URL(path, "https://example.com").searchParams;
        return query.get("market") === "iran"
          ? result([domestic])
          : result([foreign], {
              pages: 2,
              total: 7,
              page: Number(query.get("page")),
            });
      },
    }));
    vi.stubGlobal("fetch", fetch);
    show();
    await screen.findByText("Amazon");
    await user.click(screen.getByRole("button", { name: "بعدی" }));
    await waitFor(() =>
      expect(fetch.mock.calls.at(-1)?.[0]).toContain("page=2"),
    );
    await user.click(
      within(screen.getByRole("group", { name: "بازار فروشگاه" })).getByRole(
        "button",
        { name: /^ایران/ },
      ),
    );
    await screen.findByText("فروشگاه ایرانی");
    expect(fetch.mock.calls.at(-1)?.[0]).toContain("market=iran");
    expect(fetch.mock.calls.at(-1)?.[0]).toContain("page=1");
    expect(screen.queryByText("Amazon")).not.toBeInTheDocument();
  });
  it("keeps missing prices unknown and exposes a retry after failure", async () => {
    const user = userEvent.setup();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValue({
        ok: true,
        json: async () =>
          result([
            {
              ...domestic,
              price: null,
              currency: null,
              price_toman: null,
              conversion: null,
            },
          ]),
      });
    vi.stubGlobal("fetch", fetch);
    show();
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(await screen.findByText("قیمت نامشخص")).toBeVisible();
    expect(screen.queryByText("0 تومان")).not.toBeInTheDocument();
  });
});
