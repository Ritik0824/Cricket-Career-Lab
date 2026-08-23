import {
  INTENSITY_LEVELS,
  TRAINING_FOCUSES,
  type FocusMinutes,
  type Intensity,
  type TrainingFocus,
} from "./sessionPlan.js";
import type { TrainingJournalEntry } from "./trainingJournal.js";

export type WorkloadTrend =
  | "no-activity"
  | "started"
  | "increased"
  | "unchanged"
  | "decreased";

export type IntensityMinutes = Readonly<Record<Intensity, number>>;

export interface WorkloadRankingItem<TCategory extends string> {
  readonly category: TCategory;
  readonly minutes: number;
  readonly sharePercentage: number;
}

export interface WeeklyWorkloadSummary {
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
  readonly focusRanking: readonly WorkloadRankingItem<TrainingFocus>[];
  readonly intensityRanking: readonly WorkloadRankingItem<Intensity>[];
  readonly entryIds: readonly string[];
}

export interface WorkloadMetricComparison {
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
  readonly percentageChange: number | null;
  readonly trend: WorkloadTrend;
}

export interface WeeklyWorkloadComparison {
  readonly completedMinutes: WorkloadMetricComparison;
  readonly effortLoad: WorkloadMetricComparison;
  readonly performedSessions: WorkloadMetricComparison;
  readonly activeDays: WorkloadMetricComparison;
}

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

function uniqueEntries(
  entries: readonly TrainingJournalEntry[],
): readonly TrainingJournalEntry[] {
  const entriesById = new Map<string, TrainingJournalEntry>();

  for (const entry of entries) {
    const previous = entriesById.get(entry.entryId);

    if (previous === undefined || entry.completedAt > previous.completedAt) {
      entriesById.set(entry.entryId, entry);
    }
  }

  return [...entriesById.values()].sort(
    (left, right) =>
      right.completedAt.localeCompare(left.completedAt) ||
      left.entryId.localeCompare(right.entryId),
  );
}

function rankMinutes<TCategory extends string>(
  categories: readonly TCategory[],
  minutesByCategory: Readonly<Record<TCategory, number>>,
  totalMinutes: number,
): readonly WorkloadRankingItem<TCategory>[] {
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

function summarizeWindow(
  entries: readonly TrainingJournalEntry[],
  startDate: string,
  endDate: string,
): WeeklyWorkloadSummary {
  const windowEntries = entries.filter((entry) => {
    const completionDate = entry.completedAt.slice(0, 10);

    return completionDate >= startDate && completionDate <= endDate;
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
    startDate,
    endDate,
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

function compareMetric(
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

export function buildWeeklyWorkloadReview(
  entries: readonly TrainingJournalEntry[],
  weekEnding: string,
): WeeklyWorkloadReview {
  const normalizedEnding = normalizeCalendarDate(weekEnding);
  const deduplicated = uniqueEntries(entries);
  const current = summarizeWindow(
    deduplicated,
    shiftDate(normalizedEnding, -6),
    normalizedEnding,
  );
  const previous = summarizeWindow(
    deduplicated,
    shiftDate(normalizedEnding, -13),
    shiftDate(normalizedEnding, -7),
  );

  return Object.freeze({
    weekEnding: normalizedEnding,
    current,
    previous,
    comparison: Object.freeze({
      completedMinutes: compareMetric(
        current.completedMinutes,
        previous.completedMinutes,
      ),
      effortLoad: compareMetric(current.effortLoad, previous.effortLoad),
      performedSessions: compareMetric(
        current.performedSessionCount,
        previous.performedSessionCount,
      ),
      activeDays: compareMetric(current.activeDays, previous.activeDays),
    }),
  });
}
