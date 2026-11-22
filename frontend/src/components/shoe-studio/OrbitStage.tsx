import { useEffect, useRef, useState, useLayoutEffect } from "react";
import type { createOrbit } from "./orbit";
type Props = {
  model: string;
  next?: string;
  poster: string;
  name: string;
  angle: number;
  handoff: number;
  onFailure: () => void;
};

export function OrbitStage({
  model,
  next,
  poster,
  name,
  angle,
  handoff,
  onFailure,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<ReturnType<typeof createOrbit> | null>(
    null,
  );
  const [ready, setReady] = useState("");
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let mounted = true;
    let orbit: ReturnType<typeof createOrbit> | undefined;
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    surface.addEventListener("webglcontextlost", lost);
    import("./orbit")
      .then(({ createOrbit }) => {
        if (!mounted) return;
        orbit = createOrbit(surface);
        setEngine(orbit);
      })
      .catch(() => {
        if (mounted) onFailure();
      });
    return () => {
      mounted = false;
      surface.removeEventListener("webglcontextlost", lost);
      orbit?.dispose();
    };
  }, [onFailure]);

  useEffect(() => {
    if (!engine) return;
    let current = true;
    engine
      .show(model, next)
      .then(() => {
        if (current) setReady(model);
      })
      .catch(() => {
        if (current) onFailure();
      });
    return () => {
      current = false;
    };
  }, [engine, model, next, onFailure]);

  useLayoutEffect(() => {
    engine?.pose(angle, handoff);
  }, [engine, angle, handoff]);

  return (
    <div className="intro-orbit" data-ready={ready === model}>
      <img src={poster} alt="" aria-hidden="true" />
      <canvas ref={canvas} role="img" aria-label={`نمای سه‌بعدی ${name}`} />
    </div>
  );
}
