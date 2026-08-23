import {
  INTENSITY_LEVELS,
  TRAINING_FOCUSES,
  type FocusMinutes,
  type Intensity,
  type TrainingFocus,
} from "./sessionPlan.js";
import type { TrainingJournalEntry } from "./trainingJournal.js";

export type IntensityMinutes = Readonly<Record<Intensity, number>>;

export interface PeriodRankingItem<TCategory extends string> {
  readonly category: TCategory;
  readonly minutes: number;
  readonly sharePercentage: number;
}

export interface TrainingPeriodSummary {
  readonly startDate: string;
  readonly endDate: string;
  readonly entryCount: number;
  readonly performedSessionCount: number;
  readonly missedSessionCount: number;
  readonly activeDays: number;
  readonly completedMinutes: number;
  readonly effortLoad: number;
  readonly averageEffort: number | null;
  readonly focusMinutes: FocusMinutes;
  readonly intensityMinutes: IntensityMinutes;
  readonly focusRanking: readonly PeriodRankingItem<TrainingFocus>[];
  readonly intensityRanking: readonly PeriodRankingItem<Intensity>[];
  readonly entryIds: readonly string[];
}

export class TrainingPeriodValidationError extends Error {
  readonly field: "startDate" | "endDate";

  constructor(field: "startDate" | "endDate", message: string) {
    super(message);
    this.name = "TrainingPeriodValidationError";
    this.field = field;
  }
}

function normalizeCalendarDate(
  value: string,
  field: "startDate" | "endDate",
): string {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new TrainingPeriodValidationError(
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
    throw new TrainingPeriodValidationError(
      field,
      `${field} must be a real calendar date`,
    );
  }

  return normalized;
}

function emptyFocusMinutes(): Record<TrainingFocus, number> {
  return {
    batting: 0,
    bowling: 0,
    fielding: 0,
    fitness: 0,
    recovery: 0,
  };
}

function emptyIntensityMinutes(): Record<Intensity, number> {
  return {
    low: 0,
    moderate: 0,
    high: 0,
  };
}

export function deduplicateTrainingEntries(
  entries: readonly TrainingJournalEntry[],
): readonly TrainingJournalEntry[] {
  const entriesById = new Map<string, TrainingJournalEntry>();

  for (const entry of entries) {
    const previous = entriesById.get(entry.entryId);

    if (previous === undefined || entry.completedAt > previous.completedAt) {
      entriesById.set(entry.entryId, entry);
    }
  }

  return Object.freeze(
    [...entriesById.values()].sort(
      (left, right) =>
        right.completedAt.localeCompare(left.completedAt) ||
        left.entryId.localeCompare(right.entryId),
    ),
  );
}

function rankMinutes<TCategory extends string>(
  categories: readonly TCategory[],
  minutesByCategory: Readonly<Record<TCategory, number>>,
  totalMinutes: number,
): readonly PeriodRankingItem<TCategory>[] {
  const categoryOrder = new Map(
    categories.map((category, index) => [category, index] as const),
  );

  return Object.freeze(
    categories
      .filter((category) => minutesByCategory[category] > 0)
      .map((category) =>
        Object.freeze({
          category,
          minutes: minutesByCategory[category],
          sharePercentage:
            totalMinutes === 0
              ? 0
              : Math.round((minutesByCategory[category] / totalMinutes) * 100),
        }),
      )
      .sort(
        (left, right) =>
          right.minutes - left.minutes ||
          (categoryOrder.get(left.category) ?? 0) -
            (categoryOrder.get(right.category) ?? 0),
      ),
  );
}

export function summarizeTrainingPeriod(
  entries: readonly TrainingJournalEntry[],
  startDate: string,
  endDate: string,
): TrainingPeriodSummary {
  const normalizedStart = normalizeCalendarDate(startDate, "startDate");
  const normalizedEnd = normalizeCalendarDate(endDate, "endDate");

  if (normalizedStart > normalizedEnd) {
    throw new TrainingPeriodValidationError(
      "startDate",
      "startDate cannot be later than endDate",
    );
  }

  const windowEntries = deduplicateTrainingEntries(entries).filter((entry) => {
    const completionDate = entry.completedAt.slice(0, 10);

    return completionDate >= normalizedStart && completionDate <= normalizedEnd;
  });
  const focusMinutes = emptyFocusMinutes();
  const intensityMinutes = emptyIntensityMinutes();
  const activeDates = new Set<string>();
  let performedSessionCount = 0;
  let completedMinutes = 0;
  let effortLoad = 0;

  for (const entry of windowEntries) {
    completedMinutes += entry.completedMinutes;
    effortLoad += entry.effortLoad;

    if (entry.completedMinutes > 0) {
      performedSessionCount += 1;
      activeDates.add(entry.completedAt.slice(0, 10));
    }

    for (const focus of TRAINING_FOCUSES) {
      focusMinutes[focus] += entry.completedFocusMinutes[focus];
    }

    for (const drill of entry.drills) {
      intensityMinutes[drill.plannedIntensity] += drill.completedMinutes;
    }
  }

  const frozenFocusMinutes = Object.freeze(focusMinutes);
  const frozenIntensityMinutes = Object.freeze(intensityMinutes);

  return Object.freeze({
    startDate: normalizedStart,
    endDate: normalizedEnd,
    entryCount: windowEntries.length,
    performedSessionCount,
    missedSessionCount: windowEntries.length - performedSessionCount,
    activeDays: activeDates.size,
    completedMinutes,
    effortLoad,
    averageEffort:
      completedMinutes === 0
        ? null
        : Math.round((effortLoad / completedMinutes) * 10) / 10,
    focusMinutes: frozenFocusMinutes,
    intensityMinutes: frozenIntensityMinutes,
    focusRanking: rankMinutes(
      TRAINING_FOCUSES,
      frozenFocusMinutes,
      completedMinutes,
    ),
    intensityRanking: rankMinutes(
      INTENSITY_LEVELS,
      frozenIntensityMinutes,
      completedMinutes,
    ),
    entryIds: Object.freeze(windowEntries.map((entry) => entry.entryId)),
  });
}
