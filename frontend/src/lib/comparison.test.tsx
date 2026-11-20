import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { ComparisonProvider, useComparison } from "./comparison";
import { summaries } from "../test/fixtures";
function Harness() {
  const c = useComparison();
  return (
    <>
      <span data-testid="count">{c.items.length}</span>
      <span role="status">{c.message}</span>
      {[
        ...summaries,
        { ...summaries[0], shoe_id: 999, name: "Fifth shoe" },
      ].map((s) => (
        <button key={s.shoe_id} onClick={() => c.toggle(s)}>
          {s.name}
        </button>
      ))}
      <button onClick={() => c.remove(summaries[0].shoe_id)}>remove</button>
    </>
  );
}
describe("persistent bounded comparison", () => {
  beforeEach(() => localStorage.clear());
  it("adds up to four, gives feedback for the fifth and persists removal", () => {
    render(
      <ComparisonProvider>
        <Harness />
      </ComparisonProvider>,
    );
    summaries.forEach((s) =>
      fireEvent.click(screen.getByRole("button", { name: s.name })),
    );
    expect(screen.getByTestId("count")).toHaveTextContent("4");
    fireEvent.click(screen.getByRole("button", { name: "Fifth shoe" }));
    expect(screen.getByRole("status")).toHaveTextContent("حداکثر چهار");
    fireEvent.click(screen.getByRole("button", { name: "remove" }));
    expect(screen.getByTestId("count")).toHaveTextContent("3");
    expect(
      JSON.parse(localStorage.getItem("rad-compare") || "[]"),
    ).toHaveLength(3);
  });
  it("recovers from malformed local storage", () => {
    localStorage.setItem("rad-compare", "{broken");
    render(
      <ComparisonProvider>
        <Harness />
      </ComparisonProvider>,
    );
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});
