import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Admin } from "./Admin";

const identity = {
  username: "admin",
  csrf_token: "test-csrf",
  expires_at: "2027-01-01T00:00:00Z",
};
const result = {
  items: [
    {
      shoe_id: 40586,
      slug: "adidas-adizero-evo-sl",
      shoe_name: "adidas Adizero EVO SL",
      brand: "adidas",
      source: "ShoeStoreLinks",
      retailer_id: "amazon",
      retailer_name: "Amazon",
      market: "foreign",
      viewers: 10,
      clickers: 2,
      ctr: 20,
    },
  ],
  summary: { viewers: 10, clickers: 2, ctr: 20, active_pairs: 1 },
  total: 1,
  page: 1,
  page_size: 25,
  pages: 1,
  retailers: [{ retailer_id: "amazon", name: "Amazon" }],
  start_date: "2026-11-01",
  end_date: "2026-11-25",
};
const ok = (data: unknown, status = 200) => ({
  ok: true,
  status,
  json: async () => data,
});
const denied = () => ({
  ok: false,
  status: 401,
  json: async () => ({ error: { message: "وارد شوید" } }),
});
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Admin />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => vi.unstubAllGlobals());
describe("admin access and store funnel", () => {
  it("requires login, then shows unique counts and carries filters into the request", async () => {
    const user = userEvent.setup();
    let authenticated = false;
    const fetch = vi.fn(async (path: string) => {
      if (path.endsWith("/session"))
        return authenticated ? ok(identity) : denied();
      if (path.endsWith("/login")) {
        authenticated = true;
        return ok(identity);
      }
      if (path.includes("/analytics/stores")) return ok(result);
      return ok({}, 204);
    });
    vi.stubGlobal("fetch", fetch);
    show();
    await screen.findByRole("heading", { name: "ورود به پنل مدیریت" });
    expect(fetch.mock.calls.some(([path]) => path.includes("/analytics"))).toBe(
      false,
    );
    await user.type(screen.getByLabelText("نام کاربری"), "admin");
    await user.type(screen.getByLabelText("رمز عبور"), "test-only-password");
    await user.click(screen.getByRole("button", { name: "ورود به پنل" }));
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Amazon")).toBeVisible();
    expect(within(table).getByText("10")).toBeVisible();
    expect(within(table).getByText("2")).toBeVisible();
    expect(within(table).getByText("20 %")).toBeVisible();
    await user.type(
      screen.getByPlaceholderText("نام کفش، برند یا فروشگاه"),
      "Pegasus",
    );
    await user.selectOptions(screen.getByLabelText("بازار"), "foreign");
    await user.click(screen.getByRole("button", { name: "اعمال فیلترها" }));
    await waitFor(() =>
      expect(fetch.mock.calls.at(-1)?.[0]).toContain("q=Pegasus"),
    );
    expect(fetch.mock.calls.at(-1)?.[0]).toContain("market=foreign");
    expect(
      fetch.mock.calls.every(([path]) => !path.includes("test-only-password")),
    ).toBe(true);
  });
  it("sends CSRF on logout and removes private report content", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (path: string) =>
      path.endsWith("/session")
        ? ok(identity)
        : path.endsWith("/logout")
          ? ok({}, 204)
          : ok(result),
    );
    vi.stubGlobal("fetch", fetch);
    show();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "خروج" }));
    await screen.findByRole("heading", { name: "ورود به پنل مدیریت" });
    expect(screen.queryByText("Amazon")).not.toBeInTheDocument();
    const call = fetch.mock.calls.find(([path]) =>
      path.endsWith("/logout"),
    ) as unknown as [string, RequestInit];
    expect(call[1].headers).toEqual(
      expect.objectContaining({ "X-CSRF-Token": "test-csrf" }),
    );
  });
  it("returns to login when the session expires while fetching statistics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        path.endsWith("/session") ? ok(identity) : denied(),
      ),
    );
    show();
    await screen.findByRole("heading", { name: "ورود به پنل مدیریت" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
