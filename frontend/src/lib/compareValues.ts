import type { Metric } from "./types";
/** Source URLs identify records, not numerical differences between shoes. */
export function comparableMetric(metric: Metric | undefined) {
  return metric
    ? {
        value: metric.value,
        unit: metric.unit,
        source: metric.source,
        origin: metric.origin,
        method: metric.methodology_version || metric.method_version || null,
        testedSize: metric.test_size_raw || null,
        uncertain: metric.uncertain || false,
        range:
          metric.photos_min == null
            ? null
            : [metric.photos_min, metric.photos_max],
      }
    : null;
}
