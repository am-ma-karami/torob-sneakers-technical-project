import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, Search, X } from "lucide-react";
import type { CatalogResult, Summary } from "../lib/types";
import { api } from "../lib/api";
import { useComparison } from "../lib/comparison";
import { formatNumber, label } from "../lib/format";
import { comparisonUrl } from "./ComparisonTray";
import { Breadcrumb, ErrorState, ProductImage } from "./Shared";

export function ComparisonPicker({ initial }: { initial: Summary[] }) {
  const [selection, setSelection] = useState(initial);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { replaceItems } = useComparison();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const count = selection.length;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search]);
  const results = useQuery({
    queryKey: ["comparison-picker", query, page],
    queryFn: ({ signal }) =>
      api<CatalogResult>(
        "/catalog?" +
          new URLSearchParams({
            q: query,
            page: String(page),
            page_size: "8",
          }),
        signal,
      ),
  });
  function choose(shoe: Summary) {
    const exists = selection.some((item) => item.shoe_id === shoe.shoe_id);
    if (!exists && count >= 4) return;
    const next = exists
      ? selection.filter((item) => item.shoe_id !== shoe.shoe_id)
      : [...selection, shoe];
    setSelection(next);
    replaceItems(next);
    if (params.has("ids"))
      navigate("/compare/select", { replace: true, preventScrollReset: true });
  }
  function compare() {
    if (count < 2) return;
    replaceItems(selection);
    navigate(comparisonUrl(selection));
  }
  return (
    <>
      <Breadcrumb name="مقایسه کفش‌ها" />
      <section className="compare-picker" aria-labelledby="picker-title">
        <header>
          <h1 id="picker-title">مقایسه کفش‌ها</h1>
          <p>
            از 2 تا 4 مدل انتخاب کن تا اندازه‌ها و ساختارشان را کنار هم ببینی.
          </p>
        </header>
        <div className="picker-layout">
          <section
            className="picker-selection panel"
            aria-labelledby="selection-heading"
          >
            <h2 id="selection-heading">
              انتخاب‌های تو <span dir="ltr">{count} / 4</span>
            </h2>
            {count > 0 && (
              <ul>
                {selection.map((shoe) => (
                  <li key={shoe.shoe_id}>
                    <ProductImage
                      src={shoe.catalog_image_url || shoe.image_url}
                      name={shoe.name}
                    />
                    <bdi dir="ltr">{shoe.name}</bdi>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => choose(shoe)}
                      aria-label={`حذف ${shoe.name} از انتخاب‌ها`}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p role="status">
              {count === 0
                ? "کفش اول را از فهرست انتخاب کن."
                : count === 1
                  ? "حالا کفش دوم را انتخاب کن."
                  : count === 4
                    ? "برای انتخاب مدل دیگری، یکی را حذف کن."
                    : `${count} کفش برای مقایسه آماده است.`}
            </p>
          </section>
          <section
            className="picker-catalog panel"
            aria-labelledby="picker-search-label"
          >
            <label htmlFor="picker-search" id="picker-search-label">
              جستجو و انتخاب کفش
            </label>
            <div className="picker-input">
              <Search size={18} aria-hidden="true" />
              <input
                id="picker-search"
                type="search"
                dir="auto"
                maxLength={160}
                placeholder="نام مدل یا برند، مثلاً Pegasus"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {results.isError ? (
              <ErrorState retry={() => results.refetch()} />
            ) : results.isPending ? (
              <p role="status">در حال دریافت کفش‌ها…</p>
            ) : !results.data.items.length ? (
              <div className="picker-empty">
                <p role="status">کفشی با این نام پیدا نشد.</p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setSearch("")}
                >
                  پاک کردن جستجو
                </button>
              </div>
            ) : (
              <>
                <ul className="picker-results">
                  {results.data.items.map((shoe) => {
                    const picked = selection.some(
                      (item) => item.shoe_id === shoe.shoe_id,
                    );
                    return (
                      <li key={shoe.shoe_id}>
                        <button
                          type="button"
                          aria-pressed={picked}
                          aria-label={`${picked ? "حذف" : "انتخاب"} ${shoe.name}`}
                          disabled={!picked && count === 4}
                          onClick={() => choose(shoe)}
                        >
                          <ProductImage
                            src={shoe.catalog_image_url || shoe.image_url}
                            name={shoe.name}
                          />
                          <span>
                            <bdi dir="ltr">{shoe.name}</bdi>
                            <small>
                              {shoe.brand}
                              {shoe.categories[0] && (
                                <> · {label(shoe.categories[0])}</>
                              )}
                            </small>
                          </span>
                          {picked ? <Check size={18} /> : <Plus size={18} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {results.data.pages > 1 && (
                  <nav
                    className="picker-pagination"
                    aria-label="صفحات کفش‌های قابل انتخاب"
                  >
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      قبلی
                    </button>
                    <span>
                      صفحه {formatNumber(page)} از{" "}
                      {formatNumber(results.data.pages)}
                    </span>
                    <button
                      type="button"
                      disabled={page >= results.data.pages}
                      onClick={() => setPage(page + 1)}
                    >
                      بعدی
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
          <div className="picker-action">
            <button
              className="button"
              type="button"
              disabled={count < 2}
              onClick={compare}
            >
              نمایش مقایسه{count >= 2 && `ٔ ${count} کفش`}{" "}
              <ArrowLeft size={17} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
