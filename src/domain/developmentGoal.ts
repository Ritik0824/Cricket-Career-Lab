import {
  TRAINING_FOCUSES,
  type TrainingFocus,
} from "./sessionPlan.js";
import type { TrainingJournalEntry } from "./trainingJournal.js";

export const DEVELOPMENT_GOAL_METRICS = [
  "completed-sessions",
  "training-minutes",
  "focus-minutes",
  "effort-load",
  "consistency-days",
] as const;

export type DevelopmentGoalMetric =
  (typeof DEVELOPMENT_GOAL_METRICS)[number];
export type DevelopmentGoalStatus =
  | "not-started"
  | "in-progress"
  | "achieved"
  | "expired";

export interface DevelopmentGoalInput {
  goalId: string;
  title: string;
  metric: string;
  target: number;
  startDate: string;
  dueDate: string;
  focus?: string;
}

export interface DevelopmentGoal {
  readonly goalId: string;
  readonly title: string;
  readonly metric: DevelopmentGoalMetric;
  readonly target: number;
  readonly startDate: string;
  readonly dueDate: string;
  readonly focus: TrainingFocus | null;
}

export interface GoalEvidence {
  readonly entryId: string;
  readonly completedAt: string;
  readonly contribution: number;
}

export interface DevelopmentGoalProgress {
  readonly goal: DevelopmentGoal;
  readonly status: DevelopmentGoalStatus;
  readonly evaluatedOn: string;
  readonly currentValue: number;
  readonly remainingValue: number;
  readonly progressPercentage: number;
  readonly daysRemaining: number;
  readonly latestContributionAt: string | null;
  readonly evidence: readonly GoalEvidence[];
}

export class DevelopmentGoalValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "DevelopmentGoalValidationError";
    this.field = field;
  }
}

const MAX_GOAL_TARGET = 1_000_000;
const MILLISECONDS_PER_DAY = 86_400_000;

export function normalizeDevelopmentGoalId(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (
    normalized.length < 3 ||
    normalized.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
  ) {
    throw new DevelopmentGoalValidationError(
      "goalId",
      "goalId must contain 3 to 80 lowercase letters, numbers, or hyphen-separated words",
    );
  }

  return normalized;
}

function normalizeTitle(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length < 3 || normalized.length > 120) {
    throw new DevelopmentGoalValidationError(
      "title",
      "title must contain 3 to 120 characters",
    );
  }

  return normalized;
}

function normalizeMetric(value: string): DevelopmentGoalMetric {
  const normalized = value.trim().toLowerCase();

  if (
    !DEVELOPMENT_GOAL_METRICS.includes(
      normalized as DevelopmentGoalMetric,
    )
  ) {
    throw new DevelopmentGoalValidationError(
      "metric",
      `metric must be one of ${DEVELOPMENT_GOAL_METRICS.join(", ")}`,
    );
  }

  return normalized as DevelopmentGoalMetric;
}

function normalizeDate(
  value: string,
  field: "startDate" | "dueDate" | "evaluatedOn",
): string {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new DevelopmentGoalValidationError(
      field,
      `${field} must be an ISO calendar date`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new DevelopmentGoalValidationError(
      field,
      `${field} must be a real calendar date`,
    );
  }

  return normalized;
}

function normalizeTarget(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_GOAL_TARGET) {
    throw new DevelopmentGoalValidationError(
      "target",
      `target must be an integer from 1 to ${MAX_GOAL_TARGET}`,
    );
  }

  return value;
}

