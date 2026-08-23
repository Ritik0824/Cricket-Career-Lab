import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan, type TrainingFocus } from "./sessionPlan.js";
import {
  completeTrainingSession,
  type TrainingJournalEntry,
} from "./trainingJournal.js";
import {
  createDevelopmentGoal,
  evaluateDevelopmentGoal,
  evaluateDevelopmentGoals,
  DevelopmentGoalValidationError,
  type DevelopmentGoalInput,
} from "./developmentGoal.js";

function goalInput(): DevelopmentGoalInput {
  return {
    goalId: "  september-volume  ",
    title: "  Build September training volume  ",
    metric: " TRAINING-MINUTES ",
    target: 100,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
  };
}

interface EntryOptions {
  readonly entryId: string;
  readonly completedAt: string;
  readonly focus?: TrainingFocus;
  readonly completedMinutes?: number;
  readonly effort?: number;
}

function createEntry(options: EntryOptions): TrainingJournalEntry {
  const focus = options.focus ?? "bowling";
  const completedMinutes = options.completedMinutes ?? 20;
  const effort = options.effort ?? 6;
  const plan = createSessionPlan({
    title: `${focus} development session`,
    scheduledFor: options.completedAt.slice(0, 10),
    drills: [
      {
        id: `${focus}-drill`,
        name: `${focus} development drill`,
        focus,
        minutes: 20,
        intensity: "moderate",
      },
    ],
  });

  return completeTrainingSession({
    entryId: options.entryId,
    plan,
    completedAt: options.completedAt,
    drills:
      completedMinutes === 0
        ? []
        : [
            {
              drillId: `${focus}-drill`,
              completedMinutes,
              perceivedEffort: effort,
            },
          ],
  });
}

function journalEntries(): readonly TrainingJournalEntry[] {
  return [
    createEntry({
      entryId: "entry-one",
      completedAt: "2026-09-02T09:00:00.000Z",
      focus: "bowling",
      completedMinutes: 20,
      effort: 6,
    }),
    createEntry({
      entryId: "entry-two",
      completedAt: "2026-09-03T09:00:00.000Z",
      focus: "batting",
      completedMinutes: 30,
      effort: 8,
    }),
    createEntry({
      entryId: "entry-three",
      completedAt: "2026-09-03T15:00:00.000Z",
      focus: "bowling",
      completedMinutes: 10,
      effort: 5,
    }),
    createEntry({
      entryId: "missed-entry",
      completedAt: "2026-09-04T09:00:00.000Z",
      completedMinutes: 0,
    }),
    createEntry({
      entryId: "outside-entry",
      completedAt: "2026-10-01T09:00:00.000Z",
      completedMinutes: 40,
      effort: 9,
    }),
  ];
}

test("creates a normalized measurable goal with a required due date", () => {
  const goal = createDevelopmentGoal(goalInput());

  assert.deepEqual(goal, {
    goalId: "september-volume",
    title: "Build September training volume",
    metric: "training-minutes",
    target: 100,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
    focus: null,
  });
  assert.ok(Object.isFrozen(goal));
});

test("requires focus only for focus-minute goals", () => {
  const focusGoal = createDevelopmentGoal({
    ...goalInput(),
    metric: "focus-minutes",
    focus: " BOWLING ",
  });
  assert.equal(focusGoal.focus, "bowling");

  assert.throws(
    () => createDevelopmentGoal({ ...goalInput(), metric: "focus-minutes" }),
    (error: unknown) =>
      error instanceof DevelopmentGoalValidationError &&
      error.field === "focus" &&
      /required/.test(error.message),
  );
  assert.throws(
    () => createDevelopmentGoal({ ...goalInput(), focus: "bowling" }),
    /only supported/,
  );
});

test("rejects unsafe identities, titles, metrics, and targets", () => {
  assert.throws(
    () => createDevelopmentGoal({ ...goalInput(), goalId: "Unsafe id" }),
    (error: unknown) =>
      error instanceof DevelopmentGoalValidationError &&
      error.field === "goalId",
  );
  assert.throws(
    () => createDevelopmentGoal({ ...goalInput(), title: "x" }),
    /3 to 120/,
  );
  assert.throws(
    () => createDevelopmentGoal({ ...goalInput(), metric: "runs" }),
    /metric must be one of/,
  );
  assert.throws(
    () => createDevelopmentGoal({ ...goalInput(), target: 0 }),
    /integer from 1/,
  );
});

test("rejects impossible and reversed goal windows", () => {
  assert.throws(
    () => createDevelopmentGoal({ ...goalInput(), dueDate: "2026-02-30" }),
    /real calendar date/,
  );
  assert.throws(
    () =>
      createDevelopmentGoal({
        ...goalInput(),
        startDate: "2026-10-01",
        dueDate: "2026-09-30",
      }),
    /cannot be later/,
  );
  assert.throws(
    () =>
      createDevelopmentGoal({
        ...goalInput(),
        metric: "consistency-days",
        target: 8,
        startDate: "2026-09-01",
        dueDate: "2026-09-07",
      }),
    /cannot exceed the number of days/,
  );
});

