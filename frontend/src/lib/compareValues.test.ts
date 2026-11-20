import { expect, it } from "vitest";
import { comparableMetric } from "./compareValues";
import type { Metric } from "./types";
it("ignores record-specific URLs while preserving units and measurement methods", () => {
  const metric: Metric = {
    value: 35,
    unit: "mm",
    source: "RunRepeat",
    origin: "lab_measured",
    source_url: "https://example.com/a",
    methodology_version: "2.5",
  };
  expect(comparableMetric(metric)).toEqual(
    comparableMetric({ ...metric, source_url: "https://example.com/b" }),
  );
  expect(comparableMetric(metric)).not.toEqual(
    comparableMetric({ ...metric, unit: "Shore A" }),
  );
  expect(comparableMetric(metric)).not.toEqual(
    comparableMetric({ ...metric, methodology_version: "old" }),
  );
  expect(comparableMetric(undefined)).toBeNull();
});
