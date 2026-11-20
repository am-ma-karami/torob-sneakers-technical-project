import { Link } from "react-router-dom";
import { Check, Plus, ScanLine } from "lucide-react";
import { motion } from "motion/react";
import type { Summary } from "../lib/types";
import { ProductImage } from "./Shared";
import { useComparison } from "../lib/comparison";
import { fa, label, value } from "../lib/format";
export function ShoeCard({
  shoe: s,
  index = 0,
}: {
  shoe: Summary;
  index?: number;
}) {
  const { items, toggle } = useComparison();
  const selected = items.some((x) => x.shoe_id === s.shoe_id);
  return (
    <motion.article
      className={`shoe-card ${selected ? "is-selected" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.025 }}
    >
      <div className="card-image-wrap">
        <Link to={`/shoes/${s.slug}`} aria-label={`بررسی ${s.name}`}>
          <ProductImage
            src={s.catalog_image_url || s.image_url}
            name={s.name}
          />
        </Link>
        <button
          className={`compare-add ${selected ? "active" : ""}`}
          aria-label={`${selected ? "حذف" : "افزودن"} ${s.name} ${selected ? "از" : "به"} مقایسه`}
          aria-pressed={selected}
          onClick={() => toggle(s)}
        >
          {selected ? <Check size={17} /> : <Plus size={17} />}
        </button>
        {s.runrepeat_score != null && (
          <span className="card-score" title="امتیاز کلی از ۱۰۰">
            {fa(s.runrepeat_score)}
            <small>/ ۱۰۰</small>
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="card-meta">
          <Link to={`/shoes?brand=${encodeURIComponent(s.brand)}`} dir="ltr">
            {s.brand}
          </Link>
          <Link to={`/shoes?category=${encodeURIComponent(s.categories[0])}`}>
            {label(s.categories[0])}
          </Link>
        </div>
        <Link to={`/shoes/${s.slug}`} className="card-title" dir="ltr">
          {s.name}
        </Link>
        <div className="card-measurements">
          {s.weight_g != null && (
            <span>
              وزن <b dir="ltr">{value(s.weight_g, "g")}</b>
            </span>
          )}
          {s.drop_mm != null && (
            <span>
              دراپ <b dir="ltr">{value(s.drop_mm, "mm")}</b>
            </span>
          )}
        </div>
        <div className="card-footer">
          <span
            className={
              s.geometry_status === "profile_ready"
                ? "geometry-tag"
                : "geometry-tag sparse"
            }
          >
            <ScanLine size={12} />
            {s.geometry_status === "profile_ready"
              ? "هندسه + آناتومی"
              : "اندازه‌ها + آناتومی"}
          </span>
          {s.reference_price && (
            <span className="card-price">
              {fa(s.reference_price.amount_toman)} تومان<small>قیمت مرجع</small>
            </span>
          )}
        </div>
        <div className="card-colors">
          {(s.colors || []).slice(0, 5).map((c) => (
            <span key={c} title={label(c)} style={{ background: c }} />
          ))}
          <small>
            {s.variants_count ? `${fa(s.variants_count)} رنگ ثبت‌شده` : ""}
          </small>
        </div>
      </div>
    </motion.article>
  );
}
