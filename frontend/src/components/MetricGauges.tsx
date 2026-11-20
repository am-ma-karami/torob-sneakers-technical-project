import { motion, useReducedMotion } from "motion/react";
import type { Shoe } from "../lib/types";
import { origins, value } from "../lib/format";
export function MetricGauges({ shoe }: { shoe: Shoe }) {
  const reduce = useReducedMotion();
  const gauges = [
    {
      key: "energy_return_heel_pct",
      title: "بازگشت انرژی پاشنه",
      max: 100,
      left: "بازگشت کمتر",
      right: "بازگشت بیشتر",
      note: "درصد انرژی برگشتی در آزمایش",
    },
    {
      key: "midsole_firmness_asker_c",
      title: "سفتی فوم · Asker C",
      max: 100,
      left: "نرم‌تر",
      right: "سفت‌تر",
      note: "مقیاس سختی ۰–۱۰۰؛ با Shore A یکی نیست",
    },
    {
      key: "bending_force_30deg_n",
      title: "انعطاف در ۳۰ درجه",
      max: 50,
      left: "منعطف‌تر",
      right: "سفت‌تر",
      note: "نیروی خم‌کردن؛ مقیاس نمایش ۰–۵۰ N",
    },
  ];
  const available = gauges.filter((g) => shoe.metrics[g.key]?.value != null);
  if (!available.length) return null;
  return (
    <section className="gauge-section">
      <div className="section-head">
        <div>
          <span className="eyebrow">حس حرکت، با اعداد قابل پیگیری</span>
          <h2>حس حرکت</h2>
        </div>
      </div>
      <div className="gauge-grid">
        {available.map((g) => {
          const metric = shoe.metrics[g.key];
          return (
            <div key={g.key} className="gauge-card">
              <h3>{g.title}</h3>
              <strong dir="ltr">{value(metric?.value, metric?.unit)}</strong>
              <div className="gauge-track" aria-hidden="true">
                {metric && (
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{
                      scaleX: Math.min(1, Math.max(0, metric.value / g.max)),
                    }}
                    transition={{ duration: reduce ? 0 : 0.5 }}
                  />
                )}
              </div>
              <div className="gauge-endpoints">
                <span>{g.left}</span>
                <span>{g.right}</span>
              </div>
              <p>{g.note}</p>
              <small>
                {metric
                  ? `${origins[metric.origin] || ""}`
                  : "اندازه‌گیری ثبت نشده"}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
