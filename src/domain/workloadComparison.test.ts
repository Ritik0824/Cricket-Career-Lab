import assert from "node:assert/strict";
import test from "node:test";

import { summarizeTrainingPeriod } from "./trainingPeriod.js";
import {
  compareTrainingPeriods,
  compareWorkloadMetric,
} from "./workloadComparison.js";

test("classifies arithmetic changes without inventing a zero baseline", () => {
  assert.deepEqual(compareWorkloadMetric(12, 0), {
    current: 12,
    previous: 0,
    delta: 12,
    percentageChange: null,
    trend: "started",
  });
  assert.equal(compareWorkloadMetric(0, 0).trend, "no-activity");
  assert.equal(compareWorkloadMetric(8, 10).trend, "decreased");
  assert.equal(compareWorkloadMetric(8, 10).percentageChange, -20);
  assert.equal(compareWorkloadMetric(10, 10).trend, "unchanged");
  assert.equal(compareWorkloadMetric(15, 10).trend, "increased");
});

test("compares every shared training-period measure", () => {
  const current = {
    ...summarizeTrainingPeriod([], "2026-09-01", "2026-09-30"),
    completedMinutes: 100,
    effortLoad: 700,
    performedSessionCount: 5,
    activeDays: 4,
  };
  const previous = {
    ...summarizeTrainingPeriod([], "2026-08-01", "2026-08-31"),
    completedMinutes: 80,
    effortLoad: 640,
    performedSessionCount: 4,
    activeDays: 4,
  };
  const comparison = compareTrainingPeriods(current, previous);

  assert.equal(comparison.completedMinutes.percentageChange, 25);
  assert.equal(comparison.effortLoad.delta, 60);
  assert.equal(comparison.performedSessions.trend, "increased");
  assert.equal(comparison.activeDays.trend, "unchanged");
  assert.ok(Object.isFrozen(comparison));
});
