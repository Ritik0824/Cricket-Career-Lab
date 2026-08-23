import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "./sessionPlan.js";
import {
  completeTrainingSession,
  type TrainingJournalEntry,
} from "./trainingJournal.js";
import {
  filterTrainingJournal,
  normalizeTrainingJournalQuery,
  TrainingJournalQueryError,
} from "./trainingJournalQuery.js";

interface EntryOptions {
  readonly entryId: string;
  readonly completedAt: string;
  readonly focus: "batting" | "bowling" | "fielding";
  readonly intensity: "low" | "moderate" | "high";
  readonly completedMinutes: number;
  readonly note?: string;
}

function createEntry(options: EntryOptions): TrainingJournalEntry {
  const plan = createSessionPlan({
    title: `${options.focus} development`,
    scheduledFor: options.completedAt.slice(0, 10),
    drills: [
      {
        id: `${options.focus}-drill`,
        name: `${options.focus} control drill`,
        focus: options.focus,
        minutes: 20,
        intensity: options.intensity,
      },
    ],
  });

  return completeTrainingSession({
    entryId: options.entryId,
    plan,
    completedAt: options.completedAt,
    drills:
      options.completedMinutes === 0
        ? []
        : [
            {
              drillId: `${options.focus}-drill`,
              completedMinutes: options.completedMinutes,
              perceivedEffort: 7,
              ...(options.note === undefined ? {} : { note: options.note }),
            },
          ],
    ...(options.note === undefined
      ? {}
      : { sessionNote: `Session: ${options.note}` }),
  });
}

function entries(): readonly TrainingJournalEntry[] {
  return [
    createEntry({
      entryId: "batting-entry",
      completedAt: "2026-09-10T10:00:00.000Z",
      focus: "batting",
      intensity: "high",
      completedMinutes: 20,
      note: "Sweep contact improved",
    }),
    createEntry({
      entryId: "bowling-entry",
      completedAt: "2026-09-09T10:00:00.000Z",
      focus: "bowling",
      intensity: "moderate",
      completedMinutes: 12,
      note: "Seam stayed upright",
    }),
    createEntry({
      entryId: "missed-fielding",
      completedAt: "2026-09-08T10:00:00.000Z",
      focus: "fielding",
      intensity: "low",
      completedMinutes: 0,
      note: "Rain interruption",
    }),
  ];
}

test("normalizes case, whitespace, and empty optional filters", () => {
  assert.deepEqual(
    normalizeTrainingJournalQuery({
      from: "2026-09-08",
      to: "2026-09-10",
      focus: " BATTING ",
      intensity: " HIGH ",
      status: " COMPLETED ",
      text: "  Sweep   Contact ",
      limit: 5,
    }),
    {
      from: "2026-09-08",
      to: "2026-09-10",
      focus: "batting",
      intensity: "high",
      status: "completed",
      text: "sweep contact",
      limit: 5,
    },
  );
  assert.ok(Object.isFrozen(normalizeTrainingJournalQuery()));
});

test("filters completion dates inclusively and sorts newest first", () => {
  const filtered = filterTrainingJournal([...entries()].reverse(), {
    from: "2026-09-09",
    to: "2026-09-10",
  });

  assert.deepEqual(
    filtered.map((entry) => entry.entryId),
    ["batting-entry", "bowling-entry"],
  );
  assert.ok(Object.isFrozen(filtered));
});

test("matches focus and planned intensity only on performed drills", () => {
  assert.deepEqual(
    filterTrainingJournal(entries(), { focus: "bowling" }).map(
      (entry) => entry.entryId,
    ),
    ["bowling-entry"],
  );
  assert.deepEqual(
    filterTrainingJournal(entries(), { intensity: "high" }).map(
      (entry) => entry.entryId,
    ),
    ["batting-entry"],
  );
  assert.deepEqual(filterTrainingJournal(entries(), { focus: "fielding" }), []);
});

test("filters completed, partial, and missed outcomes", () => {
  assert.deepEqual(
    filterTrainingJournal(entries(), { status: "completed" }).map(
      (entry) => entry.entryId,
    ),
    ["batting-entry"],
  );
  assert.deepEqual(
    filterTrainingJournal(entries(), { status: "partial" }).map(
      (entry) => entry.entryId,
    ),
    ["bowling-entry"],
  );
  assert.deepEqual(
    filterTrainingJournal(entries(), { status: "missed" }).map(
      (entry) => entry.entryId,
    ),
    ["missed-fielding"],
  );
});

test("searches identifiers, titles, drill details, and private notes", () => {
  assert.equal(filterTrainingJournal(entries(), { text: "seam" }).length, 1);
  assert.equal(
    filterTrainingJournal(entries(), { text: "batting development" })[0]
      ?.entryId,
    "batting-entry",
  );
  assert.equal(
    filterTrainingJournal(entries(), { text: "rain interruption" })[0]
      ?.entryId,
    "missed-fielding",
  );
  assert.deepEqual(filterTrainingJournal(entries(), { text: "unmatched" }), []);
});

test("combines filters and applies the limit after sorting", () => {
  const combined = filterTrainingJournal(entries(), {
    from: "2026-09-01",
    status: "partial",
    focus: "bowling",
    text: "upright",
    limit: 1,
  });
  assert.deepEqual(combined.map((entry) => entry.entryId), ["bowling-entry"]);

  const limited = filterTrainingJournal([...entries()].reverse(), { limit: 2 });
  assert.deepEqual(
    limited.map((entry) => entry.entryId),
    ["batting-entry", "bowling-entry"],
  );
});

test("rejects malformed, impossible, and reversed date ranges", () => {
  assert.throws(
    () => normalizeTrainingJournalQuery({ from: "09-01-2026" }),
    (error: unknown) =>
      error instanceof TrainingJournalQueryError && error.field === "from",
  );
  assert.throws(
    () => normalizeTrainingJournalQuery({ to: "2026-02-30" }),
    /real calendar date/,
  );
  assert.throws(
    () =>
      normalizeTrainingJournalQuery({
        from: "2026-09-10",
        to: "2026-09-09",
      }),
    /cannot be later/,
  );
});

test("rejects unsupported facets, empty text, and unbounded limits", () => {
  assert.throws(
    () => normalizeTrainingJournalQuery({ focus: "captaincy" }),
    /focus must be one of/,
  );
  assert.throws(
    () => normalizeTrainingJournalQuery({ intensity: "extreme" }),
    /intensity must be one of/,
  );
  assert.throws(
    () => normalizeTrainingJournalQuery({ status: "abandoned" }),
    /status must be one of/,
  );
  assert.throws(
    () => normalizeTrainingJournalQuery({ text: "   " }),
    /text cannot be empty/,
  );
  assert.throws(
    () => normalizeTrainingJournalQuery({ limit: 0 }),
    /integer from 1 to 100/,
  );
  assert.throws(
    () => normalizeTrainingJournalQuery({ limit: 101 }),
    /integer from 1 to 100/,
  );
});
