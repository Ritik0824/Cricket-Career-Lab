import {
  createDevelopmentGoal,
  DevelopmentGoalValidationError,
  type DevelopmentGoal,
} from "../domain/developmentGoal.js";

export const DEVELOPMENT_GOAL_RECORD_KIND =
  "cricket-career-lab/development-goal";
export const DEVELOPMENT_GOAL_RECORD_VERSION = 1;

export type DevelopmentGoalRecordErrorCode =
  | "INVALID_JSON"
  | "INVALID_SHAPE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_GOAL";

export class DevelopmentGoalRecordError extends Error {
  readonly code: DevelopmentGoalRecordErrorCode;
  readonly path: string;

  constructor(
    code: DevelopmentGoalRecordErrorCode,
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "DevelopmentGoalRecordError";
    this.code = code;
    this.path = path;
  }
}

interface DevelopmentGoalRecordV1 {
  readonly kind: typeof DEVELOPMENT_GOAL_RECORD_KIND;
  readonly version: typeof DEVELOPMENT_GOAL_RECORD_VERSION;
  readonly goalId: string;
  readonly title: string;
  readonly metric: string;
  readonly target: number;
  readonly startDate: string;
  readonly dueDate: string;
  readonly focus?: string;
}

type UnknownObject = Record<string, unknown>;

function invalidShape(path: string, expectation: string): never {
  throw new DevelopmentGoalRecordError(
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

function readSource(source: string | unknown): unknown {
  if (typeof source !== "string") {
    return source;
  }

  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new DevelopmentGoalRecordError(
      "INVALID_JSON",
      "$",
      "development goal record must contain valid JSON",
    );
  }
}

function buildGoal(record: UnknownObject): DevelopmentGoal {
  const focus = readOptionalString(record.focus, "focus");

  try {
    return createDevelopmentGoal({
      goalId: readString(record.goalId, "goalId"),
      title: readString(record.title, "title"),
      metric: readString(record.metric, "metric"),
      target: readNumber(record.target, "target"),
      startDate: readString(record.startDate, "startDate"),
      dueDate: readString(record.dueDate, "dueDate"),
      ...(focus === undefined ? {} : { focus }),
    });
  } catch (error) {
    if (error instanceof DevelopmentGoalValidationError) {
      throw new DevelopmentGoalRecordError(
        "INVALID_GOAL",
        error.field,
        error.message,
      );
    }

    throw error;
  }
}

function normalizeGoal(goal: DevelopmentGoal): DevelopmentGoal {
  try {
    return createDevelopmentGoal({
      goalId: goal.goalId,
      title: goal.title,
      metric: goal.metric,
      target: goal.target,
      startDate: goal.startDate,
      dueDate: goal.dueDate,
      ...(goal.focus === null ? {} : { focus: goal.focus }),
    });
  } catch (error) {
    if (error instanceof DevelopmentGoalValidationError) {
      throw new DevelopmentGoalRecordError(
        "INVALID_GOAL",
        error.field,
        error.message,
      );
    }

    throw error;
  }
}

function toRecord(goal: DevelopmentGoal): DevelopmentGoalRecordV1 {
  const normalized = normalizeGoal(goal);

  return {
    kind: DEVELOPMENT_GOAL_RECORD_KIND,
    version: DEVELOPMENT_GOAL_RECORD_VERSION,
    goalId: normalized.goalId,
    title: normalized.title,
    metric: normalized.metric,
    target: normalized.target,
    startDate: normalized.startDate,
    dueDate: normalized.dueDate,
    ...(normalized.focus === null ? {} : { focus: normalized.focus }),
  };
}

export function serializeDevelopmentGoal(goal: DevelopmentGoal): string {
  return JSON.stringify(toRecord(goal), null, 2);
}

export function parseDevelopmentGoalRecord(
  source: string | unknown,
): DevelopmentGoal {
  const record = readObject(readSource(source), "$record");

  if (record.kind !== DEVELOPMENT_GOAL_RECORD_KIND) {
    throw new DevelopmentGoalRecordError(
      "INVALID_SHAPE",
      "kind",
      `kind must equal ${DEVELOPMENT_GOAL_RECORD_KIND}`,
    );
  }

  if (
    typeof record.version !== "number" ||
    !Number.isInteger(record.version)
  ) {
    return invalidShape("version", "an integer");
  }

  if (record.version !== DEVELOPMENT_GOAL_RECORD_VERSION) {
    throw new DevelopmentGoalRecordError(
      "UNSUPPORTED_VERSION",
      "version",
      `development goal record version ${String(record.version)} is not supported`,
    );
  }

  return buildGoal(record);
}
