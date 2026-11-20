export const features = {
  depth: import.meta.env.VITE_ENABLE_DEPTH !== "false",
  scrollShowcase: import.meta.env.VITE_ENABLE_SCROLL_SHOWCASE !== "false",
};
export function showcaseIndex(progress: number, count: number) {
  return count > 0
    ? Math.min(
        count - 1,
        Math.max(
          0,
          Math.floor((Number.isFinite(progress) ? progress : 0) * count),
        ),
      )
    : 0;
}
export function canPinShowcase(
  width: number,
  reduced: boolean,
  saveData = false,
  cores = 8,
) {
  return (
    features.scrollShowcase &&
    width >= 1024 &&
    !reduced &&
    !saveData &&
    cores > 2
  );
}
