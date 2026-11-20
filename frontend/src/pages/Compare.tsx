import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Columns3, Copy, Plus, X } from "lucide-react";
import { comparableMetric } from "../lib/compareValues";
import { api } from "../lib/api";
import type { Shoe } from "../lib/types";
import { metricGroups, origins, value, label, fa } from "../lib/format";
import { useComparison } from "../lib/comparison";
import { comparisonUrl } from "../components/ComparisonTray";
import { AnatomyViewer } from "../components/AnatomyViewer";
import {
  Breadcrumb,
  ErrorState,
  Loading,
  ProductImage,
} from "../components/Shared";
type Row = { title: string; key: string; metric?: boolean };
const basics: Row[] = [
  { title: "برند", key: "brand" },
  { title: "خانواده", key: "family" },
  { title: "دسته", key: "categories" },
  { title: "سال عرضه", key: "release_year" },
  { title: "قیمت فهرست سازنده · USD", key: "msrp_usd" },
  { title: "کاربری", key: "uses" },
  { title: "مسیر", key: "terrain" },
  { title: "حمایت قوس", key: "arch_support" },
  { title: "بازخورد سایز", key: "fit_label" },
  { title: "سایز آزمون · عین منبع", key: "tested_size_raw" },
  { title: "رویه", key: "upper_material" },
  { title: "فوم", key: "foam" },
  { title: "زیره خارجی", key: "outsole_material" },
  { title: "صفحه تقویتی", key: "plate" },
  { title: "کفی جداشدنی", key: "removable_insole" },
  { title: "بازتابنده", key: "reflective" },
  { title: "امتیاز RunRepeat / 100", key: "runrepeat_score" },
  { title: "امتیاز SoleHunt · مقیاس منبع", key: "solehunt_score" },
  { title: "راحتی · SoleHunt", key: "solehunt_comfort_score" },
  { title: "دوام · SoleHunt", key: "solehunt_durability_score" },
  { title: "عملکرد · SoleHunt", key: "solehunt_performance_score" },
  { title: "ارزش خرید · SoleHunt", key: "solehunt_value_score" },
  { title: "قالب · SoleHunt", key: "solehunt_fit_score" },
  { title: "مزایا · متن منبع", key: "pros" },
  { title: "ملاحظات · متن منبع", key: "cons" },
];
const groups = [
  { title: "مدل، کاربرد، جنس و امتیاز", rows: basics },
  ...metricGroups.map((g) => ({
    title: g.title,
    rows: g.keys.map(([key, title]) => ({ key, title, metric: true }) as Row),
  })),
];
export function Compare() {
  const { items: stored, remove } = useComparison(),
    [params, setParams] = useSearchParams();
  const raw = params.get("ids");
  const ids = raw
    ? raw
        .split(",")
        .filter((v) => /^\d+$/.test(v))
        .map(Number)
    : stored.map((s) => s.shoe_id);
  const valid =
    ids.length > 0 &&
    ids.length <= 4 &&
    new Set(ids).size === ids.length &&
    (!raw || raw.split(",").length === ids.length);
  const query = useQuery({
    queryKey: ["compare", ids],
    queryFn: ({ signal }) =>
      api<{ items: Shoe[] }>(
        "/compare?" + ids.map((id) => "ids=" + id).join("&"),
        signal,
      ),
    enabled: valid,
  });
  const [differences, setDifferences] = useState(false),
    [expanded, setExpanded] = useState<string[]>([
      groups[0].title,
      groups[1].title,
    ]),
    [copied, setCopied] = useState(false),
    [copyFallback, setCopyFallback] = useState(false);
  const deleteShoe = (id: number) => {
    remove(id);
    const next = new URLSearchParams(params);
    next.set("ids", ids.filter((x) => x !== id).join(","));
    next.delete("variant_" + id);
    setParams(next, { replace: true });
  };
  const shoes = query.data?.items || [];
  const selected = (shoe: Shoe) =>
    shoe.variants.find(
      (v) =>
        v.key ===
        (params.has("variant_" + shoe.shoe_id)
          ? params.get("variant_" + shoe.shoe_id)
          : stored.find((s) => s.shoe_id === shoe.shoe_id)?.selected_colorway),
    );
  const visible = (row: Row) => {
    if (!differences) return true;
    const values = shoes.map((s) =>
      row.metric ? comparableMetric(s.metrics[row.key]) : s.summary[row.key],
    );
    return new Set(values.map((v) => JSON.stringify(v ?? null))).size > 1;
  };
  return (
    <>
      <Breadcrumb name="مقایسه کفش‌ها" />
      <div className="page-heading">
        <span className="eyebrow">
          <Columns3 size={16} /> جزئیات، کنار یکدیگر
        </span>
        <h1>
          تفاوت‌ها را ببین.
          <br />
          <span>انتخاب خودت را پیدا کن.</span>
        </h1>
        <p>
          تا چهار کفش را با واحد، روش و منبع هر اندازه مقایسه کن. عدد بزرگ‌تر
          همیشه انتخاب بهتر نیست.
        </p>
      </div>
      {!valid ? (
        <div className="state-panel panel">
          <Columns3 size={36} />
          <h2>
            {ids.length > 4
              ? "حداکثر چهار کفش انتخاب کن."
              : "کفش‌هایت را برای مقایسه انتخاب کن."}
          </h2>
          <p>از کاتالوگ، کنار هر کفش علامت + را بزن.</p>
          <Link className="button" to="/">
            کشف کفش‌ها
          </Link>
        </div>
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <>
          <div className="compare-toolbar">
            <label className="switch-label">
              <input
                type="checkbox"
                checked={differences}
                onChange={(e) => setDifferences(e.target.checked)}
              />
              <span className="switch-track" />
              فقط تفاوت‌ها
            </label>
            <button
              onClick={() =>
                setExpanded(
                  expanded.length === groups.length
                    ? []
                    : groups.map((g) => g.title),
                )
              }
            >
              {expanded.length === groups.length
                ? "بستن همه گروه‌ها"
                : "باز کردن همه گروه‌ها"}
            </button>
            <button
              onClick={async () => {
                const canonical = new URLSearchParams(params);
                canonical.set("ids", ids.join(","));
                shoes.forEach((s) => {
                  const v = selected(s);
                  if (v) canonical.set("variant_" + s.shoe_id, v.key);
                });
                const url =
                  location.origin + "/compare?" + canonical.toString();
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setCopyFallback(true);
                }
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
              {copied ? "پیوند کپی شد" : "کپی پیوند"}
            </button>
            <Link to="/" className="text-link">
              <Plus size={16} /> افزودن کفش
            </Link>
          </div>
          {copyFallback && (
            <label className="copy-fallback">
              پیوند قابل اشتراک
              <input
                readOnly
                value={
                  location.origin +
                  comparisonUrl(
                    shoes.map((s) => ({
                      ...s.summary,
                      selected_colorway: selected(s)?.key,
                    })),
                  )
                }
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
          <div
            className="comparison-scroll"
            role="region"
            aria-label="جدول مقایسه؛ برای دیدن همه مدل‌ها به صورت افقی پیمایش کن"
            tabIndex={0}
          >
            <table
              className="comparison-table"
              style={{
                minWidth: `calc(var(--compare-label-width) + ${Array(shoes.length).fill("var(--compare-column-width)").join(" + ")})`,
              }}
            >
              <thead>
                <tr>
                  <th className="row-label">
                    {fa(shoes.length)} کفش
                    <br />
                    <small>مقایسه بر اساس داده موجود</small>
                  </th>
                  {shoes.map((s) => (
                    <th key={s.shoe_id} className="comparison-product">
                      <button
                        className="comparison-remove"
                        aria-label={`حذف ${s.summary.name} از مقایسه`}
                        onClick={() => deleteShoe(s.shoe_id)}
                      >
                        <X size={15} />
                      </button>
                      <Link to={`/shoe/${s.slug}`} aria-label={s.summary.name}>
                        <ProductImage
                          key={selected(s)?.key || "primary"}
                          src={
                            selected(s)?.image_url ||
                            s.summary.catalog_image_url ||
                            s.summary.image_url
                          }
                          name={s.summary.name}
                        />
                        <b dir="ltr">{s.summary.name}</b>
                      </Link>
                      <label className="compare-color">
                        رنگ‌بندی
                        <select
                          aria-label={`رنگ ${s.summary.name}`}
                          value={selected(s)?.key || ""}
                          onChange={(e) => {
                            const next = new URLSearchParams(params);
                            next.set("ids", ids.join(","));
                            if (e.target.value)
                              next.set("variant_" + s.shoe_id, e.target.value);
                            else next.set("variant_" + s.shoe_id, "");
                            setParams(next, { replace: true });
                          }}
                        >
                          <option value="">رنگ مشخص نشده</option>
                          {s.variants.map((v) => (
                            <option key={v.key} value={v.key}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="row-label">
                    هندسه و ساختار<small>طرح شماتیک؛ نه اسکن کارخانه</small>
                  </th>
                  {shoes.map((s) => (
                    <td key={s.shoe_id} className="comparison-geometry">
                      <AnatomyViewer shoe={s} compact initialMode="profile" />
                    </td>
                  ))}
                </tr>
              </tbody>
              {groups.map((g) => (
                <tbody key={g.title}>
                  <tr className="comparison-group-row">
                    <th colSpan={shoes.length + 1}>
                      <button
                        aria-expanded={expanded.includes(g.title)}
                        onClick={() =>
                          setExpanded(
                            expanded.includes(g.title)
                              ? expanded.filter((v) => v !== g.title)
                              : [...expanded, g.title],
                          )
                        }
                      >
                        {g.title}
                        <ChevronDown size={16} />
                      </button>
                    </th>
                  </tr>
                  {expanded.includes(g.title) &&
                    g.rows.filter(visible).map((row) => (
                      <tr key={row.key}>
                        <th className="row-label">{row.title}</th>
                        {shoes.map((s) => {
                          const m = row.metric ? s.metrics[row.key] : undefined;
                          const raw = row.metric
                            ? m?.value
                            : s.summary[row.key];
                          return (
                            <td key={s.shoe_id}>
                              {raw == null ? (
                                <span className="missing">ثبت نشده</span>
                              ) : (
                                <>
                                  <span
                                    className="comparison-value"
                                    dir={row.metric ? "ltr" : "auto"}
                                  >
                                    {Array.isArray(raw)
                                      ? raw.map(label).join(" · ")
                                      : typeof raw === "boolean"
                                        ? raw
                                          ? "بله"
                                          : "خیر"
                                        : value(
                                            typeof raw === "string"
                                              ? label(raw)
                                              : raw,
                                            m?.unit,
                                          )}
                                  </span>
                                  {m && (
                                    <>
                                      <small>
                                        {origins[m.origin] || m.origin} ·{" "}
                                        {m.source}
                                      </small>
                                      <small dir="auto">
                                        {m.methodology_version ||
                                          m.method_version ||
                                          "روش در منبع"}
                                      </small>
                                      {m.source_url && (
                                        <a
                                          className="metric-link"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          href={m.source_url}
                                        >
                                          منبع و روش
                                        </a>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              ))}
              <tbody>
                <tr className="comparison-group-row">
                  <th colSpan={shoes.length + 1}>پیشنهادهای فروشگاه و منشأ</th>
                </tr>
                <tr>
                  <th className="row-label">
                    پیشنهادهای ثبت‌شده<small>ارزها بدون تبدیل</small>
                  </th>
                  {shoes.map((s) => {
                    const v = selected(s),
                      offers = s.offers.filter(
                        (o) => !v || o.variant_key === v.key,
                      );
                    return (
                      <td key={s.shoe_id}>
                        {offers.length ? (
                          offers.map((o) => (
                            <a
                              key={o.key}
                              href={o.url}
                              className="compare-offer"
                              target="_blank"
                              rel="noopener noreferrer sponsored"
                            >
                              <b dir="ltr">
                                {value(o.price, o.currency || "?")}
                              </b>
                              <span>{o.retailer}</span>
                              <small>
                                {o.snapshot?.slice(0, 10) || "تاریخ نامشخص"} ·{" "}
                                {o.country || "کشور نامشخص"}
                              </small>
                            </a>
                          ))
                        ) : (
                          <span className="missing">
                            پیشنهاد متناظر ثبت نشده
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th className="row-label">منابع و عدم قطعیت</th>
                  {shoes.map((s) => (
                    <td key={s.shoe_id}>
                      {s.sources.map((source) => (
                        <a
                          className="source-link"
                          href={source.url}
                          key={source.name}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source.name} · {source.license || "حقوق محفوظ"}
                        </a>
                      ))}
                      <small>
                        هندسه عکس: طول مرجع ۳۰۰ میلی‌متر. فرم رویه و لایه‌ها
                        شماتیک است.
                      </small>
                      {s.quality_flags.map((f) => (
                        <small dir="auto" key={f}>
                          {f}
                        </small>
                      ))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="comparison-note">
            قیمت فهرست USD از پیشنهادهای EUR جداست. امتیازهای منابع، Asker C،
            Shore A، BR و روش قدیمی تهویه با هم میانگین نشده‌اند. مقدار ثبت‌نشده
            در رتبه‌بندی صفر فرض نمی‌شود.
          </p>
        </>
      )}
    </>
  );
}
