import type {
  DevelopmentGoalMetric,
  DevelopmentGoalProgress,
} from "../domain/developmentGoal.js";
import { serializeDevelopmentGoal } from "../storage/developmentGoalRecord.js";

const METRIC_LABELS: Readonly<
  Record<DevelopmentGoalMetric, { readonly label: string; readonly unit: string }>
> = {
  "completed-sessions": { label: "Completed sessions", unit: "sessions" },
  "training-minutes": { label: "Training minutes", unit: "min" },
  "focus-minutes": { label: "Focus minutes", unit: "min" },
  "effort-load": { label: "Effort load", unit: "points" },
  "consistency-days": { label: "Consistency days", unit: "days" },
};

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatMetric(progress: DevelopmentGoalProgress): string {
  const metric = METRIC_LABELS[progress.goal.metric];
  const focus =
    progress.goal.focus === null
      ? ""
      : ` (${capitalize(progress.goal.focus)})`;

  return `${metric.label}${focus}`;
}

function formatEvidence(progress: DevelopmentGoalProgress): readonly string[] {
  if (progress.evidence.length === 0) {
    return ["Evidence", "None yet."];
  }

  return [
    "Evidence",
    ...progress.evidence.map(
      (item) =>
        `- ${item.completedAt} | ${item.entryId} | +${item.contribution}`,
    ),
  ];
}

export function formatGoalProgress(
  progress: DevelopmentGoalProgress,
): string {
  const metric = METRIC_LABELS[progress.goal.metric];

  return [
    progress.goal.title,
    `Goal: ${progress.goal.goalId}`,
    `Status: ${capitalize(progress.status)}`,
    `Metric: ${formatMetric(progress)}`,
    `Window: ${progress.goal.startDate} to ${progress.goal.dueDate}`,
    `Progress: ${progress.currentValue}/${progress.goal.target} ${metric.unit} (${progress.progressPercentage}%)`,
    `Remaining: ${progress.remainingValue} ${metric.unit}`,
    `Evaluated: ${progress.evaluatedOn}`,
    `Days remaining: ${progress.daysRemaining}`,
    `Latest contribution: ${progress.latestContributionAt ?? "none"}`,
    "",
    ...formatEvidence(progress),
  ].join("\n");
}

export function formatGoalProgressList(
  progress: readonly DevelopmentGoalProgress[],
): string {
  if (progress.length === 0) {
    return "No development goals have been created.";
  }

  return [
    `Development goals — ${progress.length} ${progress.length === 1 ? "goal" : "goals"}`,
    ...progress.map((item) => {
      const metric = METRIC_LABELS[item.goal.metric];

      return `${item.goal.dueDate} | ${item.goal.goalId} | ${item.status} | ${item.currentValue}/${item.goal.target} ${metric.unit} (${item.progressPercentage}%) | ${item.goal.title}`;
    }),
  ].join("\n");
}

export function toGoalProgressView(
  progress: DevelopmentGoalProgress,
): Record<string, unknown> {
  return {
    goal: JSON.parse(serializeDevelopmentGoal(progress.goal)) as unknown,
    progress: {
      status: progress.status,
      evaluatedOn: progress.evaluatedOn,
      currentValue: progress.currentValue,
      remainingValue: progress.remainingValue,
      progressPercentage: progress.progressPercentage,
      daysRemaining: progress.daysRemaining,
      latestContributionAt: progress.latestContributionAt,
      evidence: progress.evidence.map((item) => ({ ...item })),
    },
  };
}
