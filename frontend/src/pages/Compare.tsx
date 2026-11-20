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
  { title: "کاربری", key: "uses" },
  { title: "مسیر", key: "terrain" },
  { title: "حمایت قوس", key: "arch_support" },
  { title: "بازخورد سایز", key: "fit_label" },
  { title: "سایز آزمون", key: "tested_size_raw" },
  { title: "رویه", key: "upper_material" },
  { title: "فوم", key: "foam" },
  { title: "زیره خارجی", key: "outsole_material" },
  { title: "صفحه تقویتی", key: "plate" },
  { title: "کفی جداشدنی", key: "removable_insole" },
  { title: "بازتابنده", key: "reflective" },
  { title: "امتیاز کلی / ۱۰۰", key: "runrepeat_score" },
  { title: "نقاط قوت", key: "pros_fa" },
  { title: "ملاحظات", key: "cons_fa" },
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
    const present = shoes.some((s) =>
      row.metric
        ? s.metrics[row.key]?.value != null
        : row.key.endsWith("_fa")
          ? s.reviews_fa?.[row.key === "pros_fa" ? "pros" : "cons"].length
          : s.summary[row.key] != null,
    );
    if (!present) return false;
    if (!differences) return true;
    const values = shoes.map((s) =>
      row.metric
        ? comparableMetric(s.metrics[row.key])
        : row.key.endsWith("_fa")
          ? s.reviews_fa?.[row.key === "pros_fa" ? "pros" : "cons"]
          : s.summary[row.key],
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
          تا چهار کفش را با واحد و روش هر اندازه مقایسه کن. عدد بزرگ‌تر همیشه
          انتخاب بهتر نیست.
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
          <Link className="button" to="/shoes">
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
            <Link to="/shoes" className="text-link">
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
                      <Link to={`/shoes/${s.slug}`} aria-label={s.summary.name}>
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
                    هندسه و ساختار<small>اندازه‌ها و فرم</small>
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
                            : row.key.endsWith("_fa")
                              ? s.reviews_fa?.[
                                  row.key === "pros_fa" ? "pros" : "cons"
                                ]
                              : s.summary[row.key];
                          return (
                            <td key={s.shoe_id}>
                              {raw == null ? (
                                <span className="missing">—</span>
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
                                    <small>
                                      {origins[m.origin]}
                                      {m.test_size_raw
                                        ? ` · سایز ${m.test_size_raw}`
                                        : ""}
                                    </small>
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
            </table>
          </div>
          <p className="comparison-note">
            واحدها و روش‌های اندازه‌گیری مستقل‌اند؛ عدد بزرگ‌تر لزوماً بهتر نیست.
            هندسهٔ تخمینی با طول مرجع ۳۰۰ میلی‌متر نمایش داده می‌شود.
          </p>
        </>
      )}
    </>
  );
}
