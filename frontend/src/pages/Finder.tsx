import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Footprints,
  MoveHorizontal,
  Feather,
  Layers3,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { SemanticSearch } from "./SemanticSearch";
import { buildFinderSearch } from "../lib/finderSearch";
import { api } from "../lib/api";
import type {
  FacetOption,
  FinderPrefs,
  Summary,
  Taxonomy,
} from "../lib/types";
import { formatNumber, latinDigits } from "../lib/format";
import { ShoeCard } from "../components/ShoeCard";
import { Breadcrumb, ErrorState } from "../components/Shared";

const empty: FinderPrefs = {
  category: "",
  brands: [],
  weight_max: null,
  drop_max: null,
  width: "any",
  weight: "any",
  cushion: "any",
};
const limits = [
  {
    key: "weight_max",
    title: "حداکثر وزن",
    unit: "گرم",
    min: 0,
    max: 3000,
    hint: "مثلاً 250",
  },
  {
    key: "drop_max",
    title: "حداکثر دراپ",
    unit: "میلی‌متر",
    min: -20,
    max: 60,
    hint: "مثلاً 8",
  },
] as const;
type Limit = (typeof limits)[number]["key"];
const emptyLimits: Record<Limit, string> = { weight_max: "", drop_max: "" };
function parseLimit(raw: string) {
  const text = latinDigits(raw.trim()).replace(/−/g, "-");
  if (!text) return null;
  return /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) ? Number(text) : NaN;
}

type SearchResult = { items: (Summary & { search_explanation: string })[]; mode: "hybrid" | "lexical_fallback" };


