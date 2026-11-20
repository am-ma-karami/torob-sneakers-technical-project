import { useId, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import type { FacetOption, FacetResult } from "../lib/types";
import { fa, label } from "../lib/format";
import { facetKeys, facetTitles } from "../lib/catalogState";
type Update = (key: string, value: string, append?: boolean) => void;
function FacetGroup({
  name,
  options,
  params,
  update,
}: {
  name: string;
  options: FacetOption[];
  params: URLSearchParams;
  update: Update;
}) {
  const id = useId(),
    [search, setSearch] = useState(""),
    [expanded, setExpanded] = useState(false);
  const chosen = params.getAll(name);
  const merged = [
    ...options,
    ...chosen
      .filter((v) => !options.some((o) => o.value === v))
      .map((value) => ({ value, label: label(value), count: 0 })),
  ];
  const matching = merged.filter(
    (o) =>
      label(o.label).toLowerCase().includes(search.toLowerCase()) ||
      o.value.toLowerCase().includes(search.toLowerCase()),
  );
  const shown =
    expanded || search
      ? matching
      : matching.filter((o, i) => i < 5 || chosen.includes(o.value));
  return (
    <details
      className="filter-group"
      open={name === "brand" || name === "category" || chosen.length > 0}
    >
      <summary>
        {facetTitles[name]}
        {chosen.length > 0 && (
          <span className="filter-count">{fa(chosen.length)}</span>
        )}
        <ChevronDown size={15} />
      </summary>
      {merged.length > 8 && (
        <div className="facet-search">
          <Search size={13} />
          <input
            aria-label={`جستجو در ${facetTitles[name]}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="پیدا کن…"
          />
        </div>
      )}
      <div className={`facet-options ${expanded ? "expanded" : ""}`}>
        {shown.map((o) => (
          <label
            className="checkbox-row"
            key={o.value}
            htmlFor={`${id}-${o.value}`}
          >
            <input
              id={`${id}-${o.value}`}
              type="checkbox"
              checked={chosen.includes(o.value)}
              onChange={() => update(name, o.value, true)}
            />
            <span dir="auto">{label(o.label)}</span>
            <small>{fa(o.count)}</small>
          </label>
        ))}
      </div>
      {!merged.length && (
        <p className="fine-print">اطلاعاتی برای نتایج فعلی ثبت نشده.</p>
      )}
      {matching.length > 5 && !search && (
        <button className="show-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? "نمایش کمتر" : `نمایش همه (${fa(matching.length)})`}
        </button>
      )}
    </details>
  );
}
function Range({
  title,
  field,
  unit,
  params,
  update,
  min = 0,
  max = 3000,
}: {
  title: string;
  field: string;
  unit: string;
  params: URLSearchParams;
  update: Update;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <details className="filter-group">
      <summary>
        {title}
        <span className="range-unit" dir="ltr">
          {unit}
        </span>
        <ChevronDown size={15} />
      </summary>
      <form
        key={`${params.get(field + "_min")}-${params.get(field + "_max")}`}
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const values = new FormData(form);
          const a = String(values.get("min") || ""),
            b = String(values.get("max") || "");
          if (a && b && Number(a) > Number(b)) {
            form
              .querySelector("input")
              ?.setCustomValidity("حداقل باید از حداکثر کمتر باشد");
            form.reportValidity();
            return;
          }
          update(field + "_min", a);
          update(field + "_max", b);
        }}
      >
        <div className="range-inputs">
          <label htmlFor={id + "min"}>
            از
            <input
              id={id + "min"}
              name="min"
              type="number"
              step="any"
              min={min}
              max={max}
              defaultValue={params.get(field + "_min") || ""}
              onInput={(e) => e.currentTarget.setCustomValidity("")}
            />
          </label>
          <span>—</span>
          <label htmlFor={id + "max"}>
            تا
            <input
              id={id + "max"}
              name="max"
              type="number"
              step="any"
              min={min}
              max={max}
              defaultValue={params.get(field + "_max") || ""}
              onInput={(e) =>
                e.currentTarget.form
                  ?.querySelector("input")
                  ?.setCustomValidity("")
              }
            />
          </label>
        </div>
        <button className="apply-range" type="submit">
          اعمال بازه
        </button>
      </form>
    </details>
  );
}
export function FilterPanel({
  data,
  params,
  update,
  clear,
}: {
  data: FacetResult | undefined;
  params: URLSearchParams;
  update: Update;
  clear: () => void;
}) {
  return (
    <div className="filter-panel">
      <div className="filter-heading">
        <b>
          <SlidersHorizontal size={16} /> دقیق‌تر انتخاب کن
        </b>
        <button onClick={clear}>پاک کردن</button>
      </div>
      <p className="filter-help">
        انتخاب‌ها در هر گروه «یا» و بین گروه‌ها «و» هستند.
      </p>
      {facetKeys.slice(0, 3).map((key) => (
        <FacetGroup
          key={key}
          name={key}
          options={data?.groups[key] || []}
          params={params}
          update={update}
        />
      ))}
      <Range
        title="وزن"
        field="weight"
        unit="g"
        params={params}
        update={update}
      />
      <Range
        title="قیمت فهرست سازنده"
        field="price"
        unit="USD"
        max={10000}
        params={params}
        update={update}
      />
      <details className="filter-group">
        <summary>
          حداقل امتیاز RunRepeat
          <ChevronDown size={15} />
        </summary>
        <label className="score-filter">
          از ۱۰۰
          <select
            aria-label="حداقل امتیاز RunRepeat"
            value={params.get("score_min") || ""}
            onChange={(e) => update("score_min", e.target.value)}
          >
            <option value="">همه امتیازها</option>
            <option value="90">۹۰</option>
            <option value="80">۸۰</option>
            <option value="70">۷۰</option>
          </select>
        </label>
      </details>
      {facetKeys.slice(3).map((key) => (
        <FacetGroup
          key={key}
          name={key}
          options={data?.groups[key] || []}
          params={params}
          update={update}
        />
      ))}
      <Range
        title="اختلاف ارتفاع"
        field="drop"
        unit="mm"
        min={-20}
        max={60}
        params={params}
        update={update}
      />
      <Range
        title="ارتفاع پاشنه"
        field="heel"
        unit="mm"
        max={100}
        params={params}
        update={update}
      />
      <Range
        title="ارتفاع پنجه"
        field="forefoot"
        unit="mm"
        max={100}
        params={params}
        update={update}
      />
      <Range
        title="عرض داخلی جلوی پا"
        field="internal_width"
        unit="mm"
        max={200}
        params={params}
        update={update}
      />
      <p className="fine-print filter-disclosure">
        فیلتر اندازه‌ها فقط مدل‌های دارای همان اندازه‌گیری را نگه می‌دارد. رنگ
        ثبت‌نشده یعنی اطلاعات نامشخص. شمارش هر گروه با سایر فیلترها محاسبه
        می‌شود.
      </p>
    </div>
  );
}
