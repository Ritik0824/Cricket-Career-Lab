import {
  createDevelopmentGoal,
  DevelopmentGoalValidationError,
  type DevelopmentGoal,
} from "../domain/developmentGoal.js";

export type DevelopmentGoalDraftErrorCode =
  | "INVALID_JSON"
  | "INVALID_SHAPE"
  | "INVALID_GOAL";

export class DevelopmentGoalDraftError extends Error {
  readonly code: DevelopmentGoalDraftErrorCode;
  readonly path: string;

  constructor(
    code: DevelopmentGoalDraftErrorCode,
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "DevelopmentGoalDraftError";
    this.code = code;
    this.path = path;
  }
}

type UnknownObject = Record<string, unknown>;

function invalidShape(path: string, expectation: string): never {
  throw new DevelopmentGoalDraftError(
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
    throw new DevelopmentGoalDraftError(
      "INVALID_JSON",
      "$",
      "development goal draft must contain valid JSON",
    );
  }
}

export function parseDevelopmentGoalDraft(
  source: string | unknown,
): DevelopmentGoal {
  const draft = readObject(readSource(source), "$draft");
  const focus = readOptionalString(draft.focus, "focus");

  try {
    return createDevelopmentGoal({
      goalId: readString(draft.goalId, "goalId"),
      title: readString(draft.title, "title"),
      metric: readString(draft.metric, "metric"),
      target: readNumber(draft.target, "target"),
      startDate: readString(draft.startDate, "startDate"),
      dueDate: readString(draft.dueDate, "dueDate"),
      ...(focus === undefined ? {} : { focus }),
    });
  } catch (error) {
    if (error instanceof DevelopmentGoalValidationError) {
      throw new DevelopmentGoalDraftError(
        "INVALID_GOAL",
        error.field,
        error.message,
      );
    }

    throw error;
  }
}
