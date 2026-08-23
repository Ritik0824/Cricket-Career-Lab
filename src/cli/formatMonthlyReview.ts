import type { MonthlyPracticeReview } from "../domain/monthlyReview.js";
import type { TrainingPeriodSummary } from "../domain/trainingPeriod.js";
import type { WorkloadMetricComparison } from "../domain/workloadComparison.js";

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatRanking(
  ranking: readonly {
    readonly category: string;
    readonly minutes: number;
    readonly sharePercentage: number;
  }[],
): string {
  return ranking.length === 0
    ? "none"
    : ranking
        .map(
          (item) =>
            `${capitalize(item.category)} ${item.minutes} min (${item.sharePercentage}%)`,
        )
        .join(", ");
}

function formatPeriod(
  label: string,
  summary: TrainingPeriodSummary,
): readonly string[] {
  return [
    `${label}: ${summary.startDate} to ${summary.endDate}`,
    `Sessions: ${summary.performedSessionCount} performed, ${summary.missedSessionCount} missed (${summary.entryCount} recorded)`,
    `Active days: ${summary.activeDays}`,
    `Completed time: ${summary.completedMinutes} min`,
    `Effort load: ${summary.effortLoad} points`,
    `Average effort: ${summary.averageEffort === null ? "n/a" : `${summary.averageEffort}/10`}`,
    `Focus: ${formatRanking(summary.focusRanking)}`,
    `Intensity: ${formatRanking(summary.intensityRanking)}`,
  ];
}

function formatComparison(
  label: string,
  comparison: WorkloadMetricComparison,
  unit: string,
): string {
  const delta = `${comparison.delta >= 0 ? "+" : ""}${comparison.delta}`;
  const percentage =
    comparison.percentageChange === null
      ? "no prior baseline"
      : `${comparison.percentageChange >= 0 ? "+" : ""}${comparison.percentageChange}%`;

  return `${label}: ${comparison.current} vs ${comparison.previous} ${unit} | ${delta} | ${percentage} | ${comparison.trend}`;
}

function formatHighlights(review: MonthlyPracticeReview): readonly string[] {
  const streak = review.longestActiveDayStreak;
  const busiest = review.busiestTrainingDay;

  return [
    "Highlights",
    streak.days === 0
      ? "Longest active-day streak: none"
      : `Longest active-day streak: ${streak.days} ${streak.days === 1 ? "day" : "days"} (${streak.startDate} to ${streak.endDate})`,
    busiest === null
      ? "Busiest training day: none"
      : `Busiest training day: ${busiest.date} | ${busiest.completedMinutes} min | ${busiest.effortLoad} points | ${busiest.entryIds.join(", ")}`,
  ];
}

export function formatMonthlyPracticeReview(
  review: MonthlyPracticeReview,
): string {
  return [
    `Monthly practice review — ${review.month}`,
    "",
    ...formatPeriod("Current month", review.current),
    "",
    ...formatPeriod("Previous month", review.previous),
    "",
    "Month-over-month comparison",
    formatComparison(
      "Completed time",
      review.comparison.completedMinutes,
      "min",
    ),
    formatComparison("Effort load", review.comparison.effortLoad, "points"),
    formatComparison(
      "Performed sessions",
      review.comparison.performedSessions,
      "sessions",
    ),
    formatComparison("Active days", review.comparison.activeDays, "days"),
    "",
    "Seven-day segments",
    ...review.segments.map(
      (segment) =>
        `- ${segment.startDate} to ${segment.endDate} | ${segment.performedSessionCount} sessions | ${segment.activeDays} active days | ${segment.completedMinutes} min | ${segment.effortLoad} points`,
    ),
    "",
    ...formatHighlights(review),
    "",
    `Current evidence: ${review.current.entryIds.length === 0 ? "none" : review.current.entryIds.join(", ")}`,
    "",
    "This review describes recorded practice patterns; it does not assess readiness, health, or injury risk.",
  ].join("\n");
}
