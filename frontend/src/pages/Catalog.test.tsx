import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Catalog } from "./Catalog";
import { ComparisonProvider } from "../lib/comparison";
import { facets, shoe, summaries, taxonomy } from "../test/fixtures";
function Location() {
  return <output data-testid="url">{useLocation().search}</output>;
}
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input, "http://test");
    let data: unknown = {};
    if (url.pathname === "/api/catalog")
      data = { items: summaries, total: 4, page: 1, page_size: 18, pages: 1 };
    if (url.pathname === "/api/facets") data = facets;
    if (url.pathname === "/api/taxonomy") data = taxonomy;
    if (url.pathname.startsWith("/api/shoes/")) data = shoe;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});
function mount(initial = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <ComparisonProvider>
          <Catalog />
          <Location />
        </ComparisonProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("reactive catalog", () => {
  it("restores URL search/sort state, debounces search and passes an AbortSignal", async () => {
    mount("/?q=Nike&sort=weight");
    const search = screen.getByRole("searchbox");
    expect(search).toHaveValue("Nike");
    expect(screen.getByRole("combobox", { name: "مرتب‌سازی" })).toHaveValue(
      "weight",
    );
    fireEvent.change(search, { target: { value: "adidas" } });
    await waitFor(
      () => expect(screen.getByTestId("url")).toHaveTextContent("q=adidas"),
      { timeout: 1500 },
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          String(url).includes("/catalog?") &&
          String(url).includes("q=adidas") &&
          options.signal instanceof AbortSignal,
      ),
    ).toBe(true);
  });
  it("updates facets and chips in the URL, and resets them", async () => {
    mount();
    await screen.findByRole("link", { name: `بررسی ${summaries[0].name}` });
    const filter = screen.getByRole("complementary");
    fireEvent.click(within(filter).getByRole("checkbox", { name: /Nike/ }));
    await waitFor(() =>
      expect(screen.getByTestId("url")).toHaveTextContent("brand=Nike"),
    );
    expect(
      screen.getByRole("button", { name: "حذف برند: Nike" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "پاک کردن همه" }));
    expect(screen.getByTestId("url")).toHaveTextContent("");
  });
  it("offers a retry on API failures", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: "offline" } }), {
          status: 503,
        }),
    );
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ارتباط با کاتالوگ برقرار نشد",
    );
    expect(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "تلاش دوباره",
      }),
    ).toBeVisible();
  });
});
