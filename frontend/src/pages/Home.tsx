import { Link, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowUpLeft,
  Footprints,
  Layers3,
  MoveDown,
  ScanLine,
} from "lucide-react";
import { api } from "../lib/api";
import type { FeaturedShoe } from "../lib/types";
import { features } from "../lib/features";
import { fa, value } from "../lib/format";
import { FeaturedShowcase } from "../components/FeaturedShowcase";
import { ProductImage } from "../components/Shared";
export function Home() {
  const location = useLocation();
  const { data, error, refetch } = useQuery({
    queryKey: ["featured"],
    queryFn: ({ signal }) =>
      api<{ items: FeaturedShoe[] }>("/featured", signal),
    staleTime: 600000,
  });
  const shoes = data?.items || [],
    shoe = shoes[0];
  if (location.search)
    return <Navigate to={"/shoes" + location.search} replace />;
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="eyebrow">
              <span className="tiny-rule" /> از فرم تا احساس حرکت
            </span>
            <h1>
              هر قدم،
              <br />
              انتخابی از <em>جنس تو.</em>
            </h1>
            <p>
              کفش را از نزدیک بشناس. ساختار، اندازه‌ها و تفاوت‌ها را ببین و برای
              مسیر خودت انتخاب کن.
            </p>
            <div className="hero-actions">
              <Link to="/shoes" className="button">
                کشف کفش‌ها <ArrowUpLeft size={17} />
              </Link>
              <Link to="/finder" className="quiet-link">
                کفش مناسب من <Footprints size={17} />
              </Link>
            </div>
            <div className="hero-footnote">
              <span>۱٬۱۶۷ مدل</span>
              <span>هر مسیر، یک انتخاب</span>
              <span>بدون نیاز به ثبت‌نام</span>
            </div>
          </motion.div>
        </div>
        <div className={`hero-art ${features.depth ? "with-depth" : ""}`}>
          <span className="hero-orbit-line" />
          <span className="hero-editorial-word" dir="ltr">
            In motion.
          </span>
          <motion.div
            className="hero-photo-stage"
            initial={{ opacity: 0, scale: 0.96, rotate: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: features.depth ? -7 : 0,
              rotateY: features.depth ? -6 : 0,
            }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {shoe && (
              <ProductImage src={shoe.image_url} name={shoe.name} eager />
            )}
          </motion.div>
          <div className="hero-model-caption">
            <span className="eyebrow">{shoe?.brand || "RAD EDITIONS"}</span>
            <h2 dir="ltr">{shoe?.name || "The shape of your next step."}</h2>
            {shoe && (
              <div className="hero-mini-facts">
                <span>
                  <b dir="ltr">{value(shoe.weight_g, "g")}</b> وزن
                </span>
                <span>
                  <b dir="ltr">{value(shoe.drop_mm, "mm")}</b> دراپ
                </span>
              </div>
            )}
          </div>
          <span className="hero-coordinate" dir="ltr">
            FORM / FEEL / FORWARD
          </span>
        </div>
        <a href="#featured" className="hero-scroll-cue">
          <MoveDown size={18} /> چهار کفش، برای شروع شناخت
        </a>
      </section>
      {error ? (
        <div className="home-load-error">
          <p>نمایش مدل‌های منتخب کامل نشد.</p>
          <button onClick={() => refetch()}>تلاش دوباره</button>
          <Link to="/shoes">ورود به کاتالوگ</Link>
        </div>
      ) : (
        <div id="featured">
          <FeaturedShowcase shoes={shoes} />
        </div>
      )}
      <section className="home-previews">
        <div className="editorial-preview">
          <span className="eyebrow">
            <Layers3 size={16} /> آنچه درون یک کفش می‌گذرد
          </span>
          <h2>
            لایه‌ها را جدا کن.
            <br />
            تفاوت را لمس کن.
          </h2>
          <p>
            رویه، کفی، فوم و زیره را در یک نمای تعاملی بررسی کن. اندازه‌ها، هر
            کدام بخشی از داستان حرکت‌اند.
          </p>
          <Link
            className="editorial-link"
            to={`/shoes/${shoe?.slug || "adidas-adizero-evo-sl"}`}
          >
            کشف آناتومی کفش <ArrowUpLeft size={17} />
          </Link>
          <div className="preview-layer-lines" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="editorial-preview finder-preview">
          <span className="eyebrow">
            <ScanLine size={16} /> نقطه شروع، نیاز توست
          </span>
          <h2>
            برای مسیر تو،
            <br />
            چه کفشی مناسب‌تر است؟
          </h2>
          <p>
            کاربری، فضای جلوی پا، وزن و حس فوم را انتخاب کن. پیشنهادها با قواعد
            روشن، از همین کاتالوگ می‌آیند.
          </p>
          <Link className="editorial-link" to="/finder">
            پیدا کردن کفش من <ArrowUpLeft size={17} />
          </Link>
          <div className="preview-steps" aria-hidden="true">
            <span>قالب</span>
            <span>وزن</span>
            <span>حرکت</span>
          </div>
        </div>
      </section>
      <section className="home-closing">
        <span className="eyebrow">یک انتخاب آگاهانه</span>
        <h2>
          ظاهر، آغاز آشنایی است.
          <br />
          شناخت، از جزئیات شروع می‌شود.
        </h2>
        <Link to="/compare" className="quiet-link">
          کفش‌ها را کنار هم ببین <ArrowUpLeft size={18} />
        </Link>
        <span className="closing-total">
          {fa(1167)}
          <small>مدل برای کشف کردن</small>
        </span>
      </section>
    </div>
  );
}
