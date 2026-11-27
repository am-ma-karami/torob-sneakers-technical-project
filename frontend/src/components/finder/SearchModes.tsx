import { ArrowLeft, SlidersHorizontal, Sparkles, Combine } from "lucide-react";
export type SearchMode = "advanced" | "advisor" | "hybrid";
export const modeLabels = {
  advanced: "جست‌وجوی پیشرفته",
  advisor: "مشاور هوشمند",
  hybrid: "جست‌وجوی ترکیبی",
};
const modes = [
  {
    key: "advanced",
    description: "خودم می‌دونم چه کفشی می‌خوام.",
    detail: "انتخاب بر اساس برند و مشخصات",
    Icon: SlidersHorizontal,
  },
  {
    key: "advisor",
    description: "کمکم کن کفش مناسبم رو پیدا کنم.",
    detail: "نیازت را با زبان خودت بگو",
    Icon: Sparkles,
  },
  {
    key: "hybrid",
    description: "فیلترها رو انتخاب می‌کنم و نیازم رو توضیح می‌دم.",
    detail: "کنترل دقیق با پیشنهاد شخصی‌تر",
    Icon: Combine,
  },
] as const;
export function SearchModes({
  mode,
  onChange,
}: {
  mode: SearchMode | null;
  onChange: (mode: SearchMode) => void;
}) {
  return (
    <div className="finder-modes" role="group" aria-label="روش جست‌وجو">
      {modes.map(({ key, description, detail, Icon }) => (
        <button
          type="button"
          key={key}
          className={`finder-mode ${key === "advisor" ? "is-advisor" : ""}`}
          aria-pressed={mode === key}
          onClick={() => onChange(key)}
          aria-controls="finder-filters"
        >
          <span className="finder-mode-top">
            <span className="finder-mode-icon">
              <Icon size={24} aria-hidden="true" />
            </span>
            <span className="finder-mode-detail">
              {mode === key ? "روش انتخاب‌شده" : detail}
            </span>
          </span>
          <strong>{modeLabels[key]}</strong>
          <span>{description}</span>
          <ArrowLeft
            size={18}
            className="finder-mode-arrow"
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
