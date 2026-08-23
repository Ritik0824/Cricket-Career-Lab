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

export const SESSION_PLAN_RECORD_KIND = "cricket-career-lab/session-plan";
export const SESSION_PLAN_RECORD_VERSION = 1;

export type SessionPlanRecordErrorCode =
  | "INVALID_JSON"
  | "INVALID_SHAPE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_PLAN";

export class SessionPlanRecordError extends Error {
  readonly code: SessionPlanRecordErrorCode;
  readonly path: string;

  constructor(
    code: SessionPlanRecordErrorCode,
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "SessionPlanRecordError";
    this.code = code;
    this.path = path;
  }
}

export interface StoredSessionPlan {
  readonly savedAt: string;
  readonly plan: SessionPlan;
}

interface SessionPlanRecordV1 {
  readonly kind: typeof SESSION_PLAN_RECORD_KIND;
  readonly version: typeof SESSION_PLAN_RECORD_VERSION;
  readonly savedAt: string;
  readonly plan: {
    readonly title: string;
    readonly scheduledFor: string;
    readonly drills: readonly DrillInput[];
  };
}

type UnknownObject = Record<string, unknown>;

function invalidShape(path: string, expectation: string): never {
  throw new SessionPlanRecordError(
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

function readCanonicalTimestamp(value: unknown): string {
  const timestamp = readString(value, "savedAt");
  const parsed = new Date(timestamp);

  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    throw new SessionPlanRecordError(
      "INVALID_SHAPE",
      "savedAt",
      "savedAt must be a canonical UTC timestamp",
    );
  }

  return timestamp;
}

function isTrainingFocus(value: unknown): value is TrainingFocus {
  return (
    typeof value === "string" &&
    (TRAINING_FOCUSES as readonly string[]).includes(value)
  );
}

function isIntensity(value: unknown): value is Intensity {
  return (
    typeof value === "string" &&
    (INTENSITY_LEVELS as readonly string[]).includes(value)
  );
}

function readDrill(value: unknown, index: number): DrillInput {
  const path = `plan.drills.${index}`;
  const drill = readObject(value, path);
  const focus = drill.focus;
  const intensity = drill.intensity;

  if (!isTrainingFocus(focus)) {
    return invalidShape(`${path}.focus`, "a supported training focus");
  }

  if (!isIntensity(intensity)) {
    return invalidShape(`${path}.intensity`, "a supported intensity");
  }

  return {
    id: readString(drill.id, `${path}.id`),
    name: readString(drill.name, `${path}.name`),
    focus,
    minutes: readNumber(drill.minutes, `${path}.minutes`),
    intensity,
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
      drills: plan.drills.map(readDrill),
    });
  } catch (error) {
    if (error instanceof SessionPlanValidationError) {
      throw new SessionPlanRecordError(
        "INVALID_PLAN",
        `plan.${error.field}`,
        error.message,
      );
    }

    throw error;
  }
}

function readSource(source: string | unknown): unknown {
  if (typeof source !== "string") {
    return source;
  }

  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new SessionPlanRecordError(
      "INVALID_JSON",
      "$",
      "session plan record must contain valid JSON",
    );
  }
}

function readRecord(source: string | unknown): StoredSessionPlan {
  const record = readObject(readSource(source), "$record");

  if (record.kind !== SESSION_PLAN_RECORD_KIND) {
    throw new SessionPlanRecordError(
      "INVALID_SHAPE",
      "kind",
      `kind must equal ${SESSION_PLAN_RECORD_KIND}`,
    );
  }

  if (
    typeof record.version !== "number" ||
    !Number.isInteger(record.version)
  ) {
    return invalidShape("version", "an integer");
  }

  if (record.version !== SESSION_PLAN_RECORD_VERSION) {
    throw new SessionPlanRecordError(
      "UNSUPPORTED_VERSION",
      "version",
      `session plan record version ${String(record.version)} is not supported`,
    );
  }

  return Object.freeze({
    savedAt: readCanonicalTimestamp(record.savedAt),
    plan: readPlan(record.plan),
  });
}

function toRecord(plan: SessionPlan, savedAt: string): SessionPlanRecordV1 {
  const normalizedPlan = createSessionPlan({
    title: plan.title,
    scheduledFor: plan.scheduledFor,
    drills: plan.drills.map((drill) => ({
      id: drill.id,
      name: drill.name,
      focus: drill.focus,
      minutes: drill.minutes,
      intensity: drill.intensity,
    })),
  });

  return {
    kind: SESSION_PLAN_RECORD_KIND,
    version: SESSION_PLAN_RECORD_VERSION,
    savedAt: readCanonicalTimestamp(savedAt),
    plan: {
      title: normalizedPlan.title,
      scheduledFor: normalizedPlan.scheduledFor,
      drills: normalizedPlan.drills.map((drill) => ({
        id: drill.id,
        name: drill.name,
        focus: drill.focus,
        minutes: drill.minutes,
        intensity: drill.intensity,
      })),
    },
  };
}

export function serializeSessionPlan(
  plan: SessionPlan,
  savedAt: string,
): string {
  return JSON.stringify(toRecord(plan, savedAt), null, 2);
}

export function parseSessionPlanRecord(source: string | unknown): StoredSessionPlan {
  return readRecord(source);
}
