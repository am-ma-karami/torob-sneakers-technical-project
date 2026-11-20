import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Layers3, RotateCcw, Ruler, ScanLine, Info } from "lucide-react";
import type { Shoe } from "../lib/types";
import { origins, value } from "../lib/format";

type Mode = "assembled" | "exploded" | "profile" | "fit";
const modes: { key: Mode; label: string }[] = [
  { key: "assembled", label: "ساختار کامل" },
  { key: "exploded", label: "لایه‌های جدا" },
  { key: "profile", label: "نمای جانبی" },
  { key: "fit", label: "فضای داخلی" },
];
const layerNames: Record<string, string> = {
  upper: "رویه",
  insole: "کفی داخلی",
  midsole: "فوم میانی",
  plate: "صفحه تقویتی",
  outsole: "زیره خارجی",
};
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function AnatomyViewer({
  shoe,
  compact = false,
  initialMode = "assembled",
}: {
  shoe: Shoe;
  compact?: boolean;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selected, setSelected] = useState("midsole");
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const s = shoe.summary,
    m = shoe.metrics;
  const hasStacks =
    typeof s.heel_stack_mm === "number" &&
    typeof s.forefoot_stack_mm === "number";
  const heel = hasStacks ? clamp(s.heel_stack_mm!, 0, 80) * 1.6 : 0;
  const fore = hasStacks ? clamp(s.forefoot_stack_mm!, 0, 80) * 1.6 : 0;
  const hasRocker =
    hasStacks && s.toe_rocker_pct != null && s.toe_tip_height_mm != null;
  const rocker = hasRocker ? clamp(s.toe_rocker_pct!, 1, 85) : 0;
  const tip = hasRocker ? clamp(s.toe_tip_height_mm!, 0, 100) * 1.6 : 0;
  const bevel =
    hasRocker && s.heel_bevel_pct != null && s.heel_bevel_height_mm != null;
  const bevelX = bevel
    ? 110 + (480 * clamp(s.heel_bevel_pct!, 0, 40)) / 100
    : 110;
  const bevelY = bevel ? clamp(s.heel_bevel_height_mm!, 0, 70) * 1.6 : 0;
  const onset = 590 - (480 * rocker) / 100;
  const top = `M110 ${330 - heel} L${hasRocker ? onset : 590} ${330 - fore} ${hasRocker ? `Q555 ${330 - fore} 590 ${330 - tip - 14}` : ""}`;
  const bottom = hasRocker
    ? `L590 ${330 - tip} Q555 330 ${onset} 330 L${bevelX} 330 Q110 330 110 ${330 - bevelY} Z`
    : `L590 330 L110 330 Z`;
  const sole = top + bottom;
  // Platform breadth controls the projected construction footprint. This is not
  // an internal fit outline or a reconstructed factory last.
  const platformFore =
    typeof s.midsole_width_forefoot_mm === "number"
      ? clamp(s.midsole_width_forefoot_mm, 50, 160) * 0.38
      : 43;
  const platformHeel =
    typeof s.midsole_width_heel_mm === "number"
      ? clamp(s.midsole_width_heel_mm, 40, 140) * 0.38
      : 35;
  const outline = `M110 300 C100 ${300 - platformHeel * 0.6} 124 ${300 - platformHeel} 172 ${300 - platformHeel} L436 ${300 - platformFore} C516 ${300 - platformFore} 594 ${300 - platformFore * 0.75} 599 292 C605 ${300 + platformFore * 0.5} 539 ${300 + platformFore * 0.85} 466 ${300 + platformFore * 0.85} L175 ${300 + platformHeel * 0.9} C131 ${300 + platformHeel * 0.9} 112 318 110 300 Z`;
  const upper = `M112 ${321 - heel} C109 ${275 - heel} 103 ${224 - heel} 137 ${217 - heel} C177 ${211 - heel} 170 ${265 - heel} 218 ${254 - heel} L290 ${229 - heel} C325 ${218 - heel} 347 ${268 - fore} 405 ${274 - fore} L548 ${288 - tip * 0.35} Q604 ${297 - tip * 0.3} 592 ${320 - tip * 0.3} L${hasRocker ? onset : 485} ${330 - fore} L110 ${330 - heel} Z`;
  const plateKnown =
    s.plate != null && s.plate !== "none" && s.plate !== "False";
  const layers = [
    "outsole",
    ...(plateKnown ? ["plate"] : []),
    "midsole",
    "insole",
    "upper",
  ];
  const offsets: Record<string, number> = {
    upper: -125,
    insole: -50,
    midsole: 35,
    plate: 70,
    outsole: 105,
  };
  const fill: Record<string, string> = {
    upper: "#e9edf4",
    insole: "#d8e4ff",
    midsole: "#f8fbff",
    plate: "#516179",
    outsole: "#9dacc0",
  };
  const getMetric = (key: string) => m[key];
  const detailKeys: Record<string, string[]> = {
    upper: ["breathability_br", "breathability_score_5"],
    insole: ["insole_thickness_mm"],
    midsole: [
      "heel_stack_mm",
      "forefoot_stack_mm",
      "midsole_firmness_asker_c",
      "midsole_softness_shore_a",
    ],
    plate: [],
    outsole: [
      "outsole_thickness_mm",
      "traction_coefficient",
      "outsole_wear_mm",
    ],
  };
  const materials: Record<string, string | null> = {
    upper: s.upper_material,
    insole:
      s.removable_insole == null
        ? null
        : s.removable_insole
          ? "کفی قابل جداسازی"
          : "کفی غیرقابل جداسازی",
    midsole: s.foam,
    plate: s.plate,
    outsole: s.outsole_material,
  };
  const metricLabels: Record<string, string> = {
    heel_stack_mm: "ارتفاع کل زیره در پاشنه",
    forefoot_stack_mm: "ارتفاع کل زیره در پنجه",
    midsole_firmness_asker_c: "سفتی Asker C",
    midsole_softness_shore_a: "سفتی Shore A",
    insole_thickness_mm: "ضخامت کفی",
    outsole_thickness_mm: "ضخامت زیره خارجی",
    traction_coefficient: "ضریب اصطکاک",
    outsole_wear_mm: "سایش آزمایشگاهی",
    breathability_br: "تهویه BR",
    breathability_score_5: "تهویه روش قدیمی",
  };
  return (
    <section
      className={`anatomy ${compact ? "compact" : ""}`}
      aria-label="نمای تعاملی ساختار کفش"
    >
      {!compact && (
        <div className="section-head">
          <div>
            <span className="eyebrow">
              <Layers3 size={15} /> از بیرون، به درون
            </span>
            <h2>ساختار کفش را کشف کن.</h2>
          </div>
          <span className="tag">شماتیک مبتنی بر داده</span>
        </div>
      )}
      <div className="viewer-toolbar">
        <div className="segmented" role="group" aria-label="حالت نمایش ساختار">
          {modes.map((v) => (
            <button
              key={v.key}
              aria-pressed={mode === v.key}
              onClick={() => setMode(v.key)}
            >
              {mode === v.key && (
                <motion.span
                  layoutId={`mode-${uid}`}
                  className="segment-active"
                  transition={{ duration: reduce ? 0 : 0.22 }}
                />
              )}
              <span>{v.label}</span>
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="بازنشانی ساختار"
          onClick={() => {
            setMode("assembled");
            setSelected("midsole");
          }}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div className="anatomy-content">
        <div className="technical-canvas">
          <div className="canvas-caption">
            <span dir="ltr">RAD / ANATOMY</span>
            <span>
              {mode === "fit"
                ? "اندازه‌های فضای داخلی"
                : mode === "profile"
                  ? "ابعاد و هندسه"
                  : mode === "exploded"
                    ? "ساختار تفکیک‌شده"
                    : "ساختار مونتاژشده"}
            </span>
          </div>
          <svg
            viewBox="0 0 740 455"
            role="group"
            aria-label={`طرح شماتیک ${s.name}، ${modes.find((x) => x.key === mode)?.label}`}
          >
            <defs>
              <pattern
                id={`mesh-${uid}`}
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r=".7" fill="#71819a" opacity=".5" />
              </pattern>
              <linearGradient id={`foam-${uid}`} x2="0" y2="1">
                <stop stopColor="#fff" />
                <stop offset="1" stopColor="#dbe5f5" />
              </linearGradient>
              <filter id={`shadow-${uid}`}>
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>
            {mode === "fit" ? (
              <g className="fit-diagram" transform="translate(12 -15)">
                <path
                  d="M260 350 C211 333 207 280 224 220 C238 166 228 91 278 74 C335 51 398 79 410 134 C421 185 395 240 388 288 C380 348 338 374 260 350Z"
                  fill="#eaf0ff"
                  stroke="#8ca2c5"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                />
                <text x="315" y="410" textAnchor="middle" className="svg-label">
                  طرح داخلی شماتیک · مرز بیرونی کفش نیست
                </text>
                {[
                  {
                    key: "interior_forefoot_width_mm",
                    y: 170,
                    x: 228,
                    w: 180,
                    title: "عرض جلوی پا",
                  },
                  {
                    key: "toebox_width_mm",
                    y: 110,
                    x: 260,
                    w: 132,
                    title: "فضای شست",
                  },
                ].map(({ key, y, x, title }) => (
                  <g key={key}>
                    <path
                      d={
                        typeof s[key] === "number"
                          ? `M${x} ${y - 8} v16 M${x} ${y} h${clamp(Number(s[key]), 0, 140) * 1.5} M${x + clamp(Number(s[key]), 0, 140) * 1.5} ${y - 8} v16`
                          : undefined
                      }
                      stroke="#2458d3"
                      fill="none"
                    />
                    <text x={485} y={y} className="svg-data">
                      {value(s[key], "mm")}
                    </text>
                    <text x={485} y={y + 22} className="svg-label">
                      {title}
                    </text>
                  </g>
                ))}
                <text x="490" y="270" className="svg-data">
                  {value(s.toebox_height_mm, "mm")}
                </text>
                <text x="490" y="294" className="svg-label">
                  ارتفاع داخلی پنجه
                </text>
                {typeof s.toebox_height_mm === "number" && (
                  <ellipse
                    cx="315"
                    cy="295"
                    rx={
                      typeof s.toebox_width_mm === "number"
                        ? clamp(s.toebox_width_mm, 0, 140) * 0.7
                        : 50
                    }
                    ry={clamp(s.toebox_height_mm, 0, 70) * 0.8}
                    fill="#d8e4ff"
                    stroke="#8ca2c5"
                  />
                )}
                <text x="315" y="355" textAnchor="middle" className="svg-label">
                  مقطع پنجه · شماتیک
                </text>
                <text x="490" y="340" className="svg-label">
                  سایز آزمون: {s.tested_size_raw || "ثبت نشده"}
                </text>
              </g>
            ) : mode === "profile" ? (
              <g>
                {hasStacks ? (
                  <>
                    <path
                      d={sole}
                      fill={`url(#foam-${uid})`}
                      stroke="#2458d3"
                      strokeWidth="2"
                    />
                    <path
                      d={`M110 355 V${330 - heel} M100 ${330 - heel} h20 M100 330 h20 M475 355 V${330 - fore} M465 ${330 - fore} h20 M465 330 h20`}
                      fill="none"
                      stroke="#566a88"
                      strokeDasharray="3 4"
                    />
                    <text
                      x="110"
                      y="385"
                      textAnchor="middle"
                      className="svg-data"
                    >
                      {value(s.heel_stack_mm, "mm")}
                    </text>
                    <text
                      x="475"
                      y="385"
                      textAnchor="middle"
                      className="svg-data"
                    >
                      {value(s.forefoot_stack_mm, "mm")}
                    </text>
                    {hasRocker && (
                      <>
                        <circle cx={onset} cy="330" r="5" fill="#2458d3" />
                        <path
                          d={`M${onset} 340 V410 H590 V${330 - tip}`}
                          stroke="#2458d3"
                          strokeDasharray="3 4"
                          fill="none"
                        />
                        <text
                          x="590"
                          y="180"
                          textAnchor="middle"
                          className="svg-label"
                        >
                          {value(s.toe_rocker_pct, "%")} rocker
                        </text>
                      </>
                    )}
                    <text
                      x="350"
                      y="150"
                      textAnchor="middle"
                      className="svg-data"
                    >
                      {value(s.drop_mm, "mm")} DROP
                    </text>
                    <text
                      x="350"
                      y="438"
                      textAnchor="middle"
                      className="svg-label"
                    >
                      {hasRocker
                        ? "تخمین عکس · طول مرجع 300 mm · منحنی شماتیک"
                        : "داده راکر ثبت نشده؛ فقط مقطع ساده ابعاد"}
                    </text>
                  </>
                ) : (
                  <text
                    x="370"
                    y="240"
                    textAnchor="middle"
                    className="svg-label"
                  >
                    ارتفاع زیره ثبت نشده؛ منحنی اندازه‌گیری‌شده نمایش داده
                    نمی‌شود.
                  </text>
                )}
              </g>
            ) : (
              <>
                <ellipse
                  cx="370"
                  cy="386"
                  rx="220"
                  ry="13"
                  fill="#203759"
                  opacity=".09"
                  filter={`url(#shadow-${uid})`}
                />
                {mode === "exploded" &&
                  [140, 550].map((x) => (
                    <path
                      key={x}
                      d={`M${x} 60 V430`}
                      stroke="#9aaecb"
                      strokeDasharray="3 6"
                    />
                  ))}
                <g transform="translate(30 -15) rotate(-7 350 280) skewX(-7)">
                  {layers.map((key) => (
                    <motion.g
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-label={`انتخاب ${layerNames[key]}`}
                      aria-pressed={selected === key}
                      onClick={() => setSelected(key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(key);
                        }
                      }}
                      animate={{
                        y:
                          mode === "exploded"
                            ? offsets[key]
                            : key === "insole"
                              ? -9
                              : key === "outsole"
                                ? 8
                                : 0,
                      }}
                      transition={{
                        duration: reduce ? 0 : 0.5,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={`shoe-layer ${selected === key ? "selected" : ""}`}
                    >
                      {key === "upper" ? (
                        <>
                          <path
                            d={upper}
                            fill={fill[key]}
                            stroke={selected === key ? "#2458d3" : "#7e90aa"}
                            strokeWidth="1.4"
                          />
                          <path
                            d={upper}
                            fill={`url(#mesh-${uid})`}
                            opacity=".6"
                          />
                          <path
                            d={`M142 ${230 - heel} Q146 ${275 - heel} 209 ${263 - heel} L276 ${240 - heel}`}
                            fill="none"
                            stroke="#657d9f"
                            strokeWidth="4"
                          />
                          {[0, 1, 2, 3, 4].map((i) => (
                            <path
                              key={i}
                              d={`M${285 + i * 16} ${250 - heel + i * 6} l-22 20`}
                              stroke="#fff"
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          ))}
                          <path
                            d={`M230 ${310 - heel} L282 ${277 - heel} L335 ${303 - fore}`}
                            fill="none"
                            stroke="#9eb2d2"
                            strokeWidth="2"
                          />
                        </>
                      ) : key === "midsole" ? (
                        <>
                          <path
                            d={hasStacks ? sole : outline}
                            fill={`url(#foam-${uid})`}
                            stroke={selected === key ? "#2458d3" : "#8da0bd"}
                            strokeWidth="1.5"
                          />
                          {hasStacks && (
                            <path
                              d={`M126 ${340 - heel} Q300 ${348 - heel} 490 ${340 - fore}`}
                              stroke="#b2c6e5"
                              fill="none"
                            />
                          )}
                        </>
                      ) : (
                        <g
                          transform={
                            key === "insole"
                              ? "translate(0 -16) scale(1 .98)"
                              : key === "plate"
                                ? "translate(8 4) scale(.97 1)"
                                : "translate(0 12)"
                          }
                        >
                          {((key === "insole" && m.insole_thickness_mm) ||
                            (key === "outsole" && m.outsole_thickness_mm)) && (
                            <path
                              d={outline}
                              transform={`translate(0 ${clamp((key === "insole" ? m.insole_thickness_mm : m.outsole_thickness_mm).value, 0, 15) * 1.6})`}
                              fill={key === "outsole" ? "#70849f" : "#aec3e8"}
                              stroke="#8294ad"
                              strokeWidth="1.3"
                            />
                          )}
                          <path
                            d={outline}
                            fill={fill[key]}
                            fillOpacity={key === "insole" ? 0.8 : 1}
                            stroke={selected === key ? "#2458d3" : "#8294ad"}
                            strokeWidth={key === "plate" ? 2 : 1.3}
                          />
                        </g>
                      )}
                    </motion.g>
                  ))}
                </g>
              </>
            )}
          </svg>
          <div className="canvas-bottom">
            <span>
              <span className="legend-dot" />{" "}
              {hasRocker
                ? "هندسه + اندازه‌گیری آزمایشگاهی"
                : "اندازه‌های موجود + طرح شماتیک"}
            </span>
            <span dir="ltr">{s.name}</span>
          </div>
        </div>
        {!compact && (
          <aside className="layer-inspector">
            <span className="eyebrow">لایه را انتخاب کن</span>
            <div className="layer-buttons">
              {[...layers].reverse().map((key) => (
                <button
                  key={key}
                  className={selected === key ? "active" : ""}
                  aria-pressed={selected === key}
                  onClick={() => setSelected(key)}
                >
                  <Layers3 size={16} />
                  {layerNames[key]}
                </button>
              ))}
            </div>
            <div className="inspector-detail" aria-live="polite">
              <h3>{layerNames[selected]}</h3>
              <p dir="auto">
                {materials[selected] || "جنس این لایه در منابع ثبت نشده"}
              </p>
              {(detailKeys[selected] || []).map((key) => {
                const metric = getMetric(key);
                return (
                  <div className="inspector-metric" key={key}>
                    <span>{metricLabels[key]}</span>
                    <b dir="ltr">{value(metric?.value, metric?.unit)}</b>
                    {metric && (
                      <small>
                        {origins[metric.origin] || metric.origin} ·{" "}
                        {metric.source}
                      </small>
                    )}
                  </div>
                );
              })}
              <p className="fine-print">
                {selected === "midsole"
                  ? "ارتفاع‌ها مربوط به کل زیره‌اند؛ ضخامت فوم خالص از آن‌ها استنتاج نشده."
                  : selected === "plate"
                    ? "حضور صفحه طبق منبع؛ شکل صفحه شماتیک است."
                    : "فرم این لایه شماتیک است؛ بازسازی کارخانه نیست."}
              </p>
            </div>
            <p className="fine-print">
              عرض سطح اتکا:{" "}
              <bdi>{value(s.midsole_width_forefoot_mm, "mm")}</bdi> جلو ·{" "}
              <bdi>{value(s.midsole_width_heel_mm, "mm")}</bdi> پاشنه
            </p>
            <p className="fine-print">
              نسبت فرم بیرونی پنجه: <bdi>{value(s.toe_box_shape_pct, "%")}</bdi>{" "}
              · تخمین عکس؛ فضای داخلی نیست.
            </p>
            <p className="fine-print">
              صفحه:{" "}
              {s.plate == null
                ? "اطلاعات نامشخص"
                : s.plate === "none"
                  ? "بدون صفحه تقویتی"
                  : s.plate}
            </p>
          </aside>
        )}
      </div>
      {!compact && (
        <div className="anatomy-footnote">
          <Info size={17} />
          <p>
            طرح، اسکن یا CAD نیست. ابعاد آزمایشگاهی به سایز آزمون مربوط‌اند.
            تخمین‌های عکس با طول مرجع ۳۰۰ میلی‌متر نمایش داده می‌شوند. عرض
            داخلی، عرض سطح اتکا و فرم بیرونی معادل نیستند.
          </p>
          <span className="tag">
            <Ruler size={13} />
            <ScanLine size={13} /> با منشأ مشخص
          </span>
        </div>
      )}
    </section>
  );
}
