import { useQuery } from "@tanstack/react-query";
import type { Shoe, ScoreContext } from "../lib/types";
import { api } from "../lib/api";
import { formatNumber, label } from "../lib/format";
const usage: Record<string, string> = {
  daily_running: "دویدن روزانه",
  tempo: "تمرین سرعت",
  race: "مسابقه",
  stability: "پایداری",
  cushioning: "ضربه‌گیری",
  speed: "سرعت",
  gravel: "مسیر شنی",
  versatile: "کاربردهای متنوع",
  technical: "مسیر فنی",
  durability: "دوام",
  urban: "شهر",
  day_hiking: "پیمایش یک‌روزه",
  backpacking: "کوله‌گردی",
  outdoor: "فضای باز",
  cross_training_hiit: "تمرین ترکیبی و پرفشار",
  cardio: "هوازی",
  weightlifting: "وزنه‌برداری",
  all_day_wear: "استفاده روزانه",
  travel: "سفر",
  sprint: "دوی سرعت",
  middle_distance: "دو نیمه‌استقامت",
  long_distance: "دو استقامت",
  water_hiking: "پیمایش در آب",
};
export function ScorePanel({ shoe }: { shoe: Shoe }) {
  const query = useQuery({
    queryKey: ["scores", shoe.slug],
    queryFn: ({ signal }) =>
      api<ScoreContext>(`/shoes/${shoe.slug}/scores`, signal),
    staleTime: 600000,
  });
  const rows =
    query.data?.rows ||
    Object.entries(shoe.scores.runrepeat.usage || {})
      .filter(([, n]) => n != null)
      .map(([key, value]) => ({ key, value, unit: "%", distribution: null }));
  if (!rows.length) return null;
  return (
    <section className="score-panel panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">انتخاب، متناسب با کاربرد</span>
          <h2>کجا بهتر همراهت می‌شود؟</h2>
        </div>
        <span className="tag">{label(shoe.summary.categories[0])}</span>
      </div>
      <div className="score-rows">
        {rows.map((row) => {
          const d = row.distribution,
            max = d ? Math.max(1, ...d.bins) : 1;
          return (
            <div className="score-row" key={row.key}>
              <div className="score-row-title">
                <h3>{usage[row.key] || row.key.replaceAll("_", " ")}</h3>
                <strong dir="ltr">
                  {formatNumber(row.value)}
                  <small> / 100</small>
                </strong>
              </div>
              {d ? (
                <div>
                  <div
                    className="histogram"
                    role="img"
                    aria-label={`توزیع واقعی ${usage[row.key] || row.key}؛ صدک ${formatNumber(d.percentile)} در ${formatNumber(d.population_size)} مدل`}
                  >
                    <div className="histogram-bars">
                      {d.bins.map((n, i) => (
                        <span
                          key={i}
                          style={{ height: `${(n / max) * 100}%` }}
                          title={`${i * 10}–${(i + 1) * 10}: ${n}`}
                        />
                      ))}
                    </div>
                    <span
                      className="histogram-marker"
                      style={{
                        left: `${Math.max(0, Math.min(100, row.value))}%`,
                      }}
                    />
                  </div>
                  <p className="fine-print">
                    صدک {formatNumber(d.percentile)} ·{" "}
                    {formatNumber(d.population_size)} مدل هم‌دسته
                  </p>
                </div>
              ) : (
                <div className="score-track">
                  <span style={{ width: `${row.value}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rows.some((r) => r.distribution) && (
        <p className="fine-print">
          توزیع تجربی همین کاتالوگ؛ فقط امتیاز همان کاربرد، روش و دسته مقایسه
          شده است. صدک با رتبهٔ میانی امتیازهای مساوی محاسبه می‌شود.
        </p>
      )}
    </section>
  );
}