test("counts completed sessions and deduplicates journal identifiers", () => {
  const goal = createDevelopmentGoal({
    ...goalInput(),
    metric: "completed-sessions",
    target: 4,
  });
  const entries = journalEntries();
  const progress = evaluateDevelopmentGoal(
    goal,
    [entries[0]!, ...entries, entries[1]!],
    "2026-09-30",
  );

  assert.equal(progress.currentValue, 3);
  assert.equal(progress.remainingValue, 1);
  assert.equal(progress.progressPercentage, 75);
  assert.deepEqual(
    progress.evidence.map((item) => item.entryId),
    ["entry-three", "entry-two", "entry-one"],
  );
});

test("sums training minutes only inside the inclusive goal window", () => {
  const goal = createDevelopmentGoal(goalInput());
  const progress = evaluateDevelopmentGoal(
    goal,
    journalEntries(),
    "2026-10-10",
  );

  assert.equal(progress.currentValue, 60);
  assert.equal(progress.status, "expired");
  assert.equal(progress.daysRemaining, 0);
  assert.equal(progress.latestContributionAt, "2026-09-03T15:00:00.000Z");
});

test("includes due-date evidence and excludes the following day", () => {
  const goal = createDevelopmentGoal({
    ...goalInput(),
    metric: "completed-sessions",
    target: 2,
  });
  const dueDateEntry = createEntry({
    entryId: "due-date-entry",
    completedAt: "2026-09-30T23:59:00.000Z",
  });
  const nextDayEntry = createEntry({
    entryId: "next-day-entry",
    completedAt: "2026-10-01T00:01:00.000Z",
  });

  const progress = evaluateDevelopmentGoal(
    goal,
    [dueDateEntry, nextDayEntry],
    "2026-10-02",
  );
  assert.equal(progress.currentValue, 1);
  assert.deepEqual(
    progress.evidence.map((item) => item.entryId),
    ["due-date-entry"],
  );
});

test("links focus-minute and effort-load goals to exact entry evidence", () => {
  const focusGoal = createDevelopmentGoal({
    ...goalInput(),
    metric: "focus-minutes",
    focus: "bowling",
    target: 30,
  });
  const focusProgress = evaluateDevelopmentGoal(
    focusGoal,
    journalEntries(),
    "2026-09-30",
  );
  assert.equal(focusProgress.currentValue, 30);
  assert.equal(focusProgress.status, "achieved");
  assert.deepEqual(
    focusProgress.evidence.map((item) => item.contribution),
    [10, 20],
  );

  const effortGoal = createDevelopmentGoal({
    ...goalInput(),
    metric: "effort-load",
    target: 400,
  });
  const effortProgress = evaluateDevelopmentGoal(
    effortGoal,
    journalEntries(),
    "2026-09-30",
  );
  assert.equal(effortProgress.currentValue, 410);
  assert.equal(effortProgress.status, "achieved");
});

test("counts one consistency contribution per active calendar day", () => {
  const goal = createDevelopmentGoal({
    ...goalInput(),
    metric: "consistency-days",
    target: 3,
  });
  const progress = evaluateDevelopmentGoal(
    goal,
    journalEntries(),
    "2026-09-30",
  );

  assert.equal(progress.currentValue, 2);
  assert.deepEqual(
    progress.evidence.map((item) => item.entryId),
    ["entry-three", "entry-one"],
  );
  assert.ok(progress.evidence.every((item) => item.contribution === 1));
});

test("distinguishes not-started, active, achieved, and expired goals", () => {
  const goal = createDevelopmentGoal({
    ...goalInput(),
    metric: "completed-sessions",
    target: 2,
  });

  assert.equal(
    evaluateDevelopmentGoal(goal, journalEntries(), "2026-08-31").status,
    "not-started",
  );
  assert.equal(
    evaluateDevelopmentGoal(goal, journalEntries(), "2026-09-02").status,
    "in-progress",
  );
  assert.equal(
    evaluateDevelopmentGoal(goal, journalEntries(), "2026-09-03").status,
    "achieved",
  );

  const unmet = createDevelopmentGoal({ ...goalInput(), target: 1_000 });
  assert.equal(
    evaluateDevelopmentGoal(unmet, journalEntries(), "2026-10-01").status,
    "expired",
  );
});

test("validates evaluation dates and returns immutable sorted goal progress", () => {
  const later = createDevelopmentGoal({
    ...goalInput(),
    goalId: "later-goal",
    dueDate: "2026-10-31",
  });
  const earlier = createDevelopmentGoal({
    ...goalInput(),
    goalId: "earlier-goal",
    dueDate: "2026-09-15",
  });

  assert.throws(
    () => evaluateDevelopmentGoal(earlier, journalEntries(), "2026-09-31"),
    (error: unknown) =>
      error instanceof DevelopmentGoalValidationError &&
      error.field === "evaluatedOn",
  );

  const progress = evaluateDevelopmentGoals(
    [later, earlier],
    journalEntries(),
    "2026-09-10",
  );
  assert.deepEqual(
    progress.map((item) => item.goal.goalId),
    ["earlier-goal", "later-goal"],
  );
  assert.ok(Object.isFrozen(progress));

  assert.throws(
    () =>
      evaluateDevelopmentGoals(
        [earlier, earlier],
        journalEntries(),
        "2026-09-10",
      ),
    /listed more than once/,
  );
});

test("validates the evaluation date even when no goals exist", () => {
  assert.throws(
    () => evaluateDevelopmentGoals([], [], "2026-02-30"),
    (error: unknown) =>
      error instanceof DevelopmentGoalValidationError &&
      error.field === "evaluatedOn",
  );
});
