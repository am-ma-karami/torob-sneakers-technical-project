import type { Summary } from "../../lib/types";
import { formatNumber } from "../../lib/format";
import { ShoeCard } from "../ShoeCard";
import { ErrorState } from "../Shared";
const labels: Record<string, string> = {
  brand: "برند",
  category: "کاربری",
  weight_min: "حداقل وزن",
  weight_max: "حداکثر وزن",
  drop_min: "حداقل دراپ",
  drop_max: "حداکثر دراپ",
  weight: "ترجیح وزن",
  width: "فضای جلوی پا",
  cushion: "حس فوم",
  surface: "مسیر",
  usage: "کاربرد",
  breathability: "تنفس‌پذیری",
  durability: "دوام زیره",
  flexibility: "انعطاف",
  cushioning: "جذب ضربه",
  numeric_range: "بازهٔ عددی",
};
const values: Record<string, string> = {
  light: "سبک",
  balanced: "متعادل",
  wide: "جادار",
  regular: "متوسط",
  soft: "نرم",
  firm: "سفت",
  road: "آسفالت",
  trail: "طبیعت",
  jogging: "دویدن روزانه",
  walking: "پیاده‌روی",
  treadmill: "تردمیل",
  hiking: "طبیعت‌گردی",
  gym: "باشگاه",
  high: "بیشتر",
  "running-shoes": "دویدن",
  "walking-shoes": "پیاده‌روی",
  "all-day wear": "روزمره",
};
function display(value: unknown): string {
  if (Array.isArray(value)) return value.map(display).join("، ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .filter(([k]) => !k.endsWith("exclusive"))
      .map(([k, v]) => `${labels[k] ?? k}: ${display(v)}`)
      .join("، ");
  return values[String(value)] ?? String(value ?? "نامشخص");
}
export type SearchResult = {
  items: (Summary & {
    search_explanation: string;
    match_score?: number | null;
    data_coverage?: number | null;
    missing_data?: string[];
  })[];
  mode: string;
  status: string;
  degraded_reason?: string | null;
  applied_hard_filters?: Record<string, unknown>;
  applied_preferences?: Record<string, unknown>;
  conflicts?: {
    field: string;
    blocking: boolean;
    manual?: unknown;
    text?: unknown;
  }[];
  unsupported_requirements?: string[];
  suggested_adjustments?: { field: string; products_if_removed: number }[];
};
export function FinderResults({
  data,
  loading,
  error,
  retry,
  edit,
  onManual,
}: {
  data?: SearchResult;
  loading: boolean;
  error: boolean;
  retry: () => void;
  edit: () => void;
  onManual: () => void;
}) {
  const unavailable =
    data?.status === "intent_unavailable" ||
    data?.status === "manual_filter_only";
  return (
    <section
      id="finder-results"
      className="finder-results"
      tabIndex={-1}
      aria-labelledby="finder-results-title"
      aria-busy={loading}
    >
      <div className="section-head">
        <div>
          <span className="eyebrow">انتخاب‌های تو، کنار هم</span>
          <h2 id="finder-results-title">گزینه‌هایی برای مقایسه</h2>
        </div>
        <button className="finder-text-action" onClick={edit}>
          اصلاح درخواست
        </button>
      </div>
      {loading ? (
        <div className="finder-feedback" role="status">
          <span className="finder-loading" aria-hidden="true" />
          <h3>
            {data?.mode === "advanced"
              ? "در حال بررسی مشخصات کفش‌ها…"
              : "در حال بررسی درخواست و مشخصات کفش‌ها…"}
          </h3>
          <p>پس از دریافت پاسخ، نتیجه‌ها همین‌جا نمایش داده می‌شوند.</p>
        </div>
      ) : error ? (
        <ErrorState retry={retry} />
      ) : (
        data && (
          <>
            <div className="finder-requirements panel">
              <h3>شرط‌ها و ترجیح‌های اعمال‌شده</h3>
              <div className="finder-requirement-chips">
                {[
                  ...Object.entries(data.applied_hard_filters ?? {}).map(
                    ([key, value]) => ({ key, value, hard: true }),
                  ),
                  ...Object.entries(data.applied_preferences ?? {}).map(
                    ([key, value]) => ({ key, value, hard: false }),
                  ),
                ]
                  .filter(
                    ({ key }) =>
                      key !== "priorities" && !key.endsWith("_exclusive"),
                  )
                  .map(({ key, value, hard }) => (
                    <span key={`${hard}-${key}`}>
                      <small>{hard ? "ضروری" : "ترجیح"}</small>{" "}
                      {labels[key] ?? key}:{" "}
                      <bdi>
                        {display(value)}
                        {key.startsWith("weight_")
                          ? " g"
                          : key.startsWith("drop_")
                            ? " mm"
                            : ""}
                      </bdi>
                      {data.applied_hard_filters?.[key + "_exclusive"] ===
                        true && " (مرز غیرشامل)"}
                    </span>
                  ))}
              </div>
              <button
                type="button"
                className="finder-text-action"
                onClick={edit}
              >
                ویرایش شرط‌ها و توضیح
              </button>
            </div>
            {unavailable && (
              <div className="finder-feedback" role="alert">
                <h3>بررسی هوشمند در دسترس نیست</h3>
                <p>
                  {data.status === "manual_filter_only"
                    ? "متن درخواست بررسی نشد؛ فقط نتیجه‌های فیلترهای دستی نمایش داده می‌شوند."
                    : "درخواست متنی قابل بررسی نبود؛ نتیجه‌ای بدون بررسی شرط‌ها نمایش داده نشده است."}
                </p>
                <button className="finder-text-action" onClick={retry}>
                  تلاش دوباره
                </button>
                <button className="finder-text-action" onClick={onManual}>
                  ادامه با جست‌وجوی پیشرفته
                </button>
              </div>
            )}
            {data.status === "ok" && data.degraded_reason && (
              <p role="status" className="semantic-notice">
                شباهت معنایی در دسترس نیست؛ شرط‌ها بررسی شده‌اند و ترتیب بر اساس
                شواهد قابل بررسی است.
              </p>
            )}
            {!!data.conflicts?.length && (
              <div className="finder-feedback" role="alert">
                <h3>این انتخاب‌ها نیاز به بازبینی دارند</h3>
                <ul>
                  {data.conflicts.map((c, i) => (
                    <li key={i}>
                      {labels[c.field] ?? c.field} — انتخاب دستی:{" "}
                      {display(c.manual)}؛ متن: {display(c.text)}.{" "}
                      {c.blocking
                        ? "این دو شرط هم‌زمان قابل اعمال نیستند."
                        : "ترجیح دستی اعمال شده است."}
                    </li>
                  ))}
                </ul>
                <button className="finder-text-action" onClick={edit}>
                  اصلاح شرط یا متن
                </button>
              </div>
            )}
            {data.status === "unsupported_requirements" && (
              <div className="finder-feedback" role="alert">
                <h3>بخشی از درخواست قابل بررسی نیست</h3>
                <ul>
                  {data.unsupported_requirements?.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                <button className="finder-text-action" onClick={edit}>
                  دقیق‌تر کردن درخواست
                </button>
              </div>
            )}
            <p role="status">
              {formatNumber(data.items.length)} گزینه برای مقایسه
            </p>
            <div className="finder-grid">
              {data.items.map((shoe, index) => (
                <div className="finder-result" key={shoe.shoe_id}>
                  {(data.mode !== "advanced" ||
                    (typeof shoe.match_score === "number" &&
                      Number.isFinite(shoe.match_score) &&
                      shoe.match_score >= 0 &&
                      shoe.match_score <= 100)) && (
                    <div className="match-explanation">
                      <div className="finder-scoreline">
                        {typeof shoe.match_score === "number" &&
                          Number.isFinite(shoe.match_score) &&
                          shoe.match_score >= 0 &&
                          shoe.match_score <= 100 && (
                            <strong>
                              امتیاز ترجیح‌ها{" "}
                              <bdi dir="ltr">
                                {formatNumber(shoe.match_score)} / 100
                              </bdi>
                            </strong>
                          )}
                      </div>
                      {data.mode !== "advanced" && (
                        <>
                          <h3>چرا این کفش بهت پیشنهاد شده؟</h3>
                          <p>{shoe.search_explanation}</p>
                          {!!shoe.missing_data?.length && (
                            <small>
                              دادهٔ ناموجود:{" "}
                              {shoe.missing_data
                                .map((k) => labels[k] ?? k)
                                .join("، ")}
                            </small>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <ShoeCard shoe={shoe} index={index} />
                </div>
              ))}
            </div>
            {!!data.items.length && (
              <p className="fine-print">
                امتیاز ترجیح‌ها بر پایهٔ داده‌هاست؛ احتمال راحتی یا تناسب پا
                نیست.
              </p>
            )}
            {data.status === "no_matches" && (
              <div className="finder-feedback finder-empty">
                <h3>کفشی مطابق با همه شرایطت پیدا نکردیم.</h3>
                <p>هیچ شرطی خودکار تغییر نکرده است.</p>
                {data.suggested_adjustments?.map((a) => (
                  <p key={a.field}>
                    با حذف «{labels[a.field] ?? a.field}»،{" "}
                    {formatNumber(a.products_if_removed)} گزینه از نظر شرط‌های
                    ضروری در دسترس است.
                  </p>
                ))}
                <button className="finder-text-action" onClick={edit}>
                  بازبینی انتخاب‌ها
                </button>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
