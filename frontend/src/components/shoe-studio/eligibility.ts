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
    !connection?.saveData
  );
}
