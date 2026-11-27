import "./semantic-search.css";

export function SemanticSearch({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  return <section className="semantic-search semantic-embedded panel" aria-labelledby="semantic-title">
    <header className="semantic-intro"><h2 id="semantic-title">جست‌وجوی معنایی</h2>
      <p>نیازت را توضیح بده؛ شرط‌های قطعی و ترجیح‌ها جداگانه بررسی می‌شوند.</p>
    </header>
    <div className="semantic-form">
      <label htmlFor="semantic-query">کفش مورد نظرت را توصیف کن</label>
      <textarea id="semantic-query" value={text} onChange={e => onChange(e.target.value)} maxLength={400} rows={3}
        placeholder="مثلاً کفش سبک و نرم برای دویدن روزانه روی آسفالت" />
      <p className="fine-print">می‌توانی فقط متن بنویسی، فقط فیلتر انتخاب کنی یا از هر دو استفاده کنی.</p>
    </div>
  </section>;
}
