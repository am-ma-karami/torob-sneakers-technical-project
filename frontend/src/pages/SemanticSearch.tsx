import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Summary } from "../lib/types";
import { ProductImage } from "../components/Shared";
import { formatNumber } from "../lib/format";
import "./semantic-search.css";

type Result = { items: (Summary & { search_explanation: string })[]; mode: "hybrid" | "lexical_fallback" };

export function SemanticSearch({ embedded = false, resultsContainer = null }: { embedded?: boolean; resultsContainer?: HTMLElement | null }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [submitted, setSubmitted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = text.trim();
    if (!q || loading) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    setResult(null);
    setSubmitted(q);
    try {
      const data = await api<Result>("/search", current.signal, { q, limit: 10 });
      if (!current.signal.aborted) {
        setResult(data);
        requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
      }
    } catch {
      if (!current.signal.aborted) setError("جست‌وجو انجام نشد. دوباره تلاش کنید.");
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }

  const results = result ? (
      <section aria-labelledby="semantic-results" aria-busy={loading}>
        <header className="semantic-result-heading">
          <h2 id="semantic-results" tabIndex={-1} ref={heading}>{result ? `${formatNumber(result.items.length)} محصول نزدیک` : "نتیجه‌های جست‌وجوی تو"}</h2>
          <p>{submitted ? `برای «${submitted}»` : "بعد از جست‌وجو، محصولات اینجا نمایش داده می‌شوند."}</p>
        </header>
        {result?.mode === "lexical_fallback" && <p className="semantic-notice" role="status">
          جست‌وجوی معنایی فعلاً در دسترس نیست؛ نتیجه‌های جست‌وجوی متنی نمایش داده می‌شوند.
        </p>}
        {result && !result.items.length && <p className="state-panel">محصولی پیدا نشد. نام مدل یا توضیح کوتاه‌تری را امتحان کن.</p>}
        <div className="semantic-grid" aria-label="جایگاه 10 نتیجه">
          {result?.items.slice(0, 10).map((shoe, index) => <article key={shoe.shoe_id} className="semantic-card">
              <Link to={`/shoes/${shoe.slug}`} className="semantic-card-link">
                <ProductImage src={shoe.catalog_image_url || shoe.image_url} name={shoe.name} />
                <span className="semantic-rank">{formatNumber(index + 1)}</span>
                <h3 dir="ltr">{shoe.name}</h3>
              </Link>
              <p>{shoe.search_explanation}</p>
            </article>)}
        </div>
      </section>
  ) : null;

  return (
    <section className={`semantic-search ${embedded ? "semantic-embedded panel" : ""}`} aria-labelledby="semantic-title">
      <header className="semantic-intro">
        {!embedded && <span className="semantic-eyebrow">کفشی برای قدم‌های تو</span>}
        {embedded ? <h2 id="semantic-title">جست‌وجوی معنایی</h2> : <h1 id="semantic-title">جست‌وجوی معنایی</h1>}
        <p>بگو چه کفشی می‌خواهی؛ از کاربرد و حس راحتی تا رنگ و ظاهرش.</p>
      </header>
      <form onSubmit={submit} className="semantic-form">
        <label htmlFor="semantic-query">کفش مورد نظرت را توصیف کن</label>
        <textarea id="semantic-query" value={text} onChange={(e) => setText(e.target.value)}
          maxLength={400} required rows={3}
          placeholder="مثلاً کفش سبک و نرم برای دویدن روزانه روی آسفالت" />
        <div className="semantic-form-footer">
          <span>تا 10 محصول نزدیک به توضیحت</span>
          <button className="button" type="submit" disabled={loading || !text.trim()}>
            <Search size={18} />{loading ? "در حال جست‌وجو…" : "پیدا کردن کفش"}
          </button>
        </div>
      </form>
      <div role="status" aria-live="polite" className="semantic-status">
        {loading && "داریم کفش‌های نزدیک به توضیحت را پیدا می‌کنیم…"}
      </div>
      {error && <p role="alert" className="state-panel">{error}</p>}
      {embedded && resultsContainer ? createPortal(results, resultsContainer) : results}
    </section>
  );
}
