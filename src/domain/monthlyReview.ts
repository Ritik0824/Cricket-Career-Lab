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

export interface MonthlyReviewSegment {
  readonly startDate: string;
  readonly endDate: string;
  readonly performedSessionCount: number;
  readonly activeDays: number;
  readonly completedMinutes: number;
  readonly effortLoad: number;
}

export interface ActiveDayStreak {
  readonly days: number;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

export interface BusiestTrainingDay {
  readonly date: string;
  readonly completedMinutes: number;
  readonly effortLoad: number;
  readonly entryIds: readonly string[];
}

export interface MonthlyPracticeReview {
  readonly month: string;
  readonly current: TrainingPeriodSummary;
  readonly previous: TrainingPeriodSummary;
  readonly comparison: WorkloadComparison;
  readonly segments: readonly MonthlyReviewSegment[];
  readonly longestActiveDayStreak: ActiveDayStreak;
  readonly busiestTrainingDay: BusiestTrainingDay | null;
}

export class MonthlyReviewValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "MonthlyReviewValidationError";
    this.field = field;
  }
}

interface MonthBounds {
  readonly month: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly days: number;
}

const MILLISECONDS_PER_DAY = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function readMonth(value: string): MonthBounds {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new MonthlyReviewValidationError(
      "month",
      "month must use YYYY-MM format",
    );
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);

  if (year < 1_000 || monthNumber < 1 || monthNumber > 12) {
    throw new MonthlyReviewValidationError(
      "month",
      "month must contain a real calendar month",
    );
  }

  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Object.freeze({
    month: normalized,
    startDate: `${normalized}-01`,
    endDate: `${normalized}-${pad(days)}`,
    days,
  });
}

function previousMonth(bounds: MonthBounds): MonthBounds {
  const [yearText, monthText] = bounds.month.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 2, 1));

  return readMonth(
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`,
  );
}

function dateForDay(month: string, day: number): string {
  return `${month}-${pad(day)}`;
}

function buildSegments(
  entries: readonly TrainingJournalEntry[],
  bounds: MonthBounds,
): readonly MonthlyReviewSegment[] {
  const segments: MonthlyReviewSegment[] = [];

  for (let startDay = 1; startDay <= bounds.days; startDay += 7) {
    const summary = summarizeTrainingPeriod(
      entries,
      dateForDay(bounds.month, startDay),
      dateForDay(bounds.month, Math.min(startDay + 6, bounds.days)),
    );

    segments.push(
      Object.freeze({
        startDate: summary.startDate,
        endDate: summary.endDate,
        performedSessionCount: summary.performedSessionCount,
        activeDays: summary.activeDays,
        completedMinutes: summary.completedMinutes,
        effortLoad: summary.effortLoad,
      }),
    );
  }

  return Object.freeze(segments);
}

function buildLongestStreak(
  entries: readonly TrainingJournalEntry[],
  bounds: MonthBounds,
): ActiveDayStreak {
  const activeDates = [
    ...new Set(
      entries
        .filter(
          (entry) =>
            entry.completedMinutes > 0 &&
            entry.completedAt.slice(0, 10) >= bounds.startDate &&
            entry.completedAt.slice(0, 10) <= bounds.endDate,
        )
        .map((entry) => entry.completedAt.slice(0, 10)),
    ),
  ].sort();

  if (activeDates.length === 0) {
    return Object.freeze({ days: 0, startDate: null, endDate: null });
  }

  let bestStart = activeDates[0]!;
  let bestEnd = activeDates[0]!;
  let bestDays = 1;
  let currentStart = activeDates[0]!;
  let currentEnd = activeDates[0]!;
  let currentDays = 1;

  for (const date of activeDates.slice(1)) {
    const gap =
      (Date.parse(`${date}T00:00:00.000Z`) -
        Date.parse(`${currentEnd}T00:00:00.000Z`)) /
      MILLISECONDS_PER_DAY;

    if (gap === 1) {
      currentEnd = date;
      currentDays += 1;
    } else {
      currentStart = date;
      currentEnd = date;
      currentDays = 1;
    }

    if (currentDays > bestDays) {
      bestStart = currentStart;
      bestEnd = currentEnd;
      bestDays = currentDays;
    }
  }

  return Object.freeze({
    days: bestDays,
    startDate: bestStart,
    endDate: bestEnd,
  });
}

function buildBusiestDay(
  entries: readonly TrainingJournalEntry[],
  bounds: MonthBounds,
): BusiestTrainingDay | null {
  const byDate = new Map<
    string,
    { completedMinutes: number; effortLoad: number; entryIds: string[] }
  >();

  for (const entry of entries) {
    const date = entry.completedAt.slice(0, 10);

    if (
      entry.completedMinutes === 0 ||
      date < bounds.startDate ||
      date > bounds.endDate
    ) {
      continue;
    }

    const day = byDate.get(date) ?? {
      completedMinutes: 0,
      effortLoad: 0,
      entryIds: [],
    };
    day.completedMinutes += entry.completedMinutes;
    day.effortLoad += entry.effortLoad;
    day.entryIds.push(entry.entryId);
    byDate.set(date, day);
  }

  const busiest = [...byDate.entries()].sort(
    ([leftDate, left], [rightDate, right]) =>
      right.completedMinutes - left.completedMinutes ||
      right.effortLoad - left.effortLoad ||
      rightDate.localeCompare(leftDate),
  )[0];

  if (busiest === undefined) {
    return null;
  }

  const [date, day] = busiest;

  return Object.freeze({
    date,
    completedMinutes: day.completedMinutes,
    effortLoad: day.effortLoad,
    entryIds: Object.freeze(day.entryIds),
  });
}

export function buildMonthlyPracticeReview(
  entries: readonly TrainingJournalEntry[],
  month: string,
): MonthlyPracticeReview {
  const bounds = readMonth(month);
  const previousBounds = previousMonth(bounds);
  const deduplicated = deduplicateTrainingEntries(entries);
  const current = summarizeTrainingPeriod(
    deduplicated,
    bounds.startDate,
    bounds.endDate,
  );
  const previous = summarizeTrainingPeriod(
    deduplicated,
    previousBounds.startDate,
    previousBounds.endDate,
  );

  return Object.freeze({
    month: bounds.month,
    current,
    previous,
    comparison: compareTrainingPeriods(current, previous),
    segments: buildSegments(deduplicated, bounds),
    longestActiveDayStreak: buildLongestStreak(deduplicated, bounds),
    busiestTrainingDay: buildBusiestDay(deduplicated, bounds),
  });
}
