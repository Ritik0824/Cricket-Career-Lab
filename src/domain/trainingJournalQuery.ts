import {
  INTENSITY_LEVELS,
  TRAINING_FOCUSES,
  type Intensity,
  type TrainingFocus,
} from "./sessionPlan.js";
import type {
  SessionCompletionStatus,
  TrainingJournalEntry,
} from "./trainingJournal.js";

export const SESSION_COMPLETION_STATUSES = [
  "completed",
  "partial",
  "missed",
] as const satisfies readonly SessionCompletionStatus[];

export interface TrainingJournalQueryInput {
  readonly from?: string;
  readonly to?: string;
  readonly focus?: string;
  readonly intensity?: string;
  readonly status?: string;
  readonly text?: string;
  readonly limit?: number;
}

export interface TrainingJournalQuery {
  readonly from: string | null;
  readonly to: string | null;
  readonly focus: TrainingFocus | null;
  readonly intensity: Intensity | null;
  readonly status: SessionCompletionStatus | null;
  readonly text: string | null;
  readonly limit: number | null;
}

export class TrainingJournalQueryError extends Error {
  readonly field: keyof TrainingJournalQueryInput;

  constructor(field: keyof TrainingJournalQueryInput, message: string) {
    super(message);
    this.name = "TrainingJournalQueryError";
    this.field = field;
  }
}

function normalizeDate(
  value: string | undefined,
  field: "from" | "to",
): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new TrainingJournalQueryError(
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
    throw new TrainingJournalQueryError(
      field,
      `${field} must be a real calendar date`,
    );
  }

  return normalized;
}

function normalizeChoice<T extends string>(
  value: string | undefined,
  field: "focus" | "intensity" | "status",
  choices: readonly T[],
): T | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!choices.includes(normalized as T)) {
    throw new TrainingJournalQueryError(
      field,
      `${field} must be one of ${choices.join(", ")}`,
    );
  }

  return normalized as T;
}

function normalizeText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();

  if (normalized.length === 0) {
    throw new TrainingJournalQueryError("text", "text cannot be empty");
  }

  if (normalized.length > 100) {
    throw new TrainingJournalQueryError(
      "text",
      "text must contain at most 100 characters",
    );
  }

  return normalized;
}

function normalizeLimit(value: number | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new TrainingJournalQueryError(
      "limit",
      "limit must be an integer from 1 to 100",
    );
  }

  return value;
}

export function normalizeTrainingJournalQuery(
  input: TrainingJournalQueryInput = {},
): TrainingJournalQuery {
  const from = normalizeDate(input.from, "from");
  const to = normalizeDate(input.to, "to");

  if (from !== null && to !== null && from > to) {
    throw new TrainingJournalQueryError(
      "from",
      "from cannot be later than to",
    );
  }

  return Object.freeze({
    from,
    to,
    focus: normalizeChoice(input.focus, "focus", TRAINING_FOCUSES),
    intensity: normalizeChoice(
      input.intensity,
      "intensity",
      INTENSITY_LEVELS,
    ),
    status: normalizeChoice(
      input.status,
      "status",
      SESSION_COMPLETION_STATUSES,
    ),
    text: normalizeText(input.text),
    limit: normalizeLimit(input.limit),
  });
}

function matchesText(entry: TrainingJournalEntry, query: string): boolean {
  const values = [
    entry.entryId,
    entry.planTitle,
    entry.status,
    entry.sessionNote ?? "",
    ...entry.drills.flatMap((drill) => [
      drill.drillId,
      drill.name,
      drill.focus,
      drill.plannedIntensity,
      drill.status,
      drill.note ?? "",
    ]),
  ];

  return values.some((value) => value.toLowerCase().includes(query));
}

function matchesQuery(
  entry: TrainingJournalEntry,
  query: TrainingJournalQuery,
): boolean {
  const completedDate = entry.completedAt.slice(0, 10);

  if (query.from !== null && completedDate < query.from) {
    return false;
  }

  if (query.to !== null && completedDate > query.to) {
    return false;
  }

  if (query.status !== null && entry.status !== query.status) {
    return false;
  }

  if (
    query.focus !== null &&
    !entry.drills.some(
      (drill) => drill.completedMinutes > 0 && drill.focus === query.focus,
    )
  ) {
    return false;
  }

  if (
    query.intensity !== null &&
    !entry.drills.some(
      (drill) =>
        drill.completedMinutes > 0 &&
        drill.plannedIntensity === query.intensity,
    )
  ) {
    return false;
  }

  return query.text === null || matchesText(entry, query.text);
}

export function filterTrainingJournal(
  entries: readonly TrainingJournalEntry[],
  input: TrainingJournalQueryInput = {},
): readonly TrainingJournalEntry[] {
  const query = normalizeTrainingJournalQuery(input);
  const matched = entries
    .filter((entry) => matchesQuery(entry, query))
    .sort(
      (left, right) =>
        right.completedAt.localeCompare(left.completedAt) ||
        left.entryId.localeCompare(right.entryId),
    );

  return Object.freeze(
    query.limit === null ? matched : matched.slice(0, query.limit),
  );
}
