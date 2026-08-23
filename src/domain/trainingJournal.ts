import {
  TRAINING_FOCUSES,
  type FocusMinutes,
  type Intensity,
  type SessionPlan,
  type TrainingFocus,
} from "./sessionPlan.js";

export type DrillCompletionStatus = "completed" | "partial" | "skipped";
export type SessionCompletionStatus = "completed" | "partial" | "missed";

export interface CompletedDrillInput {
  readonly drillId: string;
  readonly completedMinutes: number;
  readonly perceivedEffort?: number;
  readonly note?: string;
}

export interface CompleteTrainingSessionInput {
  entryId: string;
  plan: SessionPlan;
  completedAt: string;
  drills: readonly CompletedDrillInput[];
  sessionNote?: string;
}

export interface CompletedDrill {
  readonly drillId: string;
  readonly name: string;
  readonly focus: TrainingFocus;
  readonly plannedIntensity: Intensity;
  readonly plannedMinutes: number;
  readonly completedMinutes: number;
  readonly varianceMinutes: number;
  readonly perceivedEffort: number | null;
  readonly effortLoad: number;
  readonly status: DrillCompletionStatus;
  readonly note: string | null;
}

export interface TrainingJournalEntry {
  readonly entryId: string;
  readonly planTitle: string;
  readonly scheduledFor: string;
  readonly completedAt: string;
  readonly status: SessionCompletionStatus;
  readonly plannedMinutes: number;
  readonly completedMinutes: number;
  readonly varianceMinutes: number;
  readonly adherencePercentage: number;
  readonly averageEffort: number | null;
  readonly effortLoad: number;
  readonly plannedFocusMinutes: FocusMinutes;
  readonly completedFocusMinutes: FocusMinutes;
  readonly drills: readonly CompletedDrill[];
  readonly sessionNote: string | null;
}

export class TrainingJournalValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "TrainingJournalValidationError";
    this.field = field;
  }
}

const MAX_COMPLETED_DRILL_MINUTES = 120;
const MAX_COMPLETED_SESSION_MINUTES = 240;
const MAX_DRILL_NOTE_LENGTH = 500;
const MAX_SESSION_NOTE_LENGTH = 1_000;

export function normalizeTrainingJournalEntryId(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (
    normalized.length < 3 ||
    normalized.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
  ) {
    throw new TrainingJournalValidationError(
      "entryId",
      "entryId must contain 3 to 80 lowercase letters, numbers, or hyphen-separated words",
    );
  }

  return normalized;
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TrainingJournalValidationError(
      "completedAt",
      "completedAt must be a canonical UTC timestamp",
    );
  }

  return value;
}

function normalizeNote(
  value: string | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new TrainingJournalValidationError(
      field,
      `${field} must contain at most ${maxLength} characters`,
    );
  }

  return normalized;
}

function normalizeCompletedMinutes(value: number, index: number): number {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_COMPLETED_DRILL_MINUTES
  ) {
    throw new TrainingJournalValidationError(
      `drills.${index}.completedMinutes`,
      `completedMinutes must be an integer from 0 to ${MAX_COMPLETED_DRILL_MINUTES}`,
    );
  }

  return value;
}