export function Finder() {
  const [text, setText] = useState("");
  const [emptyError, setEmptyError] = useState(false);
  const [prefs, setPrefs] = useState<FinderPrefs>(empty);
  const [numbers, setNumbers] = useState(emptyLimits);
  const [invalid, setInvalid] = useState<Limit | null>(null);
  const [applied, setApplied] = useState<ReturnType<typeof buildFinderSearch> | null>(null);
  const taxonomy = useQuery({
    queryKey: ["taxonomy"],
    queryFn: ({ signal }) => api<Taxonomy>("/taxonomy", signal),
  });
  const brands = useQuery({
    queryKey: ["finder-brands", prefs.category],
    queryFn: ({ signal }) =>
      api<{ items: FacetOption[] }>(
        "/finder/brands?category=" + encodeURIComponent(prefs.category),
        signal,
      ),
    enabled: !!prefs.category,
    staleTime: 5 * 60_000,
  });
  const result = useQuery({
    queryKey: ["finder-hybrid", applied],
    queryFn: ({ signal }) => api<SearchResult>("/search", signal, applied),
    enabled: !!applied,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const availableBrands = ((prefs.category ? brands.data?.items : taxonomy.data?.brands) ?? []).filter(
    ({ value }) => !prefs.brands.includes(value),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filters = { ...prefs };
    for (const { key, min, max } of limits) {
      const parsed = parseLimit(numbers[key]);
      if (
        parsed !== null &&
        (!Number.isFinite(parsed) || parsed < min || parsed > max)
      ) {
        setInvalid(key);
        const input = event.currentTarget.querySelector<HTMLInputElement>(
          `#finder-${key}`,
        );
        const details = input?.closest("details");
        if (details) details.open = true;
        input?.focus();
        return;
      }
      filters[key] = parsed;
    }
    setInvalid(null);
    const request = buildFinderSearch(text, filters);
    setEmptyError(!request.q);
    if (!request.q) return;
    if (applied && JSON.stringify(applied) === JSON.stringify(request)) void result.refetch();
    else setApplied(request);
    requestAnimationFrame(() => {
      document.getElementById("finder-results")?.focus();
    });
  }

  function reset() {
    setPrefs(empty);
    setText("");
    setEmptyError(false);
    setNumbers(emptyLimits);
    setInvalid(null);
    setApplied(null);
  }

  const group = <K extends "width" | "weight" | "cushion">(
    key: K,
    title: string,
    options: [FinderPrefs[K], string][],
    Icon: typeof Feather,
  ) => (
    <fieldset className="preference-group">
      <legend>
        <Icon size={18} aria-hidden="true" />
        {title}
      </legend>
      <div>
        {options.map(([v, text]) => (
          <label key={v} className={prefs[key] === v ? "selected" : ""}>
            <input
              type="radio"
              name={key}
              value={v}
              checked={prefs[key] === v}
              onChange={() => setPrefs({ ...prefs, [key]: v })}
            />
            <span>{text}</span>
            {prefs[key] === v && <Check size={14} aria-hidden="true" />}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <>
      <Breadcrumb name="کفش مناسب من" />
      <div className="page-heading">
        <span className="eyebrow">
          <Footprints size={16} aria-hidden="true" /> راهنمای انتخاب
        </span>
        <h1>کفش مناسب من</h1>
        <p>
          کاربری، برند و ترجیح‌هایت را مشخص کن و گزینه‌های مناسب را با هم مقایسه
          کن.
        </p>
      </div>
      <form onSubmit={submit} id="finder-filters">
      <div className="finder-layout">
        <section
          className="finder-form panel"
        >
          <h2>شرط‌های انتخاب</h2>
          <div className="finder-controls">
            <label className="finder-category">
              نوع استفاده
              <select
                value={prefs.category}
                onChange={(e) =>
                  setPrefs({ ...prefs, category: e.target.value, brands: [] })
                }
              >
                <option value="">بدون انتخاب</option>
                {taxonomy.data?.categories.map((c) => (
                  <option value={c.value} key={c.value}>
                    {c.label}
                  </option>
                )) || null}
              </select>
            </label>
            <label className="finder-category">
              برند
              <select
                aria-label="افزودن برند"
                value=""
                disabled={!availableBrands.length || prefs.brands.length >= 8}
                onChange={(e) => {
                  if (e.target.value && prefs.brands.length < 8)
                    setPrefs({
                      ...prefs,
                      brands: [...prefs.brands, e.target.value],
                    });
                }}
              >
                <option value="">
                  {(prefs.category ? brands.isPending : taxonomy.isPending)
                    ? "در حال دریافت برندها…"
                    : brands.isError
                      ? "برندها در دسترس نیستند"
                      : prefs.brands.length >= 8
                        ? "حداکثر 8 برند"
                        : !availableBrands.length
                          ? "برند دیگری نیست"
                          : prefs.brands.length
                            ? "افزودن برند دیگر"
                            : "همهٔ برندها"}
                </option>
                {availableBrands.map((brand) => (
                  <option key={brand.value} value={brand.value}>
                    {brand.label} ({formatNumber(brand.count)})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {brands.isError && (
            <button
              className="finder-text-action"
              type="button"
              onClick={() => brands.refetch()}
            >
              دریافت دوبارهٔ برندها
            </button>
          )}
          {prefs.brands.length > 0 && (
            <ul className="finder-brand-chips" aria-label="برندهای انتخاب‌شده">
              {prefs.brands.map((brand) => (
                <li key={brand}>
                  <button
                    type="button"
                    aria-label={`حذف برند ${brand}`}
                    onClick={() =>
                      setPrefs({
                        ...prefs,
                        brands: prefs.brands.filter((b) => b !== brand),
                      })
                    }
                  >
                    <bdi>{brand}</bdi>
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <details className="finder-limits">
            <summary>
              سقف وزن و دراپ <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="finder-controls">
              {limits.map(({ key, title, unit, min, max, hint }) => (
                <div key={key}>
                  <label className="finder-category">
                    {title} ({unit})
                    <input
                      id={`finder-${key}`}
                      inputMode="decimal"
                      value={numbers[key]}
                      placeholder={hint}
                      maxLength={10}
                      aria-invalid={invalid === key}
                      aria-describedby={
                        invalid === key ? `finder-${key}-error` : undefined
                      }
                      onChange={(e) => {
                        setNumbers({ ...numbers, [key]: e.target.value });
                        if (invalid === key) setInvalid(null);
                      }}
                    />
                  </label>
                  {invalid === key && (
                    <p
                      className="finder-field-error"
                      role="alert"
                      id={`finder-${key}-error`}
                    >
                      عددی بین {formatNumber(min)} و {formatNumber(max)} وارد
                      کن.
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="fine-print">
              سقف‌ها شرط قطعی‌اند. برای بدون محدودیت، فیلد را خالی بگذار.
            </p>
          </details>
          <h2 className="finder-preferences-title">ترجیح‌ها</h2>
          {group(
            "width",
            "فضای جلوی پا",
            [
              ["any", "فرقی ندارد"],
              ["regular", "متوسط"],
              ["wide", "جادار"],
            ],
            MoveHorizontal,
          )}
          {group(
            "weight",
            "ترجیح وزن",
            [
              ["any", "فرقی ندارد"],
              ["light", "سبک · تا 250 گرم"],
              ["balanced", "متعادل · 250 تا 320 گرم"],
            ],
            Feather,
          )}
          {group(
            "cushion",
            "حس فوم",
            [
              ["any", "فرقی ندارد"],
              ["soft", "نرم‌تر"],
              ["firm", "سفت‌تر"],
            ],
            Layers3,
          )}
        </section>
        <SemanticSearch text={text} onChange={setText} />
      </div>
      <div className="finder-actions">
        <button className="button" type="submit" disabled={result.isFetching}> {result.isFetching ? "در حال جست‌وجو…" : "پیدا کردن گزینه‌ها"}</button>
        <button className="finder-text-action" type="button" onClick={reset}>پاک کردن انتخاب‌ها</button>
      </div>
      {emptyError && <p role="alert">توضیحت را بنویس یا حداقل یک فیلتر انتخاب کن.</p>}
      </form>
      {applied && <section id="finder-results" className="finder-results" tabIndex={-1} aria-labelledby="finder-results-title" aria-busy={result.isFetching}>
        <div className="section-head"><h2 id="finder-results-title">گزینه‌هایی برای مقایسه</h2></div>
        {result.isFetching ? <p role="status">در حال پیدا کردن گزینه‌های نزدیک به درخواستت…</p> : result.isError ? <ErrorState retry={() => result.refetch()} /> : <>
          {result.data?.mode === "lexical_fallback" && <p role="status" className="semantic-notice">جست‌وجوی معنایی فعلاً در دسترس نیست؛ نتیجه‌های جست‌وجوی متنی نمایش داده می‌شوند.</p>}
          <p role="status">{formatNumber(result.data?.items.length ?? 0)} گزینه برای مقایسه</p>
          <div className="finder-grid">{result.data?.items.map((shoe, index) => <div className="finder-result" key={shoe.shoe_id}>
            <div className="match-explanation"><p>{shoe.search_explanation}</p></div>
            <ShoeCard shoe={shoe} index={index} />
          </div>)}</div>
          {!result.data?.items.length && <div className="state-panel finder-empty"><h3>محصولی پیدا نشد.</h3><p>توضیح یا شرط‌ها را تغییر بده و دوباره جست‌وجو کن.</p></div>}
        </>}
      </section>}
    </>
  );
}
