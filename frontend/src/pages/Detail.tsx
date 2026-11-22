import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Columns3, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import type { Shoe } from "../lib/types";
import { labChartImages } from "../lib/gallery";
import {
  formatNumber,
  label,
  latinDigits,
  metricGroups,
  origins,
  value,
} from "../lib/format";
import { SourceScores } from "../components/SourceScores";
import { MetricGauges } from "../components/MetricGauges";
import { AnatomyViewer } from "../components/AnatomyViewer";
import { ProductGallery } from "../components/ProductGallery";
import { StoreOffers } from "../components/StoreOffers";
import { ScorePanel } from "../components/ScorePanel";
import {
  Breadcrumb,
  ErrorState,
  Loading,
  ProductImage,
} from "../components/Shared";
import { comparisonUrl } from "../components/ComparisonTray";
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
  const selected = shoe.variants.find((v) => v.key === params.get("colorway"));
  const { items } = useComparison(),
    s = shoe.summary;
  const included = items.some((x) => x.shoe_id === shoe.shoe_id);
  const full = !included && items.length >= 4;
  const current = { ...s, selected_colorway: selected?.key ?? null };
  const picks = included
    ? items.map((item) => (item.shoe_id === s.shoe_id ? current : item))
    : [...items, current];
  const charts = labChartImages(shoe);
  useEffect(() => {
    document.title = `${s.name} | راد`;
  }, [s.name]);
  const specs: [string, unknown][] = [
    ["بازخورد سایز", s.fit_label ? label(s.fit_label) : null],
    ["تعداد رأی سایز", s.size_fit_votes],
    ["سایز آزمون", s.tested_size_raw],
    ["رویه", s.upper_material ? label(s.upper_material) : null],
    ["فوم", s.foam],
    ["صفحه تقویتی", s.plate ? label(s.plate) : null],
    [
      "عرض‌های تولیدشده",
      Object.values(s.width_options || {})
        .flatMap((v) => String(v).split(" | "))
        .map(label)
        .join(" · "),
    ],
  ];
  return (
    <>
      <Breadcrumb name={s.name} category={s.categories[0]} />
      <div className="product-overview">
        <ProductGallery
          shoe={shoe}
          colorway={selected?.key || null}
          select={(key) => {
            const next = new URLSearchParams(params);
            if (key) next.set("colorway", key);
            else next.delete("colorway");
            setParams(next, { replace: true });
          }}
        />
        <div className="product-summary">
          <span className="eyebrow">
            {label(s.categories[0])}
            {s.release_year ? ` / ${s.release_year}` : ""}
          </span>
          <h1 dir="ltr">{s.name}</h1>
          <Link
            to={`/shoes?brand=${encodeURIComponent(s.brand)}&family=${encodeURIComponent(s.family)}`}
            className="text-link"
          >
            خانواده <bdi>{s.family}</bdi>
          </Link>
          {s.runrepeat_score != null && (
            <div className="score-line">
              <span className="score-big" dir="ltr">
                {formatNumber(s.runrepeat_score)}
                <small> / 100</small>
              </span>
              <div>
                <b>امتیاز کلی</b>
                <p>ارزیابی تجربهٔ این مدل</p>
              </div>
            </div>
          )}
          <div className="key-facts">
            {[
              ["وزن", s.weight_g, "g"],
              ["ارتفاع پاشنه", s.heel_stack_mm, "mm"],
              ["دراپ", s.drop_mm, "mm"],
            ]
              .filter(([, n]) => n != null)
              .map(([title, n, unit]) => (
                <div key={String(title)}>
                  <span>{title}</span>
                  <strong dir="ltr">{value(n, String(unit))}</strong>
                </div>
              ))}
          </div>
          <div className="tag-list">
            {[s.terrain, s.uses, s.arch_support].filter(Boolean).map((v) => (
              <span key={String(v)} className="tag" dir="auto">
                {String(v).split(" | ").map(label).join(" · ")}
              </span>
            ))}
          </div>
          {shoe.reference_price && (
            <p className="reference-price">
              {formatNumber(shoe.reference_price.amount_toman)} تومان{" "}
              <small>قیمت مرجع تبدیل‌شده</small>
            </p>
          )}
          <a href="#stores" className="button full">
            قیمت و فروشگاه‌ها
          </a>
          <Link
            className="button full secondary"
            to={comparisonUrl(full ? items : picks, "/compare/select")}
          >
            <Columns3 size={18} />{" "}
            {full ? "ویرایش انتخاب‌های مقایسه" : "مقایسه با کفش دیگر"}
          </Link>
          {full && (
            <small>برای افزودن این مدل، یکی از 4 انتخاب فعلی را حذف کن.</small>
          )}
        </div>
      </div>
      <StoreOffers slug={shoe.slug} />
      <ScorePanel shoe={shoe} />
      <AnatomyViewer shoe={shoe} />
      {charts.length > 0 && (
        <section
          className="panel lab-charts"
          aria-labelledby="lab-charts-title"
        >
          <h2 id="lab-charts-title">نمودارهای آزمایشگاهی</h2>
          <div className="lab-chart-grid">
            {charts.map(({ src, title }) => (
              <figure key={src} className="lab-chart">
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`باز کردن نمودار ${title} در اندازهٔ اصلی`}
                >
                  <ProductImage
                    src={src}
                    name={`نمودار ${title} برای ${s.name}`}
                  />
                </a>
                <figcaption>
                  <span>{title}</span>
                  <small dir="ltr">RunRepeat</small>
                  <p>
                    این نمودار واکنش زیرهٔ کفش به ضربه‌های پی‌درپی در آزمایشگاه
                    را نشان می‌دهد. محور افقی زمان را بر حسب میلی‌ثانیه نمایش
                    می‌دهد و منحنی‌ها تغییر نیروی واردشده و جابه‌جایی بخش متحرک
                    دستگاه را ثبت می‌کنند. از این اندازه‌گیری‌ها برای بررسی جذب
                    ضربهٔ زیره استفاده می‌شود.
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      <div className="detail-columns">
        {shoe.reviews_fa?.pros.length || shoe.reviews_fa?.cons.length ? (
          <section className="panel">
            <span className="eyebrow">نگاهی به تجربه استفاده</span>
            <h2>قوت‌ها و ملاحظات</h2>
            {shoe.reviews_fa.pros.length > 0 && (
              <>
                <h3>نقاط قوت</h3>
                <ul className="pros">
                  {shoe.reviews_fa.pros.map((p) => (
                    <li key={p}>{latinDigits(p)}</li>
                  ))}
                </ul>
              </>
            )}
            {shoe.reviews_fa.cons.length > 0 && (
              <>
                <h3>ملاحظات</h3>
                <ul className="cons">
                  {shoe.reviews_fa.cons.map((p) => (
                    <li key={p}>{latinDigits(p)}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ) : null}
        {specs.some(([, v]) => v != null && v !== "") && (
          <section className="panel">
            <h2>قالب، سایز و جنس</h2>
            <dl className="spec-list">
              {specs
                .filter(([, v]) => v != null && v !== "")
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd dir="auto">{value(v)}</dd>
                  </div>
                ))}
            </dl>
            {shoe.fit.size_chart.length > 0 && (
              <details>
                <summary>
                  جدول تبدیل سایز برند <ChevronDown size={15} />
                </summary>
                <p className="fine-print">
                  جدول عمومی برند؛ تناسب هر مدل را جداگانه بررسی کن.
                </p>
                <div className="table-scroll">
                  <table dir="ltr">
                    <thead>
                      <tr>
                        {["mm", "US M", "US W", "EU M", "EU W"].map((k) => (
                          <th key={k}>{k}</th>
                        ))}
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
            )}
          </section>
        )}
      </div>
      <details className="secondary-metrics">
        <summary>
          جزئیات فنی و اندازه‌گیری‌ها <ChevronDown size={18} />
        </summary>
        <MetricGauges shoe={shoe} />
        <section className="measurements-section">
          {metricGroups
            .filter((g) => g.keys.some(([k]) => shoe.metrics[k]?.value != null))
            .map((group) => (
              <details key={group.title} className="spec-group">
                <summary>
                  {group.title}
                  <ChevronDown size={18} />
                </summary>
                <div className="measurement-grid">
                  {group.keys
                    .filter(([k]) => shoe.metrics[k]?.value != null)
                    .map(([key, title]) => {
                      const m = shoe.metrics[key];
                      return (
                        <div className="measurement" key={key}>
                          <span>{title}</span>
                          <b dir="ltr">{value(m.value, m.unit)}</b>
                          <small>{origins[m.origin]}</small>
                          {m.test_size_raw && (
                            <small>
                              سایز آزمون <bdi>{m.test_size_raw}</bdi>
                            </small>
                          )}
                          {m.reference_length_mm && (
                            <small>
                              طول مرجع {formatNumber(m.reference_length_mm)}{" "}
                              میلی‌متر
                            </small>
                          )}
                          {m.uncertain && (
                            <small>تخمین با اختلاف قابل توجه میان عکس‌ها</small>
                          )}
                        </div>
                      );
                    })}
                </div>
              </details>
            ))}
        </section>
        <SourceScores shoe={shoe} />
      </details>
    </>
  );
}
