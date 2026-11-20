import type { Shoe } from "../lib/types";
import { value } from "../lib/format";
const materialLabels: Record<string, string> = {
  upper: "رویه",
  insole: "کفی",
  lacing: "بند",
  midsole: "زیره میانی",
  outsole: "زیره خارجی",
  heel_counter: "نگهدارنده پاشنه",
};
const specific: [string, string, string][] = [
  ["toebox_width_mm", "عرض پنجه · گزارش تجمیعی", "mm"],
  ["midsole_hardness_hc", "سختی فوم · Shore C", "HC"],
  ["breathability_score", "تهویه گزارش‌شده", ""],
  ["outsole_grip_score", "چسبندگی گزارش‌شده", ""],
  ["flexibility_score", "انعطاف گزارش‌شده", ""],
  ["energy_return_pct", "بازگشت انرژی گزارش‌شده", "%"],
  ["sustainability_pct", "پایداری محیطی گزارش‌شده", "%"],
];
export function SourceScores({ shoe }: { shoe: Shoe }) {
  const construction = shoe.construction.solehunt as
    Record<string, unknown> | undefined;
  const materials = Object.entries(materialLabels).filter(
    ([k]) => construction?.[k] != null && construction[k] !== "",
  );
  const rows = specific.filter(
    ([k]) => shoe.solehunt_source_specific[k] != null,
  );
  const scoreLabels: Record<string, string> = {
    core_score: "امتیاز کلی تکمیلی",
    comfort_score: "راحتی",
    durability_score: "دوام",
    performance_score: "عملکرد",
    value_score: "ارزش خرید",
    fit_score: "قالب",
  };
  const scores = Object.entries(scoreLabels).filter(
    ([k]) => typeof shoe.scores.solehunt[k] === "number",
  );
  if (
    !materials.length &&
    !rows.length &&
    !scores.length &&
    !shoe.fit.width_variants.length
  )
    return null;
  return (
    <section className="source-scores panel">
      <h2>مواد و مشخصات تکمیلی</h2>
      {materials.length > 0 && (
        <details>
          <summary>مواد و فناوری‌ها</summary>
          <dl className="spec-list">
            {materials.map(([k, title]) => (
              <div key={k}>
                <dt>{title}</dt>
                <dd dir="auto">{value(construction?.[k])}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {scores.length > 0 && (
        <details>
          <summary>ارزیابی تکمیلی · مقیاس مستقل</summary>
          <p className="fine-print">
            این ارزیابی با امتیاز کاربردها ترکیب نشده است.
            {shoe.scores.solehunt.score_estimated
              ? " اعداد این بخش برآوردی‌اند."
              : ""}
          </p>
          <dl className="spec-list">
            {scores.map(([k, title]) => (
              <div key={k}>
                <dt>{title}</dt>
                <dd dir="ltr">{value(shoe.scores.solehunt[k])}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {shoe.fit.width_variants.length > 0 && (
        <details>
          <summary>نسخه‌های عرض دیگر</summary>
          {shoe.fit.width_variants.map((variant, i) => (
            <div className="width-variant" key={i}>
              {variant.name != null && (
                <h3 dir="auto">{String(variant.name)}</h3>
              )}
              <dl className="spec-list">
                {[
                  ["toebox_width_mm", "عرض پنجه گزارش‌شده"],
                  ["toebox_height_mm", "ارتفاع پنجه گزارش‌شده"],
                ]
                  .filter(([k]) => variant[k] != null)
                  .map(([k, title]) => (
                    <div key={k}>
                      <dt>{title}</dt>
                      <dd dir="ltr">{value(variant[k], "mm")}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))}
        </details>
      )}
      {rows.length > 0 && (
        <details>
          <summary>گزارش‌های تجمیعی · روش مستقل</summary>
          <p className="fine-print">
            این اندازه‌ها با روش جداگانه گزارش شده‌اند و جای نتایج آزمایشگاهی
            ننشسته‌اند.
          </p>
          <dl className="spec-list">
            {rows.map(([k, title, unit]) => (
              <div key={k}>
                <dt>{title}</dt>
                <dd dir="ltr">
                  {value(shoe.solehunt_source_specific[k], unit)}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
