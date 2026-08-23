import type { CompletedDrillInput } from "../domain/trainingJournal.js";

export type TrainingCompletionDraftErrorCode =
  | "INVALID_JSON"
  | "INVALID_SHAPE";

export class TrainingCompletionDraftError extends Error {
  readonly code: TrainingCompletionDraftErrorCode;
  readonly path: string;

  constructor(
    code: TrainingCompletionDraftErrorCode,
    path: string,
    message: string,
  ) {
    super(message);
    this.name = "TrainingCompletionDraftError";
    this.code = code;
    this.path = path;
  }
}

export interface TrainingCompletionDraft {
  readonly entryId: string;
  readonly drills: readonly CompletedDrillInput[];
  readonly sessionNote?: string;
}

type UnknownObject = Record<string, unknown>;

function invalidShape(path: string, expectation: string): never {
  throw new TrainingCompletionDraftError(
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

function readDrill(value: unknown, index: number): CompletedDrillInput {
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
    throw new TrainingCompletionDraftError(
      "INVALID_JSON",
      "$",
      "training completion draft must contain valid JSON",
    );
  }
}

export function parseTrainingCompletionDraft(
  source: string | unknown,
): TrainingCompletionDraft {
  const draft = readObject(readSource(source), "$draft");

  if (!Array.isArray(draft.drills)) {
    return invalidShape("drills", "an array");
  }

  const sessionNote = readOptionalString(draft.sessionNote, "sessionNote");

  return Object.freeze({
    entryId: readString(draft.entryId, "entryId"),
    drills: Object.freeze(draft.drills.map(readDrill)),
    ...(sessionNote === undefined ? {} : { sessionNote }),
  });
}
