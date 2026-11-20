import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, ScanLine } from "lucide-react";
import type { FeaturedShoe } from "../lib/types";
import { canPinShowcase, features, showcaseIndex } from "../lib/features";
import { fa, label, value } from "../lib/format";
import { ProductImage } from "./Shared";
const editorial = [
  {
    title: "سبکی را احساس کن.",
    copy: "وزن، ارتفاع و جنس فوم را کنار هم ببین؛ جزئیاتی که تجربه هر قدم را شکل می‌دهند.",
    accent: "#C7A67A",
  },
  {
    title: "برای مسیر هر روز.",
    copy: "یک مدل آشنا را از زاویه‌ای تازه بشناس؛ از ساختار زیره تا فضای جلوی پا.",
    accent: "#8EAED1",
  },
  {
    title: "فضا برای حرکت.",
    copy: "بلندی زیره و اختلاف ارتفاع، زبان هندسه یک کفش‌اند. اندازه‌ها را با نیاز خودت بسنج.",
    accent: "#A8B9A0",
  },
  {
    title: "ریتم خودت را پیدا کن.",
    copy: "به وزن، انعطاف و فوم دقت کن. عددها نقطه شروع شناختن تجربه حرکت‌اند.",
    accent: "#C09C9B",
  },
];
function Specimen({
  shoe,
  index,
  active = false,
}: {
  shoe: FeaturedShoe;
  index: number;
  active?: boolean;
}) {
  const e = editorial[index % 4];
  return (
    <article
      className={`featured-specimen ${active ? "is-active" : ""}`}
      style={{ "--shoe-accent": e.accent } as React.CSSProperties}
    >
      <div className="specimen-copy">
        <span className="eyebrow">
          {label(shoe.categories[0])} / انتخاب راد
        </span>
        <h3>{e.title}</h3>
        <p>{e.copy}</p>
        <Link className="editorial-link" to={`/shoes/${shoe.slug}`}>
          شناخت این کفش <ChevronLeft size={16} />
        </Link>
      </div>
      <div className={`specimen-stage ${features.depth ? "with-depth" : ""}`}>
        <span className="specimen-halo" />
        <ProductImage src={shoe.image_url} name={shoe.name} />
        <span className="specimen-shadow" />
      </div>
      <div className="specimen-facts">
        <span className="edition-label">{fa(index + 1)} / ۰۴</span>
        <h4 dir="ltr">{shoe.name}</h4>
        <dl>
          {[
            [shoe.weight_g, "وزن", "g"],
            [shoe.heel_stack_mm, "ارتفاع پاشنه", "mm"],
            [shoe.drop_mm, "اختلاف ارتفاع", "mm"],
            [shoe.foam, "فوم", ""],
          ]
            .filter(([v]) => v != null)
            .map(([v, title, unit]) => (
              <div key={String(title)}>
                <dt>{title}</dt>
                <dd dir="auto">{value(v, String(unit))}</dd>
              </div>
            ))}
        </dl>
      </div>
    </article>
  );
}
export function FeaturedShowcase({ shoes }: { shoes: FeaturedShoe[] }) {
  const root = useRef<HTMLElement>(null),
    pin = useRef<HTMLDivElement>(null),
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
      className={`featured-showcase ${pinned ? "is-pinned" : "is-flow"}`}
      ref={root}
      aria-label="چهار کفش منتخب"
    >
      <div ref={pin} className="showcase-pin">
        <div className="showcase-heading">
          <div>
            <span className="eyebrow">
              <ScanLine size={15} /> چهار مدل، چهار نگاه به حرکت
            </span>
            <h2>کفش‌ها، از نزدیک.</h2>
          </div>
          <Link to="/shoes" className="quiet-link">
            رفتن به کاتالوگ <ChevronLeft size={14} />
          </Link>
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
                  key={shoes[active].shoe_id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.35 }}
                >
                  <Specimen shoe={shoes[active]} index={active} active />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="showcase-controls">
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
              <span className="showcase-hint">با پیمایش یا دکمه‌ها کشف کن</span>
            </div>
          </>
        ) : (
          <div className="featured-flow">
            {shoes.map((shoe, i) => (
              <Specimen key={shoe.shoe_id} shoe={shoe} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
