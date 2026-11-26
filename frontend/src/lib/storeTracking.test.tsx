import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStoreImpressions } from "./storeTracking";

let observed: IntersectionObserverCallback;
let element: Element;
const key = "a".repeat(64);
function Example() {
  const root = useRef<HTMLElement>(null);
  useStoreImpressions(root, 40586, key);
  return (
    <section ref={root}>
      <div data-offer-key={key}>store</div>
    </section>
  );
}
function visibility(ratio: number) {
  act(() =>
    observed(
      [
        {
          target: element,
          isIntersecting: ratio > 0,
          intersectionRatio: ratio,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observed = callback;
      }
      observe(target: Element) {
        element = target;
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("qualified store impressions", () => {
  it("requires at least half of the row for one continuous visible second", () => {
    render(<Example />);
    visibility(0.49);
    act(() => vi.advanceTimersByTime(2000));
    expect(fetch).not.toHaveBeenCalled();
    visibility(0.5);
    act(() => vi.advanceTimersByTime(999));
    expect(fetch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(101));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/store-impressions",
      expect.objectContaining({
        keepalive: true,
        body: JSON.stringify({ items: [{ shoe_id: 40586, offer_key: key }] }),
      }),
    );
    visibility(0.8);
    act(() => vi.advanceTimersByTime(2000));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("cancels a short impression and pauses while the tab is hidden", () => {
    render(<Example />);
    visibility(0.8);
    act(() => vi.advanceTimersByTime(500));
    visibility(0);
    act(() => vi.advanceTimersByTime(2000));
    expect(fetch).not.toHaveBeenCalled();
    visibility(0.8);
    act(() => vi.advanceTimersByTime(500));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(2000));
    expect(fetch).not.toHaveBeenCalled();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(1100));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
