import type { TrainingJournalEntry } from "./trainingJournal.js";
import {
  deduplicateTrainingEntries,
  summarizeTrainingPeriod,
  type TrainingPeriodSummary,
} from "./trainingPeriod.js";
import {
  compareTrainingPeriods,
  type WorkloadComparison,
} from "./workloadComparison.js";

export type {
  IntensityMinutes,
  PeriodRankingItem as WorkloadRankingItem,
} from "./trainingPeriod.js";
export type {
  WorkloadMetricComparison,
  WorkloadTrend,
} from "./workloadComparison.js";

export type WeeklyWorkloadSummary = TrainingPeriodSummary;
export type WeeklyWorkloadComparison = WorkloadComparison;

export interface WeeklyWorkloadReview {
  readonly weekEnding: string;
  readonly current: WeeklyWorkloadSummary;
  readonly previous: WeeklyWorkloadSummary;
  readonly comparison: WeeklyWorkloadComparison;
}

export class WeeklyWorkloadValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "WeeklyWorkloadValidationError";
    this.field = field;
  }
}

const MILLISECONDS_PER_DAY = 86_400_000;

function normalizeCalendarDate(value: string): string {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new WeeklyWorkloadValidationError(
      "weekEnding",
      "weekEnding must be an ISO calendar date",
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
    throw new WeeklyWorkloadValidationError(
      "weekEnding",
      "weekEnding must be a real calendar date",
    );
  }

  return normalized;
}

function shiftDate(value: string, days: number): string {
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);

  return new Date(milliseconds + days * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export function buildWeeklyWorkloadReview(
  entries: readonly TrainingJournalEntry[],
  weekEnding: string,
): WeeklyWorkloadReview {
  const normalizedEnding = normalizeCalendarDate(weekEnding);
  const deduplicated = deduplicateTrainingEntries(entries);
  const current = summarizeTrainingPeriod(
    deduplicated,
    shiftDate(normalizedEnding, -6),
    normalizedEnding,
  );
  const previous = summarizeTrainingPeriod(
    deduplicated,
    shiftDate(normalizedEnding, -13),
    shiftDate(normalizedEnding, -7),
  );

  return Object.freeze({
    weekEnding: normalizedEnding,
    current,
    previous,
    comparison: compareTrainingPeriods(current, previous),
  });
}
