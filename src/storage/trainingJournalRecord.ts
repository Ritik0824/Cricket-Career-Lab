import {
  createSessionPlan,
  INTENSITY_LEVELS,
  SessionPlanValidationError,
  TRAINING_FOCUSES,
  type DrillInput,
  type Intensity,
  type SessionPlan,
  type TrainingFocus,
} from "../domain/sessionPlan.js";
import {
  completeTrainingSession,
  TrainingJournalValidationError,
  type CompletedDrillInput,
  type TrainingJournalEntry,
} from "../domain/trainingJournal.js";

export const TRAINING_JOURNAL_RECORD_KIND =
  "cricket-career-lab/training-journal-entry";
export const TRAINING_JOURNAL_RECORD_VERSION = 1;

export type TrainingJournalRecordErrorCode =
  | "INVALID_JSON"
  | "INVALID_SHAPE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_ENTRY";

export class TrainingJournalRecordError extends Error {
  readonly code: TrainingJournalRecordErrorCode;
  readonly path: string;

  constructor(
    code: TrainingJournalRecordErrorCode,
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "TrainingJournalRecordError";
    this.code = code;
    this.path = path;
  }
}

interface TrainingJournalRecordV1 {
  readonly kind: typeof TRAINING_JOURNAL_RECORD_KIND;
  readonly version: typeof TRAINING_JOURNAL_RECORD_VERSION;
  readonly entryId: string;
  readonly completedAt: string;
  readonly plan: {
    readonly title: string;
    readonly scheduledFor: string;
    readonly drills: readonly DrillInput[];
  };
  readonly drills: readonly CompletedDrillInput[];
  readonly sessionNote?: string;
}

type UnknownObject = Record<string, unknown>;

function invalidShape(path: string, expectation: string): never {
  throw new TrainingJournalRecordError(
    "INVALID_SHAPE",
    path,
    `${path} must be ${expectation}`,
  );
}

function readObject(value: unknown, path: string): UnknownObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidShape(path, "an object");
  }

  return value as UnknownObject;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    return invalidShape(path, "a string");
  }

  return value;
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return invalidShape(path, "a finite number");
  }

  return value;
}

function readOptionalString(
  value: unknown,
  path: string,
): string | undefined {
  return value === undefined ? undefined : readString(value, path);
}

function readOptionalNumber(
  value: unknown,
  path: string,
): number | undefined {
  return value === undefined ? undefined : readNumber(value, path);
}

function readFocus(value: unknown, path: string): TrainingFocus {
  if (
    typeof value !== "string" ||
    !(TRAINING_FOCUSES as readonly string[]).includes(value)
  ) {
    return invalidShape(path, "a supported training focus");
  }

  return value as TrainingFocus;
}

function readIntensity(value: unknown, path: string): Intensity {
  if (
    typeof value !== "string" ||
    !(INTENSITY_LEVELS as readonly string[]).includes(value)
  ) {
    return invalidShape(path, "a supported intensity");
  }

  return value as Intensity;
}

function readPlanDrill(value: unknown, index: number): DrillInput {
  const path = `plan.drills.${index}`;
  const drill = readObject(value, path);

  return {
    id: readString(drill.id, `${path}.id`),
    name: readString(drill.name, `${path}.name`),
    focus: readFocus(drill.focus, `${path}.focus`),
    minutes: readNumber(drill.minutes, `${path}.minutes`),
    intensity: readIntensity(drill.intensity, `${path}.intensity`),
  };
}

function readPlan(value: unknown): SessionPlan {
  const plan = readObject(value, "plan");

  if (!Array.isArray(plan.drills)) {
    return invalidShape("plan.drills", "an array");
  }

  try {
    return createSessionPlan({
      title: readString(plan.title, "plan.title"),
      scheduledFor: readString(plan.scheduledFor, "plan.scheduledFor"),
      drills: plan.drills.map(readPlanDrill),
    });
  } catch (error) {
    if (error instanceof SessionPlanValidationError) {
      throw new TrainingJournalRecordError(
        "INVALID_ENTRY",
        `plan.${error.field}`,
        error.message,
      );
    }

    throw error;
  }
}

function readCompletedDrill(
  value: unknown,
  index: number,
): CompletedDrillInput {
  const path = `drills.${index}`;
  const drill = readObject(value, path);
  const perceivedEffort = readOptionalNumber(
    drill.perceivedEffort,
    `${path}.perceivedEffort`,
  );
  const note = readOptionalString(drill.note, `${path}.note`);

  return {
    drillId: readString(drill.drillId, `${path}.drillId`),
    completedMinutes: readNumber(
      drill.completedMinutes,
      `${path}.completedMinutes`,
    ),
    ...(perceivedEffort === undefined ? {} : { perceivedEffort }),
    ...(note === undefined ? {} : { note }),
  };
}

