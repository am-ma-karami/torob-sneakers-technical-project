import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import type { Summary } from "../lib/types";
import { ShoeCard } from "../components/ShoeCard";
import { formatNumber } from "../lib/format";
import "./semantic-search.css";

type Result = { items: Summary[]; mode: "hybrid" | "lexical_fallback" };

export function SemanticSearch() {
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

  return (
    <section className="semantic-search" aria-labelledby="semantic-title">
      <header className="semantic-intro">
        <span className="semantic-eyebrow">کفشی برای قدم‌های تو</span>
        <h1 id="semantic-title">جست‌وجوی معنایی</h1>
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
      {result && <section aria-labelledby="semantic-results" aria-busy={loading}>
        <header className="semantic-result-heading">
          <h2 id="semantic-results" tabIndex={-1} ref={heading}>{formatNumber(result.items.length)} محصول نزدیک</h2>
          <p>برای «{submitted}»</p>
        </header>
        {result.mode === "lexical_fallback" && <p className="semantic-notice" role="status">
          جست‌وجوی معنایی فعلاً در دسترس نیست؛ نتیجه‌های جست‌وجوی متنی نمایش داده می‌شوند.
        </p>}
        {!result.items.length && <p className="state-panel">محصولی پیدا نشد. نام مدل یا توضیح کوتاه‌تری را امتحان کن.</p>}
        <div className="semantic-grid">{result.items.slice(0, 10).map((shoe, index) =>
          <ShoeCard key={shoe.shoe_id} shoe={shoe} index={index} />)}</div>
      </section>}
    </section>
  );
}
