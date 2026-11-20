import type { Shoe } from "../lib/types";
import { value } from "../lib/format";
const usage: Record<string, string> = {
  daily_running: "دویدن روزانه",
  tempo: "تمرین سرعت",
  race: "مسابقه",
  stability: "پایداری",
};
const shLabels: Record<string, string> = {
  core_score: "امتیاز اصلی",
  comfort_score: "راحتی",
  durability_score: "دوام",
  performance_score: "عملکرد",
  value_score: "ارزش خرید",
  fit_score: "قالب",
  score_estimated: "برآورد امتیاز طبق ادعای منبع",
};
const materialLabels: Record<string, string> = {
  upper: "رویه",
  insole: "کفی",
  lacing: "بند",
  midsole: "زیره میانی",
  outsole: "زیره خارجی",
  heel_counter: "نگهدارنده پاشنه",
};
const specific: [string, string, string][] = [
  ["toebox_width_mm", "عرض پنجه · تعریف SoleHunt", "mm"],
  ["midsole_hardness_hc", "سختی فوم · Shore C", "HC"],
  ["breathability_score", "امتیاز تهویه · SoleHunt", ""],
  ["outsole_grip_score", "امتیاز چسبندگی · SoleHunt", ""],
  ["flexibility_score", "امتیاز انعطاف · SoleHunt", ""],
  ["energy_return_pct", "بازگشت انرژی گزارش‌شده", "%"],
  ["sustainability_pct", "پایداری محیطی گزارش‌شده", "%"],
];
export function SourceScores({ shoe }: { shoe: Shoe }) {
  const construction = shoe.construction.solehunt as
    Record<string, unknown> | undefined;
  const hasSH = Object.values(shoe.scores.solehunt).some((v) => v != null);
  return (
    <section className="source-scores panel">
      <h2>امتیازها و مشخصات تکمیلی منابع</h2>
      <p className="muted">
        امتیازها برداشت همان منبع‌اند؛ با هم میانگین نشده‌اند. اطلاعات تجمیعی
        SoleHunt، اندازه‌گیری مستقل آزمایشگاه نیست.
      </p>
      <div className="source-score-grid">
        <details>
          <summary>RunRepeat · کاربردها</summary>
          <dl className="spec-list">
            {Object.entries(shoe.scores.runrepeat.usage || {}).map(
              ([key, n]) => (
                <div key={key}>
                  <dt>{usage[key] || key}</dt>
                  <dd dir="ltr">{value(n)} / 100</dd>
                </div>
              ),
            )}
          </dl>
        </details>
        <details>
          <summary>SoleHunt · امتیازهای جداگانه</summary>
          {hasSH ? (
            <dl className="spec-list">
              {Object.entries(shoe.scores.solehunt)
                .filter(([, v]) => v != null)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{shLabels[k] || k}</dt>
                    <dd dir="auto">
                      {typeof v === "boolean" ? (v ? "بله" : "خیر") : value(v)}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="fine-print">امتیازی از این منبع ثبت نشده.</p>
          )}
        </details>
      </div>
      <details>
        <summary>نتایج گزارش‌شده SoleHunt · روش‌های مستقل</summary>
        <p className="fine-print">
          این مقادیر به دلیل تفاوت تعریف یا روش، جای اندازه‌گیری RunRepeat
          ننشسته‌اند. پیوند فیلدبه‌فیلد در داده عمومی این منبع موجود نیست.
        </p>
        <dl className="spec-list">
          {specific.map(([key, title, unit]) => (
            <div key={key}>
              <dt>{title}</dt>
              <dd dir="ltr">
                {value(shoe.solehunt_source_specific[key], unit)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="fine-print">
          تاریخ رکورد:{" "}
          <bdi>{value(shoe.solehunt_source_specific.updated_at)}</bdi>
        </p>
      </details>
      <details>
        <summary>مواد و فناوری‌های گزارش‌شده SoleHunt</summary>
        <dl className="spec-list">
          {Object.entries(materialLabels).map(([k, title]) => (
            <div key={k}>
              <dt>{title}</dt>
              <dd dir="auto">{value(construction?.[k])}</dd>
            </div>
          ))}
        </dl>
      </details>
      {shoe.fit.width_variants.length > 0 && (
        <details>
          <summary>نسخه‌های عرض مجزا در منبع</summary>
          <p className="fine-print">
            این رکوردها جای ابعاد نسخه استاندارد را نگرفته‌اند. عرض پنجه طبق
            تعریف SoleHunt است.
          </p>
          {shoe.fit.width_variants.map((variant, i) => (
            <div className="width-variant" key={i}>
              <h3 dir="auto">{value(variant.name)}</h3>
              <p dir="auto">{value(variant.fit_note)}</p>
              <span>
                عرض‌های اعلام‌شده:{" "}
                <bdi>
                  {Array.isArray(variant.width_options)
                    ? variant.width_options.join(" · ")
                    : "ثبت نشده"}
                </bdi>
              </span>
              <dl className="spec-list">
                <div>
                  <dt>عرض پنجه SoleHunt</dt>
                  <dd dir="ltr">{value(variant.toebox_width_mm, "mm")}</dd>
                </div>
                <div>
                  <dt>ارتفاع پنجه SoleHunt</dt>
                  <dd dir="ltr">{value(variant.toebox_height_mm, "mm")}</dd>
                </div>
              </dl>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
