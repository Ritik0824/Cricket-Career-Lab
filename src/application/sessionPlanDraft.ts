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

export type SessionPlanDraftErrorCode =
  | "INVALID_JSON"
  | "INVALID_SHAPE"
  | "INVALID_PLAN";

export class SessionPlanDraftError extends Error {
  readonly code: SessionPlanDraftErrorCode;
  readonly path: string;

  constructor(
    code: SessionPlanDraftErrorCode,
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "SessionPlanDraftError";
    this.code = code;
    this.path = path;
  }
}

type UnknownObject = Record<string, unknown>;

function invalidShape(path: string, expectation: string): never {
  throw new SessionPlanDraftError(
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

function readDrill(value: unknown, index: number): DrillInput {
  const path = `drills.${index}`;
  const drill = readObject(value, path);

  return {
    id: readString(drill.id, `${path}.id`),
    name: readString(drill.name, `${path}.name`),
    focus: readFocus(drill.focus, `${path}.focus`),
    minutes: readNumber(drill.minutes, `${path}.minutes`),
    intensity: readIntensity(drill.intensity, `${path}.intensity`),
  };
}

function readSource(source: string | unknown): unknown {
  if (typeof source !== "string") {
    return source;
  }

  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new SessionPlanDraftError(
      "INVALID_JSON",
      "$",
      "training plan draft must contain valid JSON",
    );
  }
}

export function parseSessionPlanDraft(source: string | unknown): SessionPlan {
  const draft = readObject(readSource(source), "$draft");

  if (!Array.isArray(draft.drills)) {
    return invalidShape("drills", "an array");
  }

  const drills = draft.drills.map(readDrill);

  try {
    return createSessionPlan({
      title: readString(draft.title, "title"),
      scheduledFor: readString(draft.scheduledFor, "scheduledFor"),
      drills,
    });
  } catch (error) {
    if (error instanceof SessionPlanValidationError) {
      throw new SessionPlanDraftError(
        "INVALID_PLAN",
        error.field,
        error.message,
      );
    }

    throw error;
  }
}
