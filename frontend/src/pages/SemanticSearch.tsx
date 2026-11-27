import { useLayoutEffect, useRef } from "react";
import { Sparkles, ArrowUpLeft } from "lucide-react";
import "./semantic-search.css";
const examples = [
  "برای دویدن روزانه روی آسفالت یه کفش سبک و نرم می‌خوام.",
  "کفشی می‌خوام که برای پیاده‌روی طولانی راحت باشه.",
  "یه کفش با فضای جلوی پای جادار می‌خوام.",
  "برای باشگاه کفش پایدار و سبک می‌خوام.",
];
export function SemanticSearch({
  text,
  onChange,
}: {
  text: string;
  onChange: (text: string) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = `${Math.min(360, Math.max(120, input.current.scrollHeight))}px`;
    }
  }, [text]);
  return (
    <section
      className="semantic-search semantic-embedded panel"
      aria-labelledby="semantic-title"
    >
      <header className="semantic-intro">
        <Sparkles size={22} aria-hidden="true" />
        <h2 id="semantic-title">بگو دنبال چه کفشی هستی</h2>
        <p>
          نیازت رو با زبان خودت توضیح بده؛ ما براساس مشخصات واقعی کفش‌ها،
          مناسب‌ترین گزینه‌ها رو پیدا می‌کنیم.
        </p>
      </header>
      <div className="semantic-form">
        <label htmlFor="semantic-query">کفش مورد نظرت را توصیف کن</label>
        <textarea
          ref={input}
          id="semantic-query"
          dir="auto"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          maxLength={400}
          rows={3}
          aria-describedby="semantic-hint"
          onKeyDown={(e) => {
            if (
              (e.ctrlKey || e.metaKey) &&
              e.key === "Enter" &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="برای چه کاری کفش می‌خوای؟ چه چیزی برات مهم‌تره؟"
        />
        <div className="semantic-input-footer">
          <span id="semantic-hint">فارسی یا English · Enter برای خط جدید</span>
          <span>{text.length} / 400</span>
        </div>
      </div>
      <p className="fine-print">
        از اینجا شروع کن؛ قبل از جست‌وجو می‌تونی متن رو تغییر بدی.
      </p>
      <div className="semantic-examples">
        {examples.map((example) => (
          <button
            type="button"
            key={example}
            onClick={() => {
              onChange(example);
              input.current?.focus();
            }}
          >
            {example}
            <ArrowUpLeft size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="fine-print">
        پیشنهادها به داده‌های موجود وابسته‌اند؛ راحتی یا تناسب پا تضمین نمی‌شود.
      </p>
    </section>
  );
}