function readSource(source: string | unknown): unknown {
  if (typeof source !== "string") {
    return source;
  }

  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new TrainingJournalRecordError(
      "INVALID_JSON",
      "$",
      "training journal record must contain valid JSON",
    );
  }
}

function buildEntry(record: UnknownObject): TrainingJournalEntry {
  if (!Array.isArray(record.drills)) {
    return invalidShape("drills", "an array");
  }

  const sessionNote = readOptionalString(record.sessionNote, "sessionNote");

  try {
    return completeTrainingSession({
      entryId: readString(record.entryId, "entryId"),
      completedAt: readString(record.completedAt, "completedAt"),
      plan: readPlan(record.plan),
      drills: record.drills.map(readCompletedDrill),
      ...(sessionNote === undefined ? {} : { sessionNote }),
    });
  } catch (error) {
    if (error instanceof TrainingJournalValidationError) {
      throw new TrainingJournalRecordError(
        "INVALID_ENTRY",
        error.field,
        error.message,
      );
    }

    throw error;
  }
}

function normalizeEntry(entry: TrainingJournalEntry): TrainingJournalEntry {
  try {
    const plan = createSessionPlan({
      title: entry.planTitle,
      scheduledFor: entry.scheduledFor,
      drills: entry.drills.map((drill) => ({
        id: drill.drillId,
        name: drill.name,
        focus: drill.focus,
        minutes: drill.plannedMinutes,
        intensity: drill.plannedIntensity,
      })),
    });

    return completeTrainingSession({
      entryId: entry.entryId,
      completedAt: entry.completedAt,
      plan,
      drills: entry.drills.map((drill) => ({
        drillId: drill.drillId,
        completedMinutes: drill.completedMinutes,
        ...(drill.perceivedEffort === null
          ? {}
          : { perceivedEffort: drill.perceivedEffort }),
        ...(drill.note === null ? {} : { note: drill.note }),
      })),
      ...(entry.sessionNote === null ? {} : { sessionNote: entry.sessionNote }),
    });
  } catch (error) {
    if (error instanceof SessionPlanValidationError) {
      throw new TrainingJournalRecordError(
        "INVALID_ENTRY",
        `plan.${error.field}`,
        error.message,
      );
    }

    if (error instanceof TrainingJournalValidationError) {
      throw new TrainingJournalRecordError(
        "INVALID_ENTRY",
        error.field,
        error.message,
      );
    }

    throw error;
  }
}

function toRecord(entry: TrainingJournalEntry): TrainingJournalRecordV1 {
  const normalized = normalizeEntry(entry);

  return {
    kind: TRAINING_JOURNAL_RECORD_KIND,
    version: TRAINING_JOURNAL_RECORD_VERSION,
    entryId: normalized.entryId,
    completedAt: normalized.completedAt,
    plan: {
      title: normalized.planTitle,
      scheduledFor: normalized.scheduledFor,
      drills: normalized.drills.map((drill) => ({
        id: drill.drillId,
        name: drill.name,
        focus: drill.focus,
        minutes: drill.plannedMinutes,
        intensity: drill.plannedIntensity,
      })),
    },
    drills: normalized.drills.map((drill) => ({
      drillId: drill.drillId,
      completedMinutes: drill.completedMinutes,
      ...(drill.perceivedEffort === null
        ? {}
        : { perceivedEffort: drill.perceivedEffort }),
      ...(drill.note === null ? {} : { note: drill.note }),
    })),
    ...(normalized.sessionNote === null
      ? {}
      : { sessionNote: normalized.sessionNote }),
  };
}

export function serializeTrainingJournalEntry(
  entry: TrainingJournalEntry,
): string {
  return JSON.stringify(toRecord(entry), null, 2);
}

export function parseTrainingJournalRecord(
  source: string | unknown,
): TrainingJournalEntry {
  const record = readObject(readSource(source), "$record");

  if (record.kind !== TRAINING_JOURNAL_RECORD_KIND) {
    throw new TrainingJournalRecordError(
      "INVALID_SHAPE",
      "kind",
      `kind must equal ${TRAINING_JOURNAL_RECORD_KIND}`,
    );
  }

  if (
    typeof record.version !== "number" ||
    !Number.isInteger(record.version)
  ) {
    return invalidShape("version", "an integer");
  }

  if (record.version !== TRAINING_JOURNAL_RECORD_VERSION) {
    throw new TrainingJournalRecordError(
      "UNSUPPORTED_VERSION",
      "version",
      `training journal record version ${String(record.version)} is not supported`,
    );
  }

  return buildEntry(record);
}
