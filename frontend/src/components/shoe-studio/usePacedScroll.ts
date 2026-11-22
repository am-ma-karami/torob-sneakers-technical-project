import { useEffect, type RefObject } from "react";

// A typical mouse notch is 100–120 CSS pixels. Reserve the end of each
// chapter for the handoff after the full turn.
export const chapterDistance = 300;
export const rotationDistance = 234;

export function usePacedScroll(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  move: (pixels: number) => boolean,
) {
  useEffect(() => {
    const stage = root.current;
    if (!stage || !enabled) return;
    let lastWheel = -Infinity;
    let lastSign = 0;
    let peak = 0;
    let captured = false;
    let touch: { x: number; y: number; captured: boolean } | null = null;

    const atIntro = () => {
      const inset =
        parseFloat(getComputedStyle(stage).getPropertyValue("--intro-top")) ||
        0;
      const { top, bottom } = stage.getBoundingClientRect();
      return top >= inset - 10 && top <= inset + 55 && bottom > inset + 200;
    };
    const syncTouchArea = () =>
      stage.toggleAttribute("data-at-intro", atIntro());

    function wheel(event: WheelEvent) {
      if (
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        !atIntro()
      )
        return;
      const unit =
        event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? innerHeight : 1;
      const dy = event.deltaY * unit;
      const sign = Math.sign(dy);
      const gap = event.timeStamp - lastWheel;
      const newStroke = sign !== lastSign || gap > 110;
      const notch = event.deltaMode !== 0 || [100, 120].includes(Math.abs(dy));
      if (newStroke || notch) {
        peak = 0;
        captured = false;
      }
      lastWheel = event.timeStamp;
      lastSign = sign;
      const magnitude = Math.abs(dy);
      peak = Math.max(peak, magnitude);
      // DOM wheel events include trackpad momentum. Attenuate its declining tail,
      // while still accepting continuous input and resetting immediately on reversal.
      const gain = newStroke || notch ? 1 : Math.max(0.14, magnitude / peak);
      const limit =
        newStroke || notch ? 125 : Math.max(5, Math.min(125, gap * 1.15));
      if (move(sign * Math.min(magnitude * gain, limit))) captured = true;
      if (captured) event.preventDefault();
    }

    function touchStart(event: TouchEvent) {
      const point = event.touches[0];
      touch =
        event.touches.length === 1 && atIntro()
          ? { x: point.clientX, y: point.clientY, captured: false }
          : null;
    }

    function touchMove(event: TouchEvent) {
      if (!touch || event.touches.length !== 1) {
        touch = null;
        return;
      }
      const point = event.touches[0];
      const dy = touch.y - point.clientY;
      if (
        !touch.captured &&
        (Math.abs(dy) < 3 || Math.abs(dy) <= Math.abs(touch.x - point.clientX))
      )
        return;
      // Apply the travelled distance once. Lifting the finger ends the rotation.
      if (move(dy * 0.58)) touch.captured = true;
      touch.x = point.clientX;
      touch.y = point.clientY;
      if (touch.captured && event.cancelable) event.preventDefault();
    }
    const touchEnd = () => {
      touch = null;
    };

    function keyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !atIntro()
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input,select,textarea,[contenteditable]")
      )
        return;
      const space = event.key === " ";
      if (space && target instanceof HTMLElement && target.closest("button,a"))
        return;
      const down =
        ["ArrowDown", "PageDown"].includes(event.key) ||
        (space && !event.shiftKey);
      const up =
        ["ArrowUp", "PageUp"].includes(event.key) || (space && event.shiftKey);
      if ((down || up) && move(down ? 100 : -100)) event.preventDefault();
    }

    syncTouchArea();
    window.addEventListener("scroll", syncTouchArea, { passive: true });
    window.addEventListener("resize", syncTouchArea);
    window.addEventListener("wheel", wheel, { passive: false });
    stage.addEventListener("touchstart", touchStart, { passive: true });
    stage.addEventListener("touchmove", touchMove, { passive: false });
    stage.addEventListener("touchend", touchEnd);
    stage.addEventListener("touchcancel", touchEnd);
    window.addEventListener("keydown", keyDown);
    return () => {
      stage.removeAttribute("data-at-intro");
      window.removeEventListener("scroll", syncTouchArea);
      window.removeEventListener("resize", syncTouchArea);
      window.removeEventListener("wheel", wheel);
      stage.removeEventListener("touchstart", touchStart);
      stage.removeEventListener("touchmove", touchMove);
      stage.removeEventListener("touchend", touchEnd);
      stage.removeEventListener("touchcancel", touchEnd);
      window.removeEventListener("keydown", keyDown);
    };
  }, [root, enabled, move]);
}
