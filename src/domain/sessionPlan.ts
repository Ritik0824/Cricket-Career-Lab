export const TRAINING_FOCUSES = [
  "batting",
  "bowling",
  "fielding",
  "fitness",
  "recovery",
] as const;

export const INTENSITY_LEVELS = ["low", "moderate", "high"] as const;

export type TrainingFocus = (typeof TRAINING_FOCUSES)[number];
export type Intensity = (typeof INTENSITY_LEVELS)[number];

export interface DrillInput {
  id: string;
  name: string;
  focus: TrainingFocus;
  minutes: number;
  intensity: Intensity;
}

export interface SessionPlanInput {
  title: string;
  scheduledFor: string;
  drills: readonly DrillInput[];
}

export interface PlannedDrill {
  readonly id: string;
  readonly name: string;
  readonly focus: TrainingFocus;
  readonly minutes: number;
  readonly intensity: Intensity;
  readonly workloadPoints: number;
}

export type FocusMinutes = Readonly<Record<TrainingFocus, number>>;

export interface SessionPlan {
  readonly title: string;
  readonly scheduledFor: string;
  readonly drills: readonly PlannedDrill[];
  readonly totalMinutes: number;
  readonly workloadPoints: number;
  readonly focusMinutes: FocusMinutes;
}

export class SessionPlanValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "SessionPlanValidationError";
    this.field = field;
  }
}

const MIN_DRILL_MINUTES = 5;
const MAX_DRILL_MINUTES = 90;
const MAX_SESSION_MINUTES = 180;
const MAX_DRILLS = 8;

const INTENSITY_MULTIPLIERS: Readonly<Record<Intensity, number>> = {
  low: 1,
  moderate: 2,
  high: 3,
};

function normalizeText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length < 3) {
    throw new SessionPlanValidationError(
      field,
      `${field} must contain at least three characters`,
    );
  }

  if (normalized.length > maxLength) {
    throw new SessionPlanValidationError(
      field,
      `${field} must contain at most ${maxLength} characters`,
    );
  }

  return normalized;
}

function normalizeId(value: string, index: number): string {
  const normalized = value.trim().toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new SessionPlanValidationError(
      `drills.${index}.id`,
      "drill id must use lowercase words separated by hyphens",
    );
  }

  return normalized;
}

function normalizeDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new SessionPlanValidationError(
      "scheduledFor",
      "scheduledFor must be an ISO calendar date",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new SessionPlanValidationError(
      "scheduledFor",
      "scheduledFor must be a real calendar date",
    );
  }

  return value;
}

function normalizeMinutes(value: number, index: number): number {
  if (
    !Number.isInteger(value) ||
    value < MIN_DRILL_MINUTES ||
    value > MAX_DRILL_MINUTES
  ) {
    throw new SessionPlanValidationError(
      `drills.${index}.minutes`,
      `drill minutes must be an integer from ${MIN_DRILL_MINUTES} to ${MAX_DRILL_MINUTES}`,
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

export function createSessionPlan(input: SessionPlanInput): SessionPlan {
  if (input.drills.length === 0) {
    throw new SessionPlanValidationError(
      "drills",
      "a session must contain at least one drill",
    );
  }

  if (input.drills.length > MAX_DRILLS) {
    throw new SessionPlanValidationError(
      "drills",
      `a session can contain at most ${MAX_DRILLS} drills`,
    );
  }

  const seenIds = new Set<string>();
  const focusMinutes = emptyFocusMinutes();
  let totalMinutes = 0;
  let workloadPoints = 0;

  const drills = input.drills.map((drill, index): PlannedDrill => {
    const id = normalizeId(drill.id, index);

    if (seenIds.has(id)) {
      throw new SessionPlanValidationError(
        `drills.${index}.id`,
        `drill id ${id} is already used in this session`,
      );
    }

    seenIds.add(id);
    const minutes = normalizeMinutes(drill.minutes, index);
    const points = minutes * INTENSITY_MULTIPLIERS[drill.intensity];
    totalMinutes += minutes;
    workloadPoints += points;
    focusMinutes[drill.focus] += minutes;

    return Object.freeze({
      id,
      name: normalizeText(drill.name, `drills.${index}.name`, 80),
      focus: drill.focus,
      minutes,
      intensity: drill.intensity,
      workloadPoints: points,
    });
  });

  if (totalMinutes > MAX_SESSION_MINUTES) {
    throw new SessionPlanValidationError(
      "drills",
      `session duration cannot exceed ${MAX_SESSION_MINUTES} minutes`,
    );
  }

  return Object.freeze({
    title: normalizeText(input.title, "title", 100),
    scheduledFor: normalizeDate(input.scheduledFor),
    drills: Object.freeze(drills),
    totalMinutes,
    workloadPoints,
    focusMinutes: Object.freeze(focusMinutes),
  });
}
