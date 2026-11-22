import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Activity,
  Mountain,
  TreePine,
  Dumbbell,
  PersonStanding,
  ScanLine,
} from "lucide-react";
import { api } from "../lib/api";
import type { CatalogResult, FacetResult, Taxonomy } from "../lib/types";
import { formatNumber, label } from "../lib/format";
import { apiParams, facetTitles, toggleFacet } from "../lib/catalogState";
import { ErrorState, Loading } from "../components/Shared";
import { FilterPanel } from "../components/FilterPanel";
import { ShoeCard } from "../components/ShoeCard";
import { Basketball, TennisRacket } from "../components/SportIcons";
const icons: Record<string, typeof Footprints> = {
  "running-shoes": Activity,
  "hiking-shoes": TreePine,
  "tennis-shoes": TennisRacket,
  "basketball-shoes": Basketball,
  "hiking-boots": Mountain,
  "training-shoes": Dumbbell,
  "walking-shoes": PersonStanding,
};
export function Catalog() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const dialog = useRef<HTMLDialogElement>(null);
  const update = useCallback(
    (
      key: string,
      value: string,
      append = false,
      extra?: Record<string, string>,
    ) => {
      setParams(
        (previous) => {
          if (append) return toggleFacet(previous, key, value);
          const next = new URLSearchParams(previous);
          next.delete(key);
          if (value) next.set(key, value);
          Object.entries(extra || {}).forEach(([k, v]) => {
            next.delete(k);
            if (v) next.set(k, v);
          });
          if (key !== "page") next.delete("page");
          return next;
        },
        { preventScrollReset: true },
      );
    },
    [setParams],
  );
  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    if (input === q) return;
    const timer = setTimeout(() => update("q", input), 300);
    return () => clearTimeout(timer);
  }, [input, q, update]);
  useEffect(() => {
    document.title = "راد | کشف و مقایسه کفش";
  }, []);
  const queryString = apiParams(params);
  const results = useQuery({
    queryKey: ["catalog", queryString],
    queryFn: ({ signal }) =>
      api<CatalogResult>("/catalog?" + queryString, signal),
  });
  const facets = useQuery({
    queryKey: ["facets", queryString],
    queryFn: ({ signal }) => api<FacetResult>("/facets?" + queryString, signal),
  });
  const taxonomy = useQuery({
    queryKey: ["taxonomy"],
    queryFn: ({ signal }) => api<Taxonomy>("/taxonomy", signal),
    staleTime: Infinity,
  });
  const clear = () => {
    setInput("");
    setParams({});
  };
  const active = [...params.entries()].filter(
    ([k]) => !["page", "page_size", "sort"].includes(k),
  );
  const category = params.getAll("category");
  const title =
    category.length === 1
      ? `کفش‌های ${label(category[0])}`
      : params.get("brand")
        ? `کفش‌های ${params.getAll("brand").join(" و ")}`
        : "کفش بعدی‌ات را پیدا کن.";
  const remove = (key: string, v: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete(key, v);
      next.delete("page");
      return next;
    });
  };
  return (
    <>
      <section id="catalog" className="catalog-section">
        <div className="section-head catalog-heading">
          <div>
            <span className="eyebrow">یک کاتالوگ، برای هر مسیر</span>
            <h2>{title}</h2>
          </div>
          <Link to="/categories" className="text-link">
            همه دسته‌بندی‌ها <ChevronLeft size={15} />
          </Link>
        </div>
        <nav className="category-tabs" aria-label="دسته‌های کفش">
          <button
            className={!category.length ? "active" : ""}
            onClick={() => {
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.delete("category");
                next.delete("page");
                return next;
              });
            }}
          >
            <Footprints size={17} /> همه کفش‌ها{" "}
            <small>{formatNumber(taxonomy.data?.total || 1167)}</small>
          </button>
          {taxonomy.data?.categories.slice(0, 8).map((c) => {
            const Icon = icons[c.value] || Footprints;
            return (
              <button
                key={c.value}
                className={category.includes(c.value) ? "active" : ""}
                aria-pressed={category.includes(c.value)}
                onClick={() => update("category", c.value, true)}
              >
                <Icon size={17} />
                {c.label}
                <small>{formatNumber(c.count)}</small>
              </button>
            );
          })}
        </nav>
        <div className="catalog-toolbar">
          <label className="catalog-search">
            <Search size={20} />
            <span className="sr-only">جستجوی کفش</span>
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="نام مدل، برند یا رنگ… مثلاً نایک پگاسوس"
              maxLength={160}
            />
            {input && (
              <button
                className="search-clear"
                aria-label="پاک کردن جستجو"
                onClick={() => {
                  setInput("");
                  update("q", "");
                }}
              >
                <X size={16} />
              </button>
            )}
            <kbd>جستجو</kbd>
          </label>
          <button
            className="mobile-filter-button"
            onClick={() => dialog.current?.showModal()}
          >
            <SlidersHorizontal size={17} /> فیلترها{" "}
            {active.length > 0 && <b>{formatNumber(active.length)}</b>}
          </button>
          <label className="sort-control">
            مرتب‌سازی
            <select
              aria-label="مرتب‌سازی"
              value={params.get("sort") || "relevance"}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="relevance">مرتبط‌ترین</option>
              <option value="score">امتیاز کلی</option>
              <option value="weight">سبک‌ترین</option>

              <option value="newest">جدیدترین</option>
              <option value="name">نام مدل</option>
            </select>
          </label>
        </div>
        <AnimatePresence>
          {active.length > 0 && (
            <motion.div
              className="active-filters"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {active.map(([key, v]) => (
                <button
                  className="filter-chip"
                  key={`${key}-${v}`}
                  onClick={() => remove(key, v)}
                  aria-label={`حذف ${facetTitles[key] || key}: ${label(v)}`}
                >
                  <span>
                    {facetTitles[key] || key}: <bdi>{label(v)}</bdi>
                  </span>
                  <X size={13} />
                </button>
              ))}
              <button className="clear-all" onClick={clear}>
                پاک کردن همه
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="catalog-layout">
          <aside className="desktop-filters">
            <FilterPanel
              data={facets.data}
              params={params}
              update={update}
              clear={clear}
            />
          </aside>
          <div className="catalog-results" aria-busy={results.isFetching}>
            <div className="results-heading">
              <p aria-live="polite">
                {results.data ? (
                  <>
                    <strong>{formatNumber(results.data.total)}</strong> کفش پیدا
                    شد
                  </>
                ) : results.isPending ? (
                  "در حال جستجو…"
                ) : (
                  "خطا در دریافت نتایج"
                )}
              </p>
              <span>
                <ScanLine size={14} /> مشخصات واقعی، انتخاب آگاهانه
              </span>
            </div>
            {results.isPending ? (
              <Loading />
            ) : results.isError ? (
              <ErrorState retry={() => results.refetch()} />
            ) : results.data.total === 0 ? (
              <div className="state-panel empty-results">
                <Search size={36} />
                <h3>کفشی با این ترکیب پیدا نشد.</h3>
                <p>یک فیلتر را بردار یا نام مدل را کوتاه‌تر جستجو کن.</p>
                <button className="button secondary" onClick={clear}>
                  شروع دوباره
                </button>
              </div>
            ) : (
              <>
                <div className="product-grid">
                  {results.data.items.map((s, i) => (
                    <ShoeCard key={s.shoe_id} shoe={s} index={i} />
                  ))}
                </div>
                {results.data.pages > 1 && (
                  <nav className="pagination" aria-label="صفحه‌بندی">
                    <button
                      aria-label="صفحه قبل"
                      disabled={results.data.page === 1}
                      onClick={() => {
                        update("page", String(results.data.page - 1));
                        document
                          .getElementById("catalog")
                          ?.scrollIntoView({ block: "start" });
                      }}
                    >
                      <ChevronRight size={18} />
                    </button>
                    <span>
                      صفحه {formatNumber(results.data.page)} از{" "}
                      {formatNumber(results.data.pages)}
                    </span>
                    <button
                      aria-label="صفحه بعد"
                      disabled={results.data.page >= results.data.pages}
                      onClick={() => {
                        update("page", String(results.data.page + 1));
                        document
                          .getElementById("catalog")
                          ?.scrollIntoView({ block: "start" });
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </nav>
                )}
              </>
            )}
            {facets.isError && (
              <p className="inline-error">
                فیلترها دریافت نشدند.{" "}
                <button onClick={() => facets.refetch()}>تلاش دوباره</button>
              </p>
            )}
          </div>
        </div>
      </section>
      <dialog ref={dialog} className="filter-dialog" aria-label="فیلتر کفش‌ها">
        <div className="dialog-top">
          <h2>فیلتر کفش‌ها</h2>
          <button
            className="icon-button"
            aria-label="بستن فیلترها"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <FilterPanel
          data={facets.data}
          params={params}
          update={update}
          clear={clear}
        />
        <div className="dialog-bottom">
          <button
            className="button full"
            onClick={() => dialog.current?.close()}
          >
            نمایش {formatNumber(results.data?.total || 0)} کفش
          </button>
        </div>
      </dialog>
    </>
  );
}
