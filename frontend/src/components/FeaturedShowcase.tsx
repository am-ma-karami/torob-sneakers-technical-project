import { useEffect, useRef, useState, type Ref } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, ArrowUpLeft } from "lucide-react";
import type { FeaturedShoe } from "../lib/types";
import {
  canPinShowcase,
  features,
  showcaseIndex,
  showcasePhase,
} from "../lib/features";
import { fa, value } from "../lib/format";
import rawMedia from "../lib/featuredMedia.json";
type Media = {
  src: string;
  small: string;
  variant_key: string;
  shoe_id: number;
  slug: string;
  name: string;
  kind: string;
  model_url: null;
};
export const featuredMedia: Record<number, Media> = rawMedia;
const editorial = [
  {
    title: "سبکی، در هر قدم.",
    copy: "فوم Lightstrike Pro و ساختاری سبک؛ برای شناختن تفاوت فرم و احساس حرکت.",
    accent: "#B8CDDF",
  },
  {
    title: "همراهِ مسیر هر روز.",
    copy: "ترکیب ReactX و Air Zoom؛ یک نگاه نزدیک به جزئیات مدل آشنای پگاسوس.",
    accent: "#B9BDC9",
  },
  {
    title: "فضا برای حرکت.",
    copy: "ارتفاع زیره، فضای داخلی و حس فوم را کنار هم ببین؛ انتخاب از همین تفاوت‌ها شروع می‌شود.",
    accent: "#D8C9B6",
  },
  {
    title: "ریتم را عوض کن.",
    copy: "فوم PWRRUN PB و انحنای SPEEDROLL؛ جزئیات کفشی برای سرعت‌های مختلف.",
    accent: "#C6D899",
  },
];
function FloatingShoe({
  shoe,
  eager = false,
  onReady,
}: {
  shoe: FeaturedShoe;
  eager?: boolean;
  onReady?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const media = featuredMedia[shoe.shoe_id];
  return !media || broken ? (
    <div className="studio-image-fallback">{shoe.name}</div>
  ) : (
    <img
      src={media.src}
      srcSet={`${media.small} 640w, ${media.src} 1200w`}
      sizes="(max-width:700px) 90vw, (max-width:1023px) 65vw, 55vw"
      width="1200"
      height="570"
      alt={shoe.name}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      onLoad={onReady}
      onError={() => setBroken(true)}
    />
  );
}
function Specimen({
  shoe,
  index,
  driftRef,
  eager = false,
}: {
  shoe: FeaturedShoe;
  index: number;
  driftRef?: Ref<HTMLDivElement>;
  eager?: boolean;
}) {
  const e = editorial[index % 4],
    media = featuredMedia[shoe.shoe_id];
  return (
    <article
      className="featured-specimen studio-chapter"
      style={{ "--shoe-accent": e.accent } as React.CSSProperties}
      data-shoe-id={shoe.shoe_id}
      data-renderer="catalog-photo"
    >
      <div className="studio-stage" aria-label={`نمای محصول ${shoe.name}`}>
        <div className="studio-light" aria-hidden="true" />
        <div className="studio-contact-shadow" aria-hidden="true" />
        <div className="studio-drift" ref={driftRef}>
          <div className="studio-product">
            <FloatingShoe key={shoe.shoe_id} shoe={shoe} eager={eager} />
          </div>
        </div>
      </div>
      <div className="studio-copy">
        <span className="studio-brand" dir="ltr">
          {shoe.brand}
        </span>
        <h2 className="studio-model" dir="ltr">
          {shoe.name}
        </h2>
        <h3>{e.title}</h3>
        <p>{e.copy}</p>
        <dl className="studio-specs">
          {[
            [shoe.weight_g, "وزن", "g"],
            [shoe.heel_stack_mm, "پاشنه", "mm"],
            [shoe.drop_mm, "دراپ", "mm"],
          ]
            .filter(([v]) => v != null)
            .map(([v, title, unit]) => (
              <div key={String(title)}>
                <dt>{title}</dt>
                <dd dir="ltr">{value(v, String(unit))}</dd>
              </div>
            ))}
        </dl>
        <div className="studio-actions">
          <Link to="/shoes" className="button">
            کشف کفش‌ها <ArrowUpLeft size={17} />
          </Link>
          <Link
            className="quiet-link"
            to={`/shoes/${shoe.slug}${media ? `?colorway=${media.variant_key}` : ""}`}
          >
            جزئیات این مدل <ChevronLeft size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function FeaturedShowcase({ shoes }: { shoes: FeaturedShoe[] }) {
  const root = useRef<HTMLElement>(null),
    pin = useRef<HTMLDivElement>(null),
    drift = useRef<HTMLDivElement>(null),
    trigger = useRef<{ start: number; end: number } | null>(null),
    activeRef = useRef(0);
  const [active, setActive] = useState(0),
    [pinned, setPinned] = useState(false),
    reduce = useReducedMotion();
  const [wide, setWide] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const change = () => setWide(q.matches);
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!pinned) return;
    let frame = 0;
    let cancelled = false;
    import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
      if (!cancelled)
        frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [pinned]);
  useEffect(() => {
    let cancelled = false;
    let revert: (() => void) | undefined;
    if (!shoes.length) return;
    const saveData = !!(
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection?.saveData;
    if (
      !canPinShowcase(
        window.innerWidth,
        !!reduce,
        saveData,
        navigator.hardwareConcurrency || 8,
      )
    ) {
      setPinned(false);
      return;
    }
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled || !root.current || !pin.current) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add(
          "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          () => {
            setPinned(true);
            const instance = ScrollTrigger.create({
              id: "rad-featured-showcase",
              trigger: root.current,
              start: "top top+=84",
              end: "+=1200",
              pin: pin.current,
              pinSpacing: true,
              anticipatePin: 1,
              onUpdate: (self) => {
                const phase = showcasePhase(self.progress, shoes.length);
                if (drift.current)
                  gsap.set(drift.current, {
                    x: (phase - 0.5) * 38,
                    y: Math.sin(phase * Math.PI) * -14,
                    rotation: features.depth ? (phase - 0.5) * 7 : 0,
                  });
                const next = showcaseIndex(self.progress, shoes.length);
                if (next !== activeRef.current) {
                  activeRef.current = next;
                  setActive(next);
                }
              },
            });
            trigger.current = instance;
            const refresh = () => {
              if (!cancelled) ScrollTrigger.refresh();
            };
            const images = Array.from(
              root.current?.querySelectorAll("img") || [],
            );
            images.forEach((image) =>
              image.addEventListener("load", refresh, { once: true }),
            );
            document.fonts.ready.then(refresh);
            return () => {
              images.forEach((image) =>
                image.removeEventListener("load", refresh),
              );
              trigger.current = null;
              setPinned(false);
              instance.kill(true);
            };
          },
          root,
        );
        revert = () => media.revert();
      },
    );
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [shoes, reduce, wide]);
  const select = (next: number) => {
    next = Math.max(0, Math.min(shoes.length - 1, next));
    const t = trigger.current;
    if (t) {
      window.scrollTo({
        top: t.start + ((next + 0.5) / shoes.length) * (t.end - t.start),
        behavior: "instant",
      });
    } else {
      activeRef.current = next;
      setActive(next);
    }
  };
  if (!shoes.length) return null;
  return (
    <section
      ref={root}
      className={`featured-showcase studio-opening ${pinned ? "is-pinned" : "is-flow"}`}
      aria-label="چهار کفش منتخب"
      style={
        {
          "--active-accent": editorial[active % 4].accent,
        } as React.CSSProperties
      }
    >
      <div className="showcase-pin studio-pin" ref={pin}>
        <div className="studio-heading">
          <span className="eyebrow">راد / نگاهی نزدیک‌تر به کفش</span>
          <h1>فرمِ حرکت را کشف کن.</h1>
          <p>کفش را ببین، جزئیاتش را بشناس، برای مسیر خودت انتخاب کن.</p>
        </div>
        {pinned ? (
          <>
            <div
              className="showcase-live"
              data-active-index={active}
              aria-live="polite"
              aria-atomic="true"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  className="studio-presence"
                  key={shoes[active].shoe_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: reduce ? 0 : 0.34 }}
                >
                  <Specimen
                    shoe={shoes[active]}
                    index={active}
                    driftRef={drift}
                    eager
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="showcase-controls studio-controls">
              <button
                className="icon-button"
                aria-label="کفش منتخب قبلی"
                disabled={active === 0}
                onClick={() => select(active - 1)}
              >
                <ChevronRight size={18} />
              </button>
              <div className="showcase-positions">
                {shoes.map((shoe, i) => (
                  <button
                    key={shoe.shoe_id}
                    aria-label={`نمایش ${shoe.name}`}
                    aria-pressed={active === i}
                    onClick={() => select(i)}
                  >
                    <span />
                    {fa(i + 1)}
                  </button>
                ))}
              </div>
              <button
                className="icon-button"
                aria-label="کفش منتخب بعدی"
                disabled={active === shoes.length - 1}
                onClick={() => select(active + 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <Link to="/shoes" className="studio-skip">
                رفتن به کاتالوگ <ChevronLeft size={14} />
              </Link>
            </div>
          </>
        ) : (
          <div className="featured-flow studio-flow">
            {shoes.map((shoe, i) => (
              <Specimen
                shoe={shoe}
                index={i}
                key={shoe.shoe_id}
                eager={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
