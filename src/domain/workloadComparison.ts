import type { TrainingPeriodSummary } from "./trainingPeriod.js";

export type WorkloadTrend =
  | "no-activity"
  | "started"
  | "increased"
  | "unchanged"
  | "decreased";

export interface WorkloadMetricComparison {
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
  readonly percentageChange: number | null;
  readonly trend: WorkloadTrend;
}

export interface WorkloadComparison {
  readonly completedMinutes: WorkloadMetricComparison;
  readonly effortLoad: WorkloadMetricComparison;
  readonly performedSessions: WorkloadMetricComparison;
  readonly activeDays: WorkloadMetricComparison;
}

export function compareWorkloadMetric(
  current: number,
  previous: number,
): WorkloadMetricComparison {
  const delta = current - previous;
  let trend: WorkloadTrend;

  if (current === 0 && previous === 0) {
    trend = "no-activity";
  } else if (previous === 0) {
    trend = "started";
  } else if (delta > 0) {
    trend = "increased";
  } else if (delta < 0) {
    trend = "decreased";
  } else {
    trend = "unchanged";
  }

  return Object.freeze({
    current,
    previous,
    delta,
    percentageChange:
      previous === 0 ? null : Math.round((delta / previous) * 100),
    trend,
  });
}

export function compareTrainingPeriods(
  current: TrainingPeriodSummary,
  previous: TrainingPeriodSummary,
): WorkloadComparison {
  return Object.freeze({
    completedMinutes: compareWorkloadMetric(
      current.completedMinutes,
      previous.completedMinutes,
    ),
    effortLoad: compareWorkloadMetric(current.effortLoad, previous.effortLoad),
    performedSessions: compareWorkloadMetric(
      current.performedSessionCount,
      previous.performedSessionCount,
    ),
    activeDays: compareWorkloadMetric(current.activeDays, previous.activeDays),
  });
}
