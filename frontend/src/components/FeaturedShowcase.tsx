import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { OrbitStage } from "./shoe-studio/OrbitStage";
import {
  ArrowDown,
  ArrowUpLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { FeaturedShoe } from "../lib/types";
import { formatNumber, value } from "../lib/format";
import mediaCatalog from "../lib/featuredMedia.json";
import photoAlbums from "./shoe-studio/photos.json";
import { allowStudio } from "./shoe-studio/eligibility";
import {
  usePacedScroll,
  chapterDistance,
  rotationDistance,
} from "./shoe-studio/usePacedScroll";
import "./shoe-studio/intro.css";

const media = mediaCatalog as Record<number, (typeof mediaCatalog)["40586"]>;
const albums: Record<number, { model: string; shots: { src: string }[] }> =
  photoAlbums;

function Poster({ shoe, eager }: { shoe: FeaturedShoe; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  const src =
    albums[shoe.shoe_id]?.shots[0]?.src ?? media[shoe.shoe_id]?.source_image;
  return src && !failed ? (
    <img
      src={src}
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

function ProductInfo({ shoe }: { shoe: FeaturedShoe }) {
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
      </div>
    </div>
  );
}

export function FeaturedShowcase({ shoes }: { shoes: FeaturedShoe[] }) {
  const root = useRef<HTMLElement>(null);
  const [allowed, setAllowed] = useState(allowStudio);
  const [distance, setDistance] = useState(0);
  const position = useRef(0);
  const live =
    allowed &&
    shoes.length > 0 &&
    shoes.every(({ shoe_id }) => albums[shoe_id]?.model);
  const last = shoes.length - 1;
  const end = last * chapterDistance + rotationDistance;
  const chapter = Math.min(Math.floor(distance / chapterDistance), last);
  const local = distance - chapter * chapterDistance;
  const angle = Math.min(1, local / rotationDistance);
  const handoff =
    chapter < last
      ? Math.max(
          0,
          (local - rotationDistance) / (chapterDistance - rotationDistance),
        )
      : 0;
  const index = handoff >= 0.5 ? chapter + 1 : chapter;
  const shoe = shoes[index];
  const album = albums[shoes[chapter]?.shoe_id];
  const nextAlbum = albums[shoes[chapter + 1]?.shoe_id];

  const seek = useCallback((to: number) => {
    position.current = to;
    setDistance(to);
  }, []);
  const move = useCallback(
    (pixels: number) => {
      const next = Math.min(end, Math.max(0, position.current + pixels));
      if (position.current === next) return false;
      seek(next);
      return true;
    },
    [end, seek],
  );
  usePacedScroll(root, live, move);
  const fallback = useCallback(() => setAllowed(false), []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      seek(0);
      setAllowed(allowStudio());
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, [seek]);

  function choose(next: number) {
    seek(next * chapterDistance);
  }

  function showHomepage() {
    const target = document.getElementById("home-content");
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: "instant" });
  }

  if (!shoe) return null;
  return (
    <section
      ref={root}
      className={`shoe-intro ${live ? "is-live" : "is-flow"}`}
      aria-label="معرفی کفش‌های منتخب"
      data-renderer={live ? "photo-textured-3d" : "catalog-photo"}
      data-distance={distance}
      data-finished={distance === end}
    >
      <div className="intro-sticky">
        <div className="intro-top">
          <h1>کفش‌ها از نزدیک</h1>
          <a
            className="intro-skip"
            href="#home-content"
            onClick={(event) => {
              if (document.getElementById("home-content")) {
                event.preventDefault();
                showHomepage();
              }
            }}
          >
            رفتن به صفحهٔ اصلی <ArrowDown size={16} />
          </a>
        </div>
        {live && album ? (
          <>
            <article
              className="intro-chapter intro-live-chapter"
              data-shoe-id={shoe.shoe_id}
              data-active-index={index}
            >
              <div className="intro-visual">
                <OrbitStage
                  model={album.model}
                  next={nextAlbum?.model}
                  angle={angle}
                  handoff={handoff}
                  poster={albums[shoe.shoe_id].shots[0].src}
                  name={shoe.name}
                  onFailure={fallback}
                />
              </div>
              <ProductInfo shoe={shoe} />
            </article>
            <div className="intro-bottom">
              <div
                className="intro-progress"
                aria-label={`${formatNumber(index + 1)} از ${formatNumber(shoes.length)}`}
              >
                <button
                  type="button"
                  className="icon-button"
                  aria-label="کفش منتخب قبلی"
                  disabled={index === 0}
                  onClick={() => choose(index - 1)}
                >
                  <ChevronRight size={18} />
                </button>
                {shoes.map((item, i) => (
                  <button
                    type="button"
                    className="intro-position"
                    key={item.shoe_id}
                    aria-label={`نمایش ${item.name}`}
                    aria-pressed={i === index}
                    onClick={() => choose(i)}
                  >
                    <span />
                    {formatNumber(i + 1)}
                  </button>
                ))}
                <button
                  type="button"
                  className="icon-button"
                  aria-label={
                    index === last ? "ادامه به صفحهٔ اصلی" : "کفش منتخب بعدی"
                  }
                  onClick={() =>
                    index === last ? showHomepage() : choose(index + 1)
                  }
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
              <p>
                <ArrowDown size={16} aria-hidden="true" />
                {distance === end
                  ? "برای ورود به صفحهٔ اصلی اسکرول کن"
                  : "با اسکرول، کفش را 360 درجه بچرخان"}
              </p>
            </div>
          </>
        ) : (
          <div className="intro-flow">
            {shoes.map((item, i) => (
              <article
                className="intro-chapter"
                key={item.shoe_id}
                data-shoe-id={item.shoe_id}
              >
                <div className="intro-poster">
                  <Poster shoe={item} eager={i === 0} />
                </div>
                <ProductInfo shoe={item} />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
