// Keep the manifest outside the lazy WebGL chunk.
export const modeledShoeIds = [40586, 40390, 41349, 40830];

export function allowStudio() {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean };
    }
  ).connection;
  return (
    import.meta.env.VITE_ENABLE_3D_INTRO !== "false" &&
    import.meta.env.VITE_ENABLE_SCROLL_SHOWCASE !== "false" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !connection?.saveData &&
    (navigator.hardwareConcurrency || 8) > 2
  );
}
