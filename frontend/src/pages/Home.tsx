import { Link, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpLeft, Layers3, ScanLine } from "lucide-react";
import { api } from "../lib/api";
import type { FeaturedShoe } from "../lib/types";
import { formatNumber } from "../lib/format";
import { FeaturedShowcase } from "../components/FeaturedShowcase";
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
      {error ? (
        <div className="home-load-error">
          <p>نمایش مدل‌های منتخب کامل نشد.</p>
          <button onClick={() => refetch()}>تلاش دوباره</button>
          <Link to="/shoes">ورود به کاتالوگ</Link>
        </div>
      ) : (
        <div id="featured">
          {data ? (
            <FeaturedShowcase shoes={shoes} />
          ) : (
            <div className="intro-loading" role="status">
              در حال بارگیری کفش‌های منتخب…
            </div>
          )}
        </div>
      )}
      <section
        className="home-main"
        id="home-content"
        tabIndex={-1}
        aria-labelledby="home-title"
      >
        <div className="home-main-heading">
          <h2 id="home-title">کفش مناسب مسیرت را پیدا کن.</h2>
          <p>مدل‌ها را بر اساس کاربرد، اندازه و ساختار مقایسه کن.</p>
          <Link to="/shoes" className="button">
            ورود به کاتالوگ <ArrowUpLeft size={18} />
          </Link>
        </div>
        <div className="home-previews">
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
              کاربری، فضای جلوی پا، وزن و حس فوم را انتخاب کن. پیشنهادها با
              قواعد روشن، از همین کاتالوگ می‌آیند.
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
        </div>
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
            {formatNumber(1167)}
            <small>مدل برای کشف کردن</small>
          </span>
        </section>
      </section>
    </div>
  );
}