function normalizeEffort(
  value: number | undefined,
  completedMinutes: number,
  index: number,
): number | null {
  const field = `drills.${index}.perceivedEffort`;

  if (completedMinutes === 0) {
    if (value !== undefined) {
      throw new TrainingJournalValidationError(
        field,
        "perceivedEffort must be omitted when completedMinutes is 0",
      );
    }

    return null;
  }

  if (!Number.isInteger(value) || value === undefined || value < 1 || value > 10) {
    throw new TrainingJournalValidationError(
      field,
      "perceivedEffort must be an integer from 1 to 10 for completed drills",
    );
  }

  return value;
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

function classifyDrill(
  completedMinutes: number,
  plannedMinutes: number,
): DrillCompletionStatus {
  if (completedMinutes === 0) {
    return "skipped";
  }

  return completedMinutes >= plannedMinutes ? "completed" : "partial";
}

function classifySession(
  drills: readonly CompletedDrill[],
  completedMinutes: number,
): SessionCompletionStatus {
  if (completedMinutes === 0) {
    return "missed";
  }

  return drills.every((drill) => drill.status === "completed")
    ? "completed"
    : "partial";
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function completeTrainingSession(
  input: CompleteTrainingSessionInput,
): TrainingJournalEntry {
  const plannedDrills = new Map(
    input.plan.drills.map((drill) => [drill.id, drill] as const),
  );
  const suppliedResults = new Map<
    string,
    { readonly input: CompletedDrillInput; readonly inputIndex: number }
  >();

  input.drills.forEach((result, index) => {
    const drillId = result.drillId.trim().toLowerCase();

    if (!plannedDrills.has(drillId)) {
      throw new TrainingJournalValidationError(
        `drills.${index}.drillId`,
        `drill ${drillId || "<empty>"} is not part of this training plan`,
      );
    }

    if (suppliedResults.has(drillId)) {
      throw new TrainingJournalValidationError(
        `drills.${index}.drillId`,
        `drill ${drillId} is listed more than once`,
      );
    }

    suppliedResults.set(drillId, { input: result, inputIndex: index });
  });

  const completedFocusMinutes = emptyFocusMinutes();
  let completedMinutes = 0;
  let effortLoad = 0;

  const drills = input.plan.drills.map((plannedDrill, index): CompletedDrill => {
    const suppliedResult = suppliedResults.get(plannedDrill.id);
    const supplied = suppliedResult?.input;
    const inputIndex = suppliedResult?.inputIndex ?? index;
    const actualMinutes = normalizeCompletedMinutes(
      supplied?.completedMinutes ?? 0,
      inputIndex,
    );
    const perceivedEffort = normalizeEffort(
      supplied?.perceivedEffort,
      actualMinutes,
      inputIndex,
    );
    const drillEffortLoad = actualMinutes * (perceivedEffort ?? 0);

    completedMinutes += actualMinutes;
    effortLoad += drillEffortLoad;
    completedFocusMinutes[plannedDrill.focus] += actualMinutes;

    return Object.freeze({
      drillId: plannedDrill.id,
      name: plannedDrill.name,
      focus: plannedDrill.focus,
      plannedIntensity: plannedDrill.intensity,
      plannedMinutes: plannedDrill.minutes,
      completedMinutes: actualMinutes,
      varianceMinutes: actualMinutes - plannedDrill.minutes,
      perceivedEffort,
      effortLoad: drillEffortLoad,
      status: classifyDrill(actualMinutes, plannedDrill.minutes),
      note: normalizeNote(
        supplied?.note,
        `drills.${inputIndex}.note`,
        MAX_DRILL_NOTE_LENGTH,
      ),
    });
  });

  if (completedMinutes > MAX_COMPLETED_SESSION_MINUTES) {
    throw new TrainingJournalValidationError(
      "drills",
      `completed session duration cannot exceed ${MAX_COMPLETED_SESSION_MINUTES} minutes`,
    );
  }

  const plannedFocusMinutes = emptyFocusMinutes();
  for (const focus of TRAINING_FOCUSES) {
    plannedFocusMinutes[focus] = input.plan.focusMinutes[focus];
  }

  return Object.freeze({
    entryId: normalizeTrainingJournalEntryId(input.entryId),
    planTitle: input.plan.title,
    scheduledFor: input.plan.scheduledFor,
    completedAt: normalizeTimestamp(input.completedAt),
    status: classifySession(drills, completedMinutes),
    plannedMinutes: input.plan.totalMinutes,
    completedMinutes,
    varianceMinutes: completedMinutes - input.plan.totalMinutes,
    adherencePercentage: Math.round(
      (completedMinutes / input.plan.totalMinutes) * 100,
    ),
    averageEffort:
      completedMinutes === 0
        ? null
        : roundToOneDecimal(effortLoad / completedMinutes),
    effortLoad,
    plannedFocusMinutes: Object.freeze(plannedFocusMinutes),
    completedFocusMinutes: Object.freeze(completedFocusMinutes),
    drills: Object.freeze(drills),
    sessionNote: normalizeNote(
      input.sessionNote,
      "sessionNote",
      MAX_SESSION_NOTE_LENGTH,
    ),
  });
}
