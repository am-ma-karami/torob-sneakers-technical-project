import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Footprints,
  MoveHorizontal,
  Feather,
  Layers3,
  Check,
} from "lucide-react";
import { api } from "../lib/api";
import type { FinderPrefs, FinderResult, Taxonomy } from "../lib/types";
import { fa } from "../lib/format";
import { ShoeCard } from "../components/ShoeCard";
import { Breadcrumb, ErrorState, Loading } from "../components/Shared";
export function Finder() {
  const [prefs, setPrefs] = useState<FinderPrefs>({
    category: "running-shoes",
    width: "any",
    weight: "any",
    cushion: "any",
  });
  const [applied, setApplied] = useState<FinderPrefs | null>(null);
  const taxonomy = useQuery({
    queryKey: ["taxonomy"],
    queryFn: ({ signal }) => api<Taxonomy>("/taxonomy", signal),
  });
  const result = useQuery({
    queryKey: ["finder", applied],
    queryFn: ({ signal }) => api<FinderResult>("/finder", signal, applied),
    enabled: !!applied,
  });
  const group = (
    key: "width" | "weight" | "cushion",
    title: string,
    options: [string, string][],
    Icon: typeof Feather,
  ) => (
    <fieldset className="preference-group">
      <legend>
        <Icon size={18} />
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
            {prefs[key] === v && <Check size={14} />}
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
          <Footprints size={16} /> نقطه شروع، تو هستی
        </span>
        <h1>
          برای قدم‌های تو،
          <br />
          <span>چه کفشی مناسب‌تر است؟</span>
        </h1>
        <p>
          ترجیح‌هایت را مشخص کن. پیشنهادها با قواعد ساده و قابل بررسی، از
          داده‌های واقعی انتخاب می‌شوند.
        </p>
      </div>
      <div className="finder-layout">
        <form
          className="finder-form panel"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ ...prefs });
          }}
        >
          <label className="finder-category">
            بیشتر برای چه کاری؟
            <select
              value={prefs.category}
              onChange={(e) => setPrefs({ ...prefs, category: e.target.value })}
            >
              {taxonomy.data?.categories.map((c) => (
                <option value={c.value} key={c.value}>
                  {c.label}
                </option>
              )) || <option value="running-shoes">دویدن</option>}
            </select>
          </label>
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
              ["light", "سبک · تا ۲۵۰ گرم"],
              ["balanced", "متعادل · ۲۵۰ تا ۳۲۰ گرم"],
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
          <button className="button full" type="submit">
            پیدا کردن گزینه‌ها
          </button>
          <p className="fine-print">
            این ابزار نقطه شروع مقایسه است. تناسب شخصی به شکل پا، سایز و تجربه
            پوشیدن هم بستگی دارد.
          </p>
        </form>
        <div className="finder-explanation panel">
          <span className="eyebrow">پیشنهاد قابل توضیح</span>
          <h2>پشت پیشنهادها چه می‌گذرد؟</h2>
          <div className="ranking-rule">
            <b>۴۰</b>
            <p>
              امتیاز برای کاربری انتخاب‌شده؛ مدل‌های دسته‌های دیگر حذف می‌شوند.
            </p>
          </div>
          <div className="ranking-rule">
            <b>۲۰</b>
            <p>
              برای هر ترجیح منطبقِ عرض، وزن و حس فوم. «فرقی ندارد» امتیاز اضافه
              ندارد.
            </p>
          </div>
          <div className="ranking-rule">
            <b>۰</b>
            <p>
              امتیاز ترجیح، وقتی اندازه ثبت نشده؛ مدل حذف نمی‌شود و کمبود داده
              را می‌بینی.
            </p>
          </div>
          <details>
            <summary>آستانه‌های دقیق قواعد</summary>
            <p>
              جادار: عرض داخلی روش فعلی حداقل ۱۰۰ میلی‌متر؛ متوسط: ۹۴ تا کمتر از
              ۱۰۰. نرم‌تر: Asker C حداکثر ۳۵؛ فقط در نبود آن، Shore A حداکثر ۲۰.
              مقیاس‌ها با هم تبدیل یا میانگین نشده‌اند. این امتیاز احتمال
              سازگاری نیست.
            </p>
          </details>
        </div>
      </div>
      {applied && (
        <section className="finder-results">
          <div className="section-head">
            <div>
              <span className="eyebrow">بر اساس ترجیح‌های ثبت‌شده</span>
              <h2>گزینه‌هایی برای بررسی بیشتر</h2>
            </div>
          </div>
          {result.isPending ? (
            <Loading />
          ) : result.isError ? (
            <ErrorState retry={() => result.refetch()} />
          ) : result.data?.items.length ? (
            <div className="finder-grid">
              {result.data.items.map((item, i) => (
                <div key={item.shoe.shoe_id}>
                  <div className="match-explanation">
                    <b>{fa(item.points)} امتیاز قواعد</b>
                    <p>{item.reasons.join(" · ")}</p>
                  </div>
                  <ShoeCard shoe={item.shoe} index={i} />
                </div>
              ))}
            </div>
          ) : (
            <p className="state-panel">برای این دسته اطلاعات کافی ثبت نشده.</p>
          )}
        </section>
      )}
    </>
  );
}
