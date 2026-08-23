import type {
  WeeklyWorkloadReview,
  WeeklyWorkloadSummary,
  WorkloadMetricComparison,
} from "../domain/weeklyWorkload.js";

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatRanking(
  summary: WeeklyWorkloadSummary,
  kind: "focus" | "intensity",
): string {
  const ranking =
    kind === "focus" ? summary.focusRanking : summary.intensityRanking;

  if (ranking.length === 0) {
    return "none";
  }

  return ranking
    .map(
      (item) =>
        `${capitalize(item.category)} ${item.minutes} min (${item.sharePercentage}%)`,
    )
    .join(", ");
}

function formatSummary(
  label: string,
  summary: WeeklyWorkloadSummary,
): readonly string[] {
  return [
    `${label}: ${summary.startDate} to ${summary.endDate}`,
    `Sessions: ${summary.performedSessionCount} performed, ${summary.missedSessionCount} missed (${summary.entryCount} recorded)`,
    `Active days: ${summary.activeDays}`,
    `Completed time: ${summary.completedMinutes} min`,
    `Effort load: ${summary.effortLoad} points`,
    `Average effort: ${summary.averageEffort === null ? "n/a" : `${summary.averageEffort}/10`}`,
    `Focus: ${formatRanking(summary, "focus")}`,
    `Intensity: ${formatRanking(summary, "intensity")}`,
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

function formatEntryIds(
  label: string,
  summary: WeeklyWorkloadSummary,
): string {
  return `${label}: ${summary.entryIds.length === 0 ? "none" : summary.entryIds.join(", ")}`;
}

export function formatWeeklyWorkloadReview(
  review: WeeklyWorkloadReview,
): string {
  return [
    `Weekly workload — ending ${review.weekEnding}`,
    "",
    ...formatSummary("Current week", review.current),
    "",
    ...formatSummary("Previous week", review.previous),
    "",
    "Week-over-week comparison",
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
    "Evidence",
    formatEntryIds("Current entries", review.current),
    formatEntryIds("Previous entries", review.previous),
    "",
    "This review describes recorded training only; it does not assess readiness, health, or injury risk.",
  ].join("\n");
}
