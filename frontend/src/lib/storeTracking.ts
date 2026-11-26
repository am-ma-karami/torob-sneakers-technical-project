import { useEffect, type RefObject } from "react";

type Reference = { shoe_id: number; offer_key: string };
let pending = new Map<string, Reference>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
function flush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = undefined;
  const items = [...pending.values()];
  pending = new Map();
  for (let index = 0; index < items.length; index += 24) {
    void fetch("/api/analytics/store-impressions", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.slice(index, index + 24) }),
    }).catch(() => {
      /* Statistics never interrupt the shopping experience. */
    });
  }
}
function queue(reference: Reference) {
  pending.set(`${reference.shoe_id}:${reference.offer_key}`, reference);
  if (!flushTimer) flushTimer = setTimeout(flush, 100);
}

export function useStoreImpressions(
  root: RefObject<HTMLElement | null>,
  shoeId: number | undefined,
  contentKey: string,
) {
  useEffect(() => {
    if (
      !shoeId ||
      !root.current ||
      !window.IntersectionObserver ||
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl
    )
      return;
    const targets = new Map<
      Element,
      { visible: boolean; sent: boolean; timer?: ReturnType<typeof setTimeout> }
    >();
    function cancel(state: { timer?: ReturnType<typeof setTimeout> }) {
      if (state.timer) clearTimeout(state.timer);
      state.timer = undefined;
    }
    function schedule(target: Element) {
      const state = targets.get(target)!;
      cancel(state);
      if (
        !state.visible ||
        state.sent ||
        document.visibilityState !== "visible"
      )
        return;
      state.timer = setTimeout(() => {
        if (document.visibilityState !== "visible" || !state.visible) return;
        const key = target.getAttribute("data-offer-key");
        if (key) queue({ shoe_id: shoeId!, offer_key: key });
        state.sent = true;
        state.timer = undefined;
      }, 1000);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const state = targets.get(entry.target);
          if (!state) return;
          state.visible =
            entry.isIntersecting && entry.intersectionRatio >= 0.5;
          schedule(entry.target);
        });
      },
      { threshold: [0, 0.5] },
    );
    root.current.querySelectorAll("[data-offer-key]").forEach((target) => {
      targets.set(target, { visible: false, sent: false });
      observer.observe(target);
    });
    function visibility() {
      targets.forEach((_state, target) => schedule(target));
      if (document.visibilityState !== "visible") flush();
    }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", flush);
    return () => {
      observer.disconnect();
      targets.forEach(cancel);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [root, shoeId, contentKey]);
}
