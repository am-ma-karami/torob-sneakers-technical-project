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
import "./finder.css";
import {
  SearchModes,
  modeLabels,
  type SearchMode,
} from "../components/finder/SearchModes";
import {
  FinderResults,
  type SearchResult,
} from "../components/finder/FinderResults";
import { SemanticSearch } from "./SemanticSearch";
import { buildFinderSearch } from "../lib/finderSearch";
import { api } from "../lib/api";
import type { FacetOption, FinderPrefs, Taxonomy } from "../lib/types";
import { formatNumber, latinDigits } from "../lib/format";
import { Breadcrumb } from "../components/Shared";

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

export function Finder() {
  const [mode, setMode] = useState<SearchMode | null>(null);
  const [revision, setRevision] = useState(0);
  const [extraPrefs, setExtraPrefs] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [emptyError, setEmptyError] = useState(false);
  const [prefs, setPrefs] = useState<FinderPrefs>(empty);
  const [numbers, setNumbers] = useState(emptyLimits);
  const [invalid, setInvalid] = useState<Limit | null>(null);
  const [applied, setApplied] = useState<ReturnType<
    typeof buildFinderSearch
  > | null>(null);
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
    queryKey: ["finder-hybrid", applied, revision],
    queryFn: ({ signal }) => api<SearchResult>("/search", signal, applied),
    enabled: !!applied,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const availableBrands = (
    (prefs.category ? brands.data?.items : taxonomy.data?.brands) ?? []
  ).filter(({ value }) => !prefs.brands.includes(value));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (result.isFetching) return;
    const filters = { ...(mode === "advisor" ? empty : prefs) };
    for (const { key, min, max } of limits) {
      const parsed = mode === "advisor" ? null : parseLimit(numbers[key]);
      if (
        parsed !== null &&
        (!Number.isFinite(parsed) || parsed < min || parsed > max)
      ) {
        setInvalid(key);
        const input = event.currentTarget.querySelector<HTMLInputElement>(
          `#finder-${key}`,
        );
        let ancestor: HTMLElement | null = input ?? null;
        while (ancestor) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
          ancestor = ancestor.parentElement;
        }
        input?.focus();
        return;
      }
      filters[key] = parsed;
    }
    setInvalid(null);
    const request = {
      ...buildFinderSearch(mode === "advanced" ? "" : text, filters),
      mode: mode ?? "auto",
    };
    if (mode !== "advisor") Object.assign(request.preferences, extraPrefs);
    const blank =
      !request.q &&
      !Object.keys(request.hard_filters).length &&
      !Object.keys(request.preferences).length;
    setEmptyError(blank);
    if (
      blank ||
      (mode !== "advanced" && !request.q) ||
      (mode === "hybrid" &&
        !Object.keys(request.hard_filters).length &&
        !Object.keys(request.preferences).length)
    ) {
      setEmptyError(true);
      requestAnimationFrame(() =>
        document.getElementById("finder-input-error")?.focus(),
      );
      return;
    }
    setApplied(request);
    setRevision((v) => v + 1);
    requestAnimationFrame(() => {
      document.getElementById("finder-results")?.focus();
    });
  }

  function reset() {
    setExtraPrefs({});
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

  const manual = (
    <>
      <section className="finder-form panel">
        <h2>شرط‌های ضروری</h2>
        <p className="fine-print">
          این شرط‌ها باید رعایت شوند؛ خالی یعنی بدون محدودیت.
        </p>
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
                    عددی بین {formatNumber(min)} و {formatNumber(max)} وارد کن.
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="fine-print">
            سقف‌ها شرط قطعی‌اند. برای بدون محدودیت، فیلد را خالی بگذار.
          </p>
        </details>
        <p className="fine-print">
          دراپ اختلاف ارتفاع پاشنه و پنجه است، نه ارتفاع کل زیره.
        </p>
        <h2 className="finder-preferences-title">ترجیحات من</h2>
        <p className="fine-print">
          ترجیح‌ها ترتیب پیشنهادها را تغییر می‌دهند؛ شرط حذف نیستند.
        </p>
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
            ["light", "سبک‌تر"],
            ["balanced", "متعادل"],
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
        <details className="finder-limits">
          <summary>ترجیح‌های بیشتر</summary>
          <div className="finder-controls">
            {(
              [
                [
                  "surface",
                  "مسیر",
                  [
                    ["road", "آسفالت"],
                    ["trail", "طبیعت"],
                  ],
                ],
                ["breathability", "تنفس‌پذیری", [["high", "بیشتر"]]],
                ["flexibility", "انعطاف", [["high", "بیشتر"]]],
                ["durability", "دوام زیره", [["high", "بیشتر"]]],
              ] as const
            ).map(([key, label, options]) => (
              <label className="finder-category" key={key}>
                {label}
                <select
                  value={extraPrefs[key] ?? ""}
                  onChange={(e) =>
                    setExtraPrefs((current) => {
                      const next = { ...current };
                      if (e.target.value) next[key] = e.target.value;
                      else delete next[key];
                      return next;
                    })
                  }
                >
                  <option value="">بدون ترجیح</option>
                  {options.map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
        <details className="finder-limits">
          <summary>دربارهٔ اصطلاح‌ها</summary>
          <p className="fine-print">
            فضای جلوی پا، عرض داخلی محل انگشت‌هاست. حس فوم از سختی
            اندازه‌گیری‌شدهٔ آن می‌آید و با ارتفاع زیره فرق دارد. انعطاف بر اساس
            نیروی لازم برای خم‌کردن کفش سنجیده می‌شود؛ تضمین راحتی نیست.
          </p>
        </details>
      </section>
    </>
  );

  function changeMode(next: SearchMode) {
    setMode(next);
    setApplied(null);
    setEmptyError(false);
    setInvalid(null);
  }

  return (
    <div className="finder-page">
      <Breadcrumb name="کفش مناسب من" />
      <div className="page-heading finder-heading">
        <span className="eyebrow">
          <Footprints size={16} aria-hidden="true" /> راهنمای انتخاب راد
        </span>
        <h1>کفش مناسب تو کدومه؟</h1>
        <p>روش خودت رو برای پیدا کردن کفش ایده‌آل انتخاب کن.</p>
      </div>
      <SearchModes mode={mode} onChange={changeMode} />
      {mode && (
        <form
          onSubmit={submit}
          id="finder-filters"
          className={`finder-workspace mode-${mode}`}
        >
          <div className="finder-workspace-heading">
            <h2>{modeLabels[mode]}</h2>
            <span className="fine-print">
              {mode === "advanced"
                ? "انتخاب دقیق، بر پایهٔ مشخصات واقعی"
                : mode === "advisor"
                  ? "نیاز تو، نقطهٔ شروع انتخاب"
                  : "دقت فیلترها، همراه با توضیح تو"}
            </span>
          </div>
          {mode === "hybrid" && (
            <p className="finder-guidance">
              فیلترها، شرایط اصلی انتخابت رو مشخص می‌کنن و توضیحاتت کمک می‌کنن
              پیشنهادهای شخصی‌تری دریافت کنی.
            </p>
          )}
          <div className="finder-workspace-grid">
            {mode !== "advisor" &&
              (mode === "hybrid" ? (
                <details className="finder-manual-disclosure" open>
                  <summary>فیلترها و ترجیحات من</summary>
                  {manual}
                </details>
              ) : (
                manual
              ))}
            {mode !== "advanced" && (
              <SemanticSearch text={text} onChange={setText} />
            )}
          </div>
          {emptyError && (
            <p id="finder-input-error" tabIndex={-1} role="alert">
              {mode === "advanced"
                ? "حداقل یک شرط یا ترجیح انتخاب کن."
                : mode === "advisor"
                  ? "نیازت را در کادر توضیح بنویس."
                  : "برای جست‌وجوی ترکیبی، هم توضیح بنویس و هم حداقل یک شرط یا ترجیح انتخاب کن."}
            </p>
          )}
          <div className="finder-actions">
            <button
              className="button"
              type="submit"
              disabled={result.isFetching}
            >
              {result.isFetching
                ? "در حال جست‌وجو…"
                : mode === "advanced"
                  ? "پیدا کردن کفش مناسب"
                  : mode === "advisor"
                    ? "پیدا کردن کفش با هوش مصنوعی"
                    : "پیدا کردن بهترین گزینه‌ها"}
            </button>
            <button
              className="finder-text-action"
              type="button"
              onClick={reset}
            >
              پاک کردن انتخاب‌ها
            </button>
            {mode !== "advanced" && (
              <span className="fine-print">Ctrl / ⌘ + Enter برای جست‌وجو</span>
            )}
          </div>
        </form>
      )}
      {applied && (
        <FinderResults
          data={result.data}
          loading={result.isFetching}
          error={result.isError}
          retry={() => void result.refetch()}
          onManual={() => changeMode("advanced")}
          edit={() => {
            const target = document.getElementById(
              mode === "advanced" ? "finder-filters" : "semantic-query",
            );
            target?.scrollIntoView({ block: "center", behavior: "instant" });
            target?.focus();
          }}
        />
      )}
    </div>
  );
}
