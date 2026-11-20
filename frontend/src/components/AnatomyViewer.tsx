import { useId, useState } from "react";
import { Layers3, RotateCcw, Layers } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { Shoe } from "../lib/types";
import { anatomyData, type Mode } from "../lib/anatomy";
import { features } from "../lib/features";
import { origins, metricGroups, value, label } from "../lib/format";
const names: Record<Mode, string> = {
  assembled: "ساختار کامل",
  profile: "نمای جانبی",
  fit: "فضای داخلی",
  exploded: "لایه‌های جدا",
};
const colors: Record<string, string> = {
  upper: "#73869B",
  insole: "#C9B598",
  midsole: "#8EAED1",
  plate: "#D6BD94",
  outsole: "#52687D",
};
const labels = Object.fromEntries(metricGroups.flatMap((g) => g.keys));
export function AnatomyViewer({
  shoe,
  compact = false,
  initialMode = "assembled",
}: {
  shoe: Shoe;
  compact?: boolean;
  initialMode?: Mode;
}) {
  const reduce = useReducedMotion();
  const [replay, setReplay] = useState(0);
  const data = anatomyData(shoe),
    s = shoe.summary,
    m = shoe.metrics;
  const [requested, setMode] = useState<Mode>(initialMode),
    [selection, setSelection] = useState("midsole");
  const mode = data.modes.includes(requested) ? requested : data.modes[0];
  const selected =
    data.layers.find((l) => l.key === selection) || data.layers[0];
  const id = useId().replace(/:/g, "");
  if (!mode) return null;
  const {
    toe,
    heel,
    ground,
    rockerX,
    bevelX,
    tipY,
    rearY,
    heelY,
    foreY,
    toeTop,
    scale,
  } = data;
  const dimension = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    text: string,
    key: string,
  ) => (
    <g key={key} className="dimension" data-measurement={key}>
      <path
        d={`M${x1} ${y1} L${x2} ${y2}`}
        markerStart={`url(#arrow-${id})`}
        markerEnd={`url(#arrow-${id})`}
      />
      <text
        x={(x1 + x2) / 2 + (x1 === x2 ? (x1 > 650 ? -13 : 13) : 0)}
        y={(y1 + y2) / 2 - (x1 === x2 ? 0 : 12)}
        textAnchor={x1 === x2 ? (x1 > 650 ? "end" : "start") : "middle"}
        className="svg-data"
        direction="ltr"
      >
        {text}
      </text>
    </g>
  );
  const upper = `M${toe} ${toeTop} Q${toe - 8} ${toeTop - 50} 140 ${toeTop - 48} C250 ${toeTop - 45} 270 ${foreY - 35} 400 ${foreY - 57} Q470 ${heelY - 65} 510 ${heelY - 50} C580 ${heelY - 18} 620 ${heelY - 133} 651 ${heelY - 130} Q680 ${heelY - 123} ${heel} ${rearY - 28} L610 ${heelY} L${Math.max(rockerX, 260)} ${foreY} Q160 ${foreY} ${toe} ${toeTop}Z`;
  // One projection scale for the external platform footprint, separate from internal fit.
  const foreHalf = (s.midsole_width_forefoot_mm || 100) * 0.3;
  const heelHalf = (s.midsole_width_heel_mm || 75) * 0.3;
  const footprint = `M90 48Q78 ${48 - foreHalf * 0.7} 160 ${48 - foreHalf}Q220 ${48 - foreHalf} 330 ${48 - heelHalf}L560 ${48 - heelHalf}Q660 ${48 - heelHalf} 665 48Q660 ${48 + heelHalf} 560 ${48 + heelHalf}L330 ${48 + heelHalf}Q220 ${48 + foreHalf} 160 ${48 + foreHalf}Q78 ${48 + foreHalf * 0.7} 90 48Z`;
  const insoleThickness = m.insole_thickness_mm?.value || 0;
  const outsoleThickness = m.outsole_thickness_mm?.value || 0;
  const clip = `sole-${id}`;
  return (
    <section
      className={`anatomy ${compact ? "compact" : ""} ${features.depth ? "anatomy-depth" : ""}`}
      aria-label="نمای تعاملی ساختار کفش"
    >
      {!compact && (
        <div className="section-head">
          <div>
            <span className="eyebrow">
              <Layers3 size={15} /> از بیرون، به درون
            </span>
            <h2>فرم را ببین. تفاوت را بفهم.</h2>
          </div>
          <span className="tag">شماتیک مبتنی بر داده</span>
        </div>
      )}
      <div className="viewer-toolbar">
        <div className="segmented" role="group" aria-label="حالت نمایش ساختار">
          {data.modes.map((key) => (
            <button
              key={key}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              {names[key]}
            </button>
          ))}
        </div>
        {!compact && data.modes.includes("exploded") && (
          <div className="anatomy-playback">
            <button
              className="button secondary"
              aria-label="بازپخش جداسازی لایه‌ها"
              onClick={() => {
                setMode("exploded");
                setReplay((v) => v + 1);
              }}
            >
              <RotateCcw size={16} /> بازپخش جداسازی
            </button>
            {mode === "exploded" && data.modes.includes("assembled") && (
              <button
                className="button secondary"
                onClick={() => setMode("assembled")}
              >
                <Layers size={16} /> مونتاژ دوباره
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className={`anatomy-content ${["fit", "profile"].includes(mode) ? "wide-canvas" : ""}`}
      >
        <div className="technical-canvas">
          <div className="canvas-caption">
            <span dir="ltr">RAD / {mode.toUpperCase()}</span>
            <span>
              {mode === "fit" ? "اندازه‌های داخل کفش" : "طول مرجع ۳۰۰ میلی‌متر"}
            </span>
          </div>
          <svg
            viewBox={
              ["assembled", "exploded"].includes(mode)
                ? `0 0 760 ${data.layers.length > 4 ? 660 : 550}`
                : "0 0 760 430"
            }
            role={["assembled", "exploded"].includes(mode) ? "group" : "img"}
            aria-label={`طرح ${names[mode]} ${s.name}`}
          >
            <defs>
              <marker
                id={`arrow-${id}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M1 1 L9 5 L1 9" fill="none" stroke="var(--text)" />
              </marker>
              <clipPath id={clip}>
                <path d={data.sole} />
              </clipPath>
              <pattern
                id={`mesh-${id}`}
                width="9"
                height="9"
                patternUnits="userSpaceOnUse"
              >
                <path d="M0 0L9 9M9 0L0 9" stroke="#171B22" strokeWidth=".6" />
              </pattern>
            </defs>
            {mode === "profile" ? (
              <g>
                <path d={`M45 ${ground}H710`} stroke="var(--border)" />
                <path
                  d={upper}
                  fill={mode === "profile" ? "#73869B24" : "#73869B80"}
                  stroke="#73869B"
                  strokeWidth="1.3"
                />
                <path
                  d={data.sole}
                  fill="var(--cool)"
                  stroke="var(--text)"
                  strokeWidth="1.5"
                  data-testid="sole-profile"
                />
                <g clipPath={`url(#${clip})`}>
                  <rect
                    x={toe}
                    y="0"
                    width={Math.max(0, rockerX - toe)}
                    height="400"
                    fill="var(--accent)"
                  />
                </g>
                {dimension(
                  600,
                  heelY,
                  600,
                  ground,
                  `${value(s.heel_stack_mm)} mm`,
                  "heel_stack_mm",
                )}
                {dimension(
                  Math.max(rockerX, 275),
                  foreY,
                  Math.max(rockerX, 275),
                  ground,
                  `${value(s.forefoot_stack_mm)} mm`,
                  "forefoot_stack_mm",
                )}
                <text x="83" y="390" className="svg-label">
                  پنجه
                </text>
                <text x="645" y="390" className="svg-label">
                  پاشنه
                </text>
                {mode === "profile" && (
                  <>
                    {s.drop_mm != null && (
                      <text
                        x="380"
                        y="55"
                        textAnchor="middle"
                        className="svg-data"
                      >{`Drop ${value(s.drop_mm)} mm`}</text>
                    )}
                    {data.rocker && (
                      <>
                        {dimension(
                          toe,
                          360,
                          rockerX,
                          360,
                          `${value(s.toe_rocker_pct)} %`,
                          "toe_rocker_pct",
                        )}
                        {dimension(
                          55,
                          tipY,
                          55,
                          ground,
                          `${value(s.toe_tip_height_mm)} mm`,
                          "toe_tip_height_mm",
                        )}
                        <path
                          d={`M${rockerX} ${ground + 4}v14`}
                          stroke="var(--accent)"
                        />
                      </>
                    )}
                    {data.bevel && (
                      <>
                        {dimension(
                          bevelX,
                          360,
                          heel,
                          360,
                          `${value(s.heel_bevel_pct)} %`,
                          "heel_bevel_pct",
                        )}
                        {dimension(
                          692,
                          rearY,
                          692,
                          ground,
                          `${value(s.heel_bevel_height_mm)} mm`,
                          "heel_bevel_height_mm",
                        )}
                      </>
                    )}
                  </>
                )}
              </g>
            ) : mode === "fit" ? (
              (() => {
                const k = 1.05,
                  center = 335,
                  top = 68,
                  bottom = top + (m.internal_length_mm?.value || 270) * k;
                const foreWidth =
                    (m.interior_forefoot_width_mm?.value || 95) * k,
                  toeWidth = (m.toebox_width_mm?.value || 72) * k;
                const foreAt = top + 95,
                  toeAt = top + 42,
                  heelWidth = foreWidth * 0.64;
                const fitPath = `M${center - heelWidth / 2} ${bottom}Q${center - heelWidth} ${bottom - 12} ${center - foreWidth / 2} ${foreAt}L${center - toeWidth / 2} ${toeAt}Q${center - toeWidth / 2} ${top} ${center} ${top}Q${center + toeWidth / 2} ${top} ${center + toeWidth / 2} ${toeAt}L${center + foreWidth / 2} ${foreAt}Q${center + heelWidth} ${bottom - 12} ${center + heelWidth / 2} ${bottom}Z`;
                return (
                  <g>
                    <path
                      data-testid="fit-outline"
                      d={fitPath}
                      fill="#8EAED118"
                      stroke="var(--cool)"
                      strokeWidth="2"
                    />
                    {m.interior_forefoot_width_mm &&
                      dimension(
                        center - foreWidth / 2,
                        foreAt,
                        center + foreWidth / 2,
                        foreAt,
                        `${value(m.interior_forefoot_width_mm.value)} mm`,
                        "interior_forefoot_width_mm",
                      )}
                    {m.toebox_width_mm &&
                      dimension(
                        center - toeWidth / 2,
                        toeAt,
                        center + toeWidth / 2,
                        toeAt,
                        `${value(m.toebox_width_mm.value)} mm`,
                        "toebox_width_mm",
                      )}
                    {m.internal_length_mm &&
                      dimension(
                        220,
                        top,
                        220,
                        bottom,
                        `${value(m.internal_length_mm.value)} mm`,
                        "internal_length_mm",
                      )}
                    {m.toebox_height_mm && (
                      <g>
                        <path
                          d={`M490 303 Q${550 - toeWidth / 2} ${303 - m.toebox_height_mm.value * k * 2} ${490 + toeWidth} 303Z`}
                          fill="#C7A67A18"
                          stroke="var(--accent)"
                        />
                        {dimension(
                          490 + toeWidth / 2,
                          303 - m.toebox_height_mm.value * k,
                          490 + toeWidth / 2,
                          303,
                          `${value(m.toebox_height_mm.value)} mm`,
                          "toebox_height_mm",
                        )}
                        <text
                          x="550"
                          y="337"
                          textAnchor="middle"
                          className="svg-label"
                        >
                          مقطع داخلی پنجه
                        </text>
                      </g>
                    )}
                    <text
                      x="340"
                      y="406"
                      textAnchor="middle"
                      className="svg-label"
                    >
                      اندازه‌های داخل کفش · فرم راهنما
                    </text>
                  </g>
                );
              })()
            ) : (
              <g>
                {[...data.layers].reverse().map((layer) => {
                  const i = data.layers.findIndex((l) => l.key === layer.key),
                    key = layer.key;
                  const extraY = data.layers.length > 4 ? 65 : 10;
                  const assembled: Record<string, number> = {
                    upper: 169 + extraY,
                    insole: 205 + extraY,
                    midsole: 213 + extraY,
                    plate: 224 + extraY,
                    outsole: 235 + extraY,
                  };
                  const poses = {
                    y: mode === "exploded" ? 85 + i * 110 : assembled[key],
                    x: mode === "exploded" ? (i - 2) * 5 : 0,
                    rotate: mode === "exploded" ? (i - 2) * 0.8 : 0,
                  };
                  return (
                    <motion.g
                      key={`${key}-${replay}`}
                      initial={
                        reduce ? false : { y: assembled[key], x: 0, rotate: 0 }
                      }
                      animate={{
                        ...poses,
                        opacity: selected?.key === key ? 1 : 0.82,
                      }}
                      transition={{
                        duration: reduce ? 0 : 0.82,
                        delay: reduce ? 0 : i * 0.065,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="exploded-layer"
                      data-layer={key}
                      data-pose={mode}
                      role="button"
                      tabIndex={0}
                      aria-label={`لایهٔ ${layer.name} در طرح`}
                      aria-pressed={selected?.key === key}
                      onClick={() => setSelection(key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelection(key);
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        transformOrigin: "380px 48px",
                      }}
                    >
                      {key === "upper" ? (
                        <>
                          <path
                            d="M110 65Q104 17 160 13L337 -6Q405-55 430-25L520-49Q580-60 633 5L657 60Q455 84 110 65Z"
                            fill={colors.upper}
                            stroke="var(--text)"
                          />
                          <path
                            d="M110 65Q104 17 160 13L337 -6Q405-55 430-25L520-49Q580-60 633 5L657 60Q455 84 110 65Z"
                            fill={`url(#mesh-${id})`}
                          />
                        </>
                      ) : key === "midsole" ? (
                        <>
                          <path
                            d={footprint}
                            transform="translate(0 14)"
                            fill="#566E88"
                          />
                          <path
                            d="M92 55L92 69C190 98 340 86 525 85Q640 87 662 61L662 47"
                            fill="#566E88"
                          />
                          <path
                            d={footprint}
                            fill={colors.midsole}
                            stroke="var(--text)"
                          />
                        </>
                      ) : key === "plate" ? (
                        <path
                          d="M124 48Q230 19 430 31L617 32L641 45L426 48L620 64L598 72L415 60Q238 78 124 56Z"
                          fill={colors.plate}
                          stroke="var(--text)"
                        />
                      ) : (
                        <>
                          <path
                            d={footprint}
                            transform={`translate(0 ${(key === "insole" ? insoleThickness : outsoleThickness) * scale})`}
                            data-testid={
                              key === "insole" ? "insole-band" : undefined
                            }
                            data-thickness-mm={
                              key === "insole"
                                ? insoleThickness
                                : outsoleThickness
                            }
                            fill={key === "insole" ? "#7C6C55" : "#273A4E"}
                          />
                          <path
                            d={footprint}
                            fill={colors[key]}
                            stroke="var(--text)"
                          />
                          {key === "outsole" &&
                            Array.from({ length: 12 }, (_, j) => (
                              <path
                                key={j}
                                d={`M${170 + j * 36} 32l-15 34`}
                                stroke="#171B22"
                                strokeWidth="4"
                              />
                            ))}
                        </>
                      )}
                      <text
                        x="40"
                        y="51"
                        className="svg-label"
                        fill="var(--text)"
                        textAnchor="middle"
                      >
                        {mode === "exploded" ? i + 1 : ""}
                      </text>
                    </motion.g>
                  );
                })}
              </g>
            )}
          </svg>
          <div className="canvas-bottom">
            <span>
              {mode === "profile"
                ? "آبی: ارتفاع‌های آزمایشگاهی · گرم: انحنای تخمینی عکس"
                : mode === "fit"
                  ? "عرض داخلی با عرض سطح اتکا متفاوت است"
                  : "ترتیب لایه‌ها؛ فرم اجزا شماتیک است"}
            </span>
            {s.tested_size_raw && (
              <span>
                سایز آزمون <bdi>{s.tested_size_raw}</bdi>
              </span>
            )}
          </div>
        </div>
        {!compact && ["assembled", "exploded"].includes(mode) && selected && (
          <aside className="layer-inspector">
            <span className="eyebrow">لایه را انتخاب کن</span>
            <div className="layer-buttons">
              {data.layers.map((l) => (
                <button
                  key={l.key}
                  aria-label={`انتخاب ${l.name}`}
                  aria-pressed={selected.key === l.key}
                  onClick={() => setSelection(l.key)}
                >
                  <span
                    style={{ background: colors[l.key] }}
                    className="legend-dot"
                  />
                  {l.name}
                </button>
              ))}
            </div>
            <div className="inspector-detail" aria-live="polite">
              <h3>{selected.name}</h3>
              {selected.material && (
                <p dir="auto">{label(selected.material)}</p>
              )}
              {selected.keys.map((k) => (
                <div className="inspector-metric" key={k}>
                  <span>{labels[k] || k}</span>
                  <b dir="ltr">{value(m[k].value, m[k].unit)}</b>
                  <small>{origins[m[k].origin]}</small>
                </div>
              ))}
              {selected.key === "midsole" && (
                <small>ارتفاع پاشنه و پنجه مربوط به کل زیره است.</small>
              )}
            </div>
          </aside>
        )}
      </div>
      {!compact && mode === "profile" && (
        <div className="fit-facts">
          {[
            "heel_stack_mm",
            "forefoot_stack_mm",
            "drop_mm",
            "toe_rocker_pct",
            "toe_tip_height_mm",
            "heel_bevel_pct",
            "heel_bevel_height_mm",
          ]
            .filter((k) => m[k]?.value != null)
            .map((k) => (
              <span key={k}>
                {labels[k]} <bdi>{value(m[k].value, m[k].unit)}</bdi>
              </span>
            ))}
        </div>
      )}
      {!compact && mode === "fit" && (
        <div className="fit-facts">
          {data.fit.map((k) => (
            <span key={k}>
              {labels[k]} <bdi>{value(m[k].value, "mm")}</bdi>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