function normalizeFocus(
  value: string | undefined,
  metric: DevelopmentGoalMetric,
): TrainingFocus | null {
  if (metric !== "focus-minutes") {
    if (value !== undefined) {
      throw new DevelopmentGoalValidationError(
        "focus",
        "focus is only supported for focus-minutes goals",
      );
    }

    return null;
  }

  if (value === undefined) {
    throw new DevelopmentGoalValidationError(
      "focus",
      "focus is required for focus-minutes goals",
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!TRAINING_FOCUSES.includes(normalized as TrainingFocus)) {
    throw new DevelopmentGoalValidationError(
      "focus",
      `focus must be one of ${TRAINING_FOCUSES.join(", ")}`,
    );
  }

  return normalized as TrainingFocus;
}

function dateToMilliseconds(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round(
    (dateToMilliseconds(endDate) - dateToMilliseconds(startDate)) /
      MILLISECONDS_PER_DAY,
  );
}

export function createDevelopmentGoal(
  input: DevelopmentGoalInput,
): DevelopmentGoal {
  const metric = normalizeMetric(input.metric);
  const startDate = normalizeDate(input.startDate, "startDate");
  const dueDate = normalizeDate(input.dueDate, "dueDate");
  const target = normalizeTarget(input.target);

  if (startDate > dueDate) {
    throw new DevelopmentGoalValidationError(
      "startDate",
      "startDate cannot be later than dueDate",
    );
  }

  if (
    metric === "consistency-days" &&
    target > daysBetween(startDate, dueDate) + 1
  ) {
    throw new DevelopmentGoalValidationError(
      "target",
      "consistency-days target cannot exceed the number of days in the goal window",
    );
  }

  return Object.freeze({
    goalId: normalizeDevelopmentGoalId(input.goalId),
    title: normalizeTitle(input.title),
    metric,
    target,
    startDate,
    dueDate,
    focus: normalizeFocus(input.focus, metric),
  });
}

function normalizeEvaluationDate(value: string): string {
  return normalizeDate(value, "evaluatedOn");
}

function uniqueWindowEntries(
  goal: DevelopmentGoal,
  entries: readonly TrainingJournalEntry[],
  evaluatedOn: string,
): readonly TrainingJournalEntry[] {
  if (evaluatedOn < goal.startDate) {
    return [];
  }

  const endDate = evaluatedOn < goal.dueDate ? evaluatedOn : goal.dueDate;
  const byId = new Map<string, TrainingJournalEntry>();

  for (const entry of entries) {
    const completedDate = entry.completedAt.slice(0, 10);

    if (completedDate < goal.startDate || completedDate > endDate) {
      continue;
    }

    const previous = byId.get(entry.entryId);
    if (previous === undefined || entry.completedAt > previous.completedAt) {
      byId.set(entry.entryId, entry);
    }
  }

  return [...byId.values()].sort(
    (left, right) =>
      right.completedAt.localeCompare(left.completedAt) ||
      left.entryId.localeCompare(right.entryId),
  );
}

function contributionForEntry(
  goal: DevelopmentGoal,
  entry: TrainingJournalEntry,
): number {
  if (entry.completedMinutes === 0) {
    return 0;
  }

  if (goal.metric === "completed-sessions") {
    return 1;
  }

  if (goal.metric === "training-minutes") {
    return entry.completedMinutes;
  }

  if (goal.metric === "focus-minutes") {
    return goal.focus === null ? 0 : entry.completedFocusMinutes[goal.focus];
  }

  if (goal.metric === "effort-load") {
    return entry.effortLoad;
  }

  return 1;
}

function collectEvidence(
  goal: DevelopmentGoal,
  entries: readonly TrainingJournalEntry[],
): readonly GoalEvidence[] {
  const usedDates = new Set<string>();
  const evidence: GoalEvidence[] = [];

  for (const entry of entries) {
    const completedDate = entry.completedAt.slice(0, 10);

    if (goal.metric === "consistency-days") {
      if (entry.completedMinutes === 0 || usedDates.has(completedDate)) {
        continue;
      }

      usedDates.add(completedDate);
    }

    const contribution = contributionForEntry(goal, entry);

    if (contribution > 0) {
      evidence.push(
        Object.freeze({
          entryId: entry.entryId,
          completedAt: entry.completedAt,
          contribution,
        }),
      );
    }
  }

  return Object.freeze(evidence);
}

function progressStatus(
  goal: DevelopmentGoal,
  evaluatedOn: string,
  currentValue: number,
): DevelopmentGoalStatus {
  if (currentValue >= goal.target) {
    return "achieved";
  }

  if (evaluatedOn < goal.startDate) {
    return "not-started";
  }

  return evaluatedOn > goal.dueDate ? "expired" : "in-progress";
}

export function evaluateDevelopmentGoal(
  goal: DevelopmentGoal,
  entries: readonly TrainingJournalEntry[],
  evaluatedOn: string,
): DevelopmentGoalProgress {
  const normalizedDate = normalizeEvaluationDate(evaluatedOn);
  const evidence = collectEvidence(
    goal,
    uniqueWindowEntries(goal, entries, normalizedDate),
  );
  const currentValue = evidence.reduce(
    (total, item) => total + item.contribution,
    0,
  );

  return Object.freeze({
    goal,
    status: progressStatus(goal, normalizedDate, currentValue),
    evaluatedOn: normalizedDate,
    currentValue,
    remainingValue: Math.max(0, goal.target - currentValue),
    progressPercentage: Math.min(
      100,
      Math.round((currentValue / goal.target) * 100),
    ),
    daysRemaining: Math.max(0, daysBetween(normalizedDate, goal.dueDate)),
    latestContributionAt: evidence[0]?.completedAt ?? null,
    evidence,
  });
}

export function evaluateDevelopmentGoals(
  goals: readonly DevelopmentGoal[],
  entries: readonly TrainingJournalEntry[],
  evaluatedOn: string,
): readonly DevelopmentGoalProgress[] {
  const seenIds = new Set<string>();

  goals.forEach((goal, index) => {
    if (seenIds.has(goal.goalId)) {
      throw new DevelopmentGoalValidationError(
        `goals.${index}.goalId`,
        `goal ${goal.goalId} is listed more than once`,
      );
    }

    seenIds.add(goal.goalId);
  });

  return Object.freeze(
    goals
      .map((goal) => evaluateDevelopmentGoal(goal, entries, evaluatedOn))
      .sort(
        (left, right) =>
          left.goal.dueDate.localeCompare(right.goal.dueDate) ||
          left.goal.goalId.localeCompare(right.goal.goalId),
      ),
  );
}
