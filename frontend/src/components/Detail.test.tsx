import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DetailContent } from "../pages/Detail";
import { ComparisonProvider } from "../lib/comparison";
import { shoe } from "../test/fixtures";
describe("verified product variants", () => {
  it("changes the corresponding image and limits offers to the selected colorway", async () => {
    render(
      <MemoryRouter>
        <ComparisonProvider>
          <DetailContent shoe={shoe} />
        </ComparisonProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Black shop")).toBeVisible();
    expect(screen.getByText("White shop")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "رنگ Black (JP7149)" }));
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: shoe.summary.name }),
      ).toHaveAttribute("src", "https://cdn.runrepeat.com/black.jpg"),
    );
    expect(screen.getByText("Black shop")).toBeVisible();
    expect(screen.queryByText("White shop")).not.toBeInTheDocument();
  });
  it("restores a colorway from the URL and has an honest unknown-color fallback", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/?colorway=white"]}>
        <ComparisonProvider>
          <DetailContent shoe={shoe} />
        </ComparisonProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "رنگ White (JR1912)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Black shop")).not.toBeInTheDocument();
    unmount();
    render(
      <MemoryRouter>
        <ComparisonProvider>
          <DetailContent shoe={{ ...shoe, variants: [] }} />
        </ComparisonProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/رنگ تأییدشده ثبت نشده/)).toBeVisible();
  });
});
