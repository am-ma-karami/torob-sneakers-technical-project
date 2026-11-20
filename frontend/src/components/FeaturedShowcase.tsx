import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { FeaturedShoe } from "../lib/types";
import { fa, value } from "../lib/format";
import mediaCatalog from "../lib/featuredMedia.json";
import { allowStudio, modeledShoeIds } from "./shoe-studio/eligibility";
import { chapterStart, studioFrame } from "./shoe-studio/sequence";
import "./shoe-studio/intro.css";

const media = mediaCatalog as Record<number, (typeof mediaCatalog)["40586"]>;

function ProductPoster({
  shoe,
  eager,
}: {
  shoe: FeaturedShoe;
  eager: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const image = media[shoe.shoe_id];
  return image && !failed ? (
    <img
      src={image.src}
      srcSet={`${image.small} 640w, ${image.src} 1200w`}
      sizes="(max-width: 700px) 94vw, 65vw"
      width="1200"
      height="570"
      alt={shoe.name}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="intro-missing" dir="ltr">
      {shoe.name}
    </span>
  );
}

function ProductInfo({
  shoe,
  modeled,
}: {
  shoe: FeaturedShoe;
  modeled: boolean;
}) {
  const image = media[shoe.shoe_id];
  const specs = [
    { data: shoe.weight_g, label: "وزن", unit: "g" },
    { data: shoe.heel_stack_mm, label: "پاشنه", unit: "mm" },
    { data: shoe.drop_mm, label: "دراپ", unit: "mm" },
  ];
  return (
    <div className="intro-product-info" aria-live="polite" aria-atomic="true">
      <h2 dir="ltr">{shoe.name}</h2>
      <dl>
        {specs
          .filter(({ data }) => data != null)
          .map(({ data, label, unit }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd dir="ltr">{value(data, unit)}</dd>
            </div>
          ))}
      </dl>
      <div className="intro-product-footer">
        <Link
          className="quiet-link"
          to={`/shoes/${shoe.slug}${image ? `?colorway=${image.variant_key}` : ""}`}
        >
          جزئیات کفش <ArrowUpLeft size={15} />
        </Link>
        {modeled && <span>بازسازی تقریبی سه‌بعدی</span>}
      </div>
    </div>
  );
}

const faCount = (index: number, total: number) =>
  `${fa(index + 1)} از ${fa(total)}`;

export function FeaturedShowcase({ shoes }: { shoes: FeaturedShoe[] }) {
  const root = useRef<HTMLElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [allowed, setAllowed] = useState(allowStudio);
  const [status, setStatus] = useState<"pending" | "live" | "fallback">(
    "pending",
  );
  const [active, setActive] = useState(0);
  const idKey = shoes.map((shoe) => shoe.shoe_id).join(",");
  const tried =
    allowed &&
    shoes.length > 0 &&
    shoes.every((shoe) => modeledShoeIds.includes(shoe.shoe_id));
  const live = tried && status === "live";
  const flow = !tried || status === "fallback";
  const shoe = shoes[Math.min(active, shoes.length - 1)];

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setAllowed(allowStudio());
      setStatus("pending");
      setActive(0);
    };
    motion.addEventListener("change", change);
    return () => motion.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const element = root.current,
      stage = sticky.current,
      display = canvas.current;
    if (!tried || !element || !stage || !display) return;
    let destroyed = false;
    let frame = 0;
    let preload = 0;
    let dispose: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    let schedule: (() => void) | undefined;
    let previous = -1;
    let progress = -1;
    const ids = idKey.split(",").map(Number);
    const failed = () => {
      if (!destroyed) setStatus("fallback");
    };
    const lost = (event: Event) => {
      event.preventDefault();
      removeListeners();
      dispose?.();
      dispose = undefined;
      failed();
    };
    function removeListeners() {
      cancelAnimationFrame(frame);
      window.clearTimeout(preload);
      if (schedule) {
        window.removeEventListener("scroll", schedule);
        document.removeEventListener("visibilitychange", schedule);
      }
      observer?.disconnect();
      display?.removeEventListener("webglcontextlost", lost);
    }
    import("./shoe-studio/scene")
      .then(({ createShoeScene }) => {
        if (destroyed) return;
        const scene = createShoeScene(display, ids);
        dispose = scene.dispose;
        scene.draw(0);
        setStatus("live");
        const tick = () => {
          frame = 0;
          if (destroyed || document.hidden) return;
          const { top } = element.getBoundingClientRect();
          const stageRect = stage.getBoundingClientRect();
          if (stageRect.bottom <= 0 || stageRect.top >= window.innerHeight)
            return;
          const distance = Math.max(
            1,
            element.offsetHeight - stage.offsetHeight,
          );
          const inset = parseFloat(getComputedStyle(stage).top) || 0;
          const next = Math.min(1, Math.max(0, (inset - top) / distance));
          const selected = studioFrame(next, ids.length).active;
          if (selected !== previous) {
            previous = selected;
            setActive(selected);
          }
          if (progress !== next) {
            progress = next;
            try {
              scene.draw(next);
            } catch {
              removeListeners();
              dispose?.();
              dispose = undefined;
              failed();
            }
          }
        };
        schedule = () => {
          if (!frame) frame = requestAnimationFrame(tick);
        };
        observer = new ResizeObserver(() => {
          progress = -1;
          schedule?.();
        });
        observer.observe(element);
        observer.observe(display);
        window.addEventListener("scroll", schedule, { passive: true });
        document.addEventListener("visibilitychange", schedule);
        display.addEventListener("webglcontextlost", lost);
        // Prepare the next geometry between paints, then shortly ahead of its chapter.
        let warm = 1;
        const prepareNext = () => {
          if (document.hidden) {
            preload = window.setTimeout(prepareNext, 750);
            return;
          }
          scene.prepare(warm++);
          if (warm < ids.length) preload = window.setTimeout(prepareNext, 220);
        };
        if (ids.length > 1) preload = window.setTimeout(prepareNext, 180);
        schedule();
      })
      .catch(() => {
        removeListeners();
        dispose?.();
        dispose = undefined;
        failed();
      });
    return () => {
      destroyed = true;
      removeListeners();
      dispose?.();
    };
  }, [tried, idKey]);

  function select(index: number) {
    const element = root.current,
      stage = sticky.current;
    if (!element || !stage) return;
    const inset = parseFloat(getComputedStyle(stage).top) || 0;
    const offset = element.getBoundingClientRect().top + window.scrollY - inset;
    const distance = element.offsetHeight - stage.offsetHeight;
    window.scrollTo({
      top: offset + chapterStart(index, shoes.length) * distance,
      behavior: "instant",
    });
  }

  if (!shoe) return null;
  return (
    <section
      ref={root}
      className={`shoe-intro ${live ? "is-live" : ""} ${flow ? "is-flow" : ""}`}
      style={{ "--intro-count": shoes.length } as React.CSSProperties}
      aria-label="معرفی کفش‌های منتخب"
      data-renderer={live ? "webgl" : "catalog-photo"}
    >
      <div ref={sticky} className="intro-sticky">
        <div className="intro-top">
          <h1>هر کفش، از هر زاویه</h1>
          <a
            className="intro-skip"
            href="#home-content"
            onClick={(event) => {
              const target = document.getElementById("home-content");
              if (!target) return;
              event.preventDefault();
              target.focus({ preventScroll: true });
              target.scrollIntoView({ block: "start", behavior: "instant" });
            }}
          >
            رفتن به صفحهٔ اصلی <ArrowDown size={16} />
          </a>
        </div>
        {flow ? (
          <div className="intro-flow">
            {shoes.map((item, index) => (
              <article
                className="intro-chapter"
                key={item.shoe_id}
                data-shoe-id={item.shoe_id}
              >
                <div className="intro-poster">
                  <ProductPoster shoe={item} eager={index === 0} />
                </div>
                <ProductInfo shoe={item} modeled={false} />
              </article>
            ))}
          </div>
        ) : (
          <>
            <article
              className="intro-chapter intro-live-chapter"
              data-shoe-id={shoe.shoe_id}
              data-active-index={active}
            >
              <div className="intro-visual">
                {!live && (
                  <div className="intro-poster">
                    <ProductPoster shoe={shoe} eager />
                  </div>
                )}
                <canvas
                  ref={canvas}
                  className="intro-canvas"
                  aria-hidden="true"
                />
              </div>
              <ProductInfo shoe={shoe} modeled={live} />
            </article>
            <div className="intro-bottom">
              <div
                className="intro-progress"
                aria-label={faCount(active, shoes.length)}
              >
                <button
                  type="button"
                  className="icon-button"
                  aria-label="کفش منتخب قبلی"
                  disabled={!live || active === 0}
                  onClick={() => select(active - 1)}
                >
                  <ChevronRight size={18} />
                </button>
                {shoes.map((item, index) => (
                  <button
                    type="button"
                    className="intro-position"
                    key={item.shoe_id}
                    disabled={!live}
                    aria-label={`نمایش ${item.name}`}
                    aria-pressed={index === active}
                    onClick={() => select(index)}
                  >
                    <span />
                    {fa(index + 1)}
                  </button>
                ))}
                <button
                  type="button"
                  className="icon-button"
                  aria-label="کفش منتخب بعدی"
                  disabled={!live || active === shoes.length - 1}
                  onClick={() => select(active + 1)}
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
              <p>
                <ArrowDown size={16} /> برای چرخاندن کفش اسکرول کن
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
