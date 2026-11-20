import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Plus,
  ExternalLink,
  Info,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react";
import { api } from "../lib/api";
import type { Shoe } from "../lib/types";
import { fa, label, metricGroups, origins, value } from "../lib/format";
import { SourceScores } from "../components/SourceScores";
import { MetricGauges } from "../components/MetricGauges";
import { AnatomyViewer } from "../components/AnatomyViewer";
import {
  Breadcrumb,
  ErrorState,
  Loading,
  ProductImage,
} from "../components/Shared";
import { useComparison } from "../lib/comparison";

export function Detail() {
  const { slug } = useParams();
  const query = useQuery({
    queryKey: ["shoe", slug],
    queryFn: ({ signal }) => api<Shoe>(`/shoes/${slug}`, signal),
  });
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  return <DetailContent key={query.data.shoe_id} shoe={query.data} />;
}
export function DetailContent({ shoe }: { shoe: Shoe }) {
  const [params, setParams] = useSearchParams();
  const [photo, setPhoto] = useState<string | null>(null);
  const selected = shoe.variants.find((v) => v.key === params.get("colorway"));
  const { items, toggle } = useComparison();
  const included = items.some((x) => x.shoe_id === shoe.shoe_id);
  const s = shoe.summary;
  useEffect(() => {
    document.title = `${s.name} | راد`;
  }, [s.name]);
  const offers = shoe.offers.filter(
    (o) => !selected || o.variant_key === selected.key,
  );
  const images =
    (shoe as unknown as { media?: { images: string[] } }).media?.images?.slice(
      0,
      5,
    ) || [];
  const image = photo || selected?.image_url || s.image_url;
  return (
    <>
      <Breadcrumb name={s.name} category={s.categories[0]} />
      <div className="product-overview">
        <div className="product-photo-panel">
          <div className="photo-caption">
            <span>{s.brand}</span>
            <span className="tag">{label(s.categories[0])}</span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="main-product-image"
              key={image}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <ProductImage key={image} src={image} name={s.name} eager />
            </motion.div>
          </AnimatePresence>
          <div className="photo-thumbnails">
            {images.map((src, i) => (
              <button
                key={src}
                aria-label={`تصویر ${fa(i + 1)} محصول`}
                aria-pressed={photo === src}
                onClick={() => setPhoto(src)}
              >
                <ProductImage src={src} name={`${s.name} · ${i + 1}`} />
              </button>
            ))}
          </div>
          <p className="fine-print">
            عکس محصول از RunRepeat · رنگ عکس ممکن است با رنگ انتخابی متفاوت باشد
            مگر تصویر متناظر ثبت شده باشد.
          </p>
        </div>
        <div className="product-summary">
          <span className="eyebrow">
            {label(s.categories[0])} / {s.release_year || "سال نامشخص"}
          </span>
          <h1 dir="ltr">{s.name}</h1>
          <Link
            to={`/?brand=${encodeURIComponent(s.brand)}&family=${encodeURIComponent(s.family)}`}
            className="text-link"
          >
            خانواده <bdi>{s.family}</bdi>
          </Link>
          <div className="score-line">
            {s.runrepeat_score != null && (
              <span className="score-big">
                {fa(s.runrepeat_score)}
                <small> / ۱۰۰</small>
              </span>
            )}
            <div>
              <b>امتیاز RunRepeat</b>
              <p>از منبع؛ مستقل از امتیاز SoleHunt</p>
            </div>
          </div>
          <div className="key-facts">
            {[
              ["وزن", s.weight_g, "g"],
              ["ارتفاع پاشنه", s.heel_stack_mm, "mm"],
              ["دراپ", s.drop_mm, "mm"],
            ].map(([title, n, unit]) => (
              <div key={String(title)}>
                <span>{String(title)}</span>
                <strong dir="ltr">{value(n, String(unit))}</strong>
              </div>
            ))}
          </div>
          <div className="colorway-section">
            <h2>
              رنگ‌بندی ثبت‌شده <span>{fa(shoe.variants.length)}</span>
            </h2>
            {shoe.variants.length ? (
              <>
                <div className="colorway-options">
                  <button
                    className={!selected ? "active" : ""}
                    onClick={() => {
                      params.delete("colorway");
                      setParams(params, { replace: true });
                      setPhoto(null);
                    }}
                  >
                    عکس اصلی
                  </button>
                  {shoe.variants.map((v) => (
                    <button
                      key={v.key}
                      aria-label={`رنگ ${v.name}`}
                      aria-pressed={selected?.key === v.key}
                      className={selected?.key === v.key ? "active" : ""}
                      onClick={() => {
                        params.set("colorway", v.key);
                        setParams(params, { replace: true });
                        setPhoto(null);
                      }}
                    >
                      <span
                        className="color-dot"
                        style={{ background: v.colors[0] || "#d3dae6" }}
                      />
                      <bdi>{v.name}</bdi>
                    </button>
                  ))}
                </div>
                {selected && (
                  <p className="fine-print" dir="auto">
                    {selected.name} · {selected.source}
                  </p>
                )}
              </>
            ) : (
              <p className="muted">
                رنگ تأییدشده ثبت نشده؛ به معنای ناموجود بودن نیست.
              </p>
            )}
          </div>
          <button
            className={`button full ${included ? "secondary" : ""}`}
            onClick={() =>
              toggle({ ...s, selected_colorway: selected?.key || null })
            }
          >
            {included ? <Check size={18} /> : <Plus size={18} />}{" "}
            {included ? "حذف از مقایسه" : "افزودن به مقایسه"}
          </button>
          <p className="fine-print">
            <Info size={14} /> داده‌ها از برداشت ۲۰ نوامبر ۲۰۲۶؛ قیمت و موجودی
            زنده نیستند.
          </p>
        </div>
      </div>
      <AnatomyViewer shoe={shoe} />
      <MetricGauges shoe={shoe} />
      <div className="detail-columns">
        <section className="panel">
          <h2>برای چه تجربه‌ای ساخته شده؟</h2>
          <div className="tag-list">
            {[s.terrain, s.uses, s.arch_support].filter(Boolean).map((v) => (
              <span key={String(v)} className="tag" dir="auto">
                {String(v).split(" | ").map(label).join(" · ")}
              </span>
            ))}
          </div>
          <h3>نقاط قوت</h3>
          <ul className="pros" dir="auto">
            {s.pros?.split(" | ").map((p) => <li key={p}>{p}</li>) || (
              <li>ثبت نشده</li>
            )}
          </ul>
          <h3>ملاحظات</h3>
          <ul className="cons" dir="auto">
            {s.cons?.split(" | ").map((p) => <li key={p}>{p}</li>) || (
              <li>ثبت نشده</li>
            )}
          </ul>
        </section>
        <section className="panel">
          <h2>قالب، سایز و جنس</h2>
          <dl className="spec-list">
            {[
              ["بازخورد سایز", s.fit_label ? label(s.fit_label) : null],
              ["تعداد رأی سایز", s.size_fit_votes],
              ["سایز آزمون (عین منبع)", s.tested_size_raw],
              ["رویه", s.upper_material],
              ["فوم", s.foam],
              [
                "صفحه تقویتی",
                s.plate == null ? "اطلاعات نامشخص" : label(s.plate),
              ],
              [
                "عرض‌های اعلام‌شده",
                Object.values(s.width_options || {}).join(" · ") || null,
              ],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt>{String(k)}</dt>
                <dd dir="auto">{value(v)}</dd>
              </div>
            ))}
          </dl>
          {s.fit_note && <p dir="auto">{s.fit_note}</p>}
          <details>
            <summary>
              جدول تبدیل سایز برند <ChevronDown size={15} />
            </summary>
            <p className="fine-print">
              جدول عمومی برند است؛ موجودی مدل یا تضمین تناسب نیست. سیستم سایز
              آزمون از عدد آن حدس زده نشده.
            </p>
            <div className="table-scroll">
              <table dir="ltr">
                <thead>
                  <tr>
                    <th>mm</th>
                    <th>US M</th>
                    <th>US W</th>
                    <th>EU M</th>
                    <th>EU W</th>
                  </tr>
                </thead>
                <tbody>
                  {shoe.fit.size_chart.map((r, i) => (
                    <tr key={i}>
                      {["mm", "usm", "usw", "eum", "euw"].map((k) => (
                        <td key={k}>{value(r[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </div>
      <section className="measurements-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">جزئیات، وقتی به آن نیاز داری</span>
            <h2>اندازه‌ها و نتایج آزمایشگاه</h2>
          </div>
          <span className="tag">واحدها و روش‌ها جدا هستند</span>
        </div>
        {metricGroups.map((group, i) => (
          <details key={group.title} className="spec-group" open={i === 0}>
            <summary>
              {group.title}
              <ChevronDown size={18} />
            </summary>
            <div className="measurement-grid">
              {group.keys.map(([key, title]) => {
                const m = shoe.metrics[key];
                return (
                  <div className="measurement" key={key}>
                    <span>{title}</span>
                    <b dir="ltr">{value(m?.value, m?.unit)}</b>
                    {m && (
                      <>
                        <small>
                          {origins[m.origin] || m.origin} · {m.source}
                        </small>
                        <details className="metric-source">
                          <summary>روش و منبع</summary>
                          <p>
                            روش:{" "}
                            <bdi>
                              {m.methodology_version ||
                                m.method_version ||
                                "ثبت نشده"}
                            </bdi>
                          </p>
                          <p>
                            سایز: <bdi>{m.test_size_raw || "ثبت نشده"}</bdi>
                          </p>
                          {m.reference_length_mm && (
                            <p>طول مرجع: {m.reference_length_mm} میلی‌متر</p>
                          )}
                          {m.photos_min != null && (
                            <p dir="ltr">
                              Photo range: {m.photos_min}–{m.photos_max}{" "}
                              {m.unit}
                            </p>
                          )}
                          {m.uncertain && <p>اختلاف عکس‌ها زیاد است.</p>}
                          {m.source_url && (
                            <a
                              href={m.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              مشاهده منبع <ExternalLink size={12} />
                            </a>
                          )}
                        </details>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </section>
      <SourceScores shoe={shoe} />
      <section className="offers-section panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">پیشنهادهای فروشگاه‌ها</span>
            <h2>قیمت، با زمینه و منبع</h2>
          </div>
          <span className="tag">اسنپ‌شات؛ تأیید زنده نشده</span>
        </div>
        <p className="muted">
          {selected
            ? "فقط پیشنهادهای ثبت‌شده برای همین رنگ نمایش داده می‌شوند."
            : "پیشنهادهای رنگ‌های مختلف؛ ارز و کشور هر پیشنهاد را بررسی کن."}{" "}
          هزینه ارسال و موجودی فعلی نیاز به بررسی فروشگاه دارد.
        </p>
        {offers.length ? (
          <div className="offers-list">
            {offers.map((o) => (
              <a
                className="offer"
                key={o.key}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
              >
                <div>
                  <b>{o.retailer}</b>
                  <small dir="auto">
                    {o.colorway || "رنگ مشخص نشده"} ·{" "}
                    {o.country || "کشور نامشخص"}
                  </small>
                </div>
                <div>
                  <strong dir="ltr">
                    {value(o.price, o.currency || "ارز نامشخص")}
                  </strong>
                  <small>{o.snapshot?.slice(0, 10) || "تاریخ نامشخص"}</small>
                </div>
                <ArrowUpRight size={19} />
              </a>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            پیشنهاد متناظر ثبت نشده؛ موجودی فعلی نامشخص است.
          </p>
        )}
      </section>
      <section className="sources-section panel">
        <h2>این اطلاعات از کجا آمده‌اند؟</h2>
        {shoe.sources.map((source) => (
          <div className="source-row" key={source.name}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.name} <ExternalLink size={14} />
            </a>
            <span>
              {source.license || "حقوق منبع محفوظ"} ·{" "}
              {source.extracted_at?.slice(0, 10) ||
                source.dataset_version ||
                "تاریخ در منبع"}
            </span>
            {source.attribution && <p dir="ltr">{source.attribution}</p>}
          </div>
        ))}
        {shoe.quality_flags.map((f) => (
          <p className="quality-note" key={f} dir="auto">
            {f}
          </p>
        ))}
        <p>
          داده‌های ShoeGeometry و SoleHunt با{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY 4.0
          </a>{" "}
          استفاده شده‌اند. نمودارها اقتباس شماتیک ما هستند.
        </p>
      </section>
    </>
  );
}
