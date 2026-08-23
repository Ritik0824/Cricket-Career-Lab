import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import { formatJournalEntry, formatJournalList } from "./formatJournal.js";

function entry() {
  const plan = createSessionPlan({
    title: "Boundary catching",
    scheduledFor: "2026-09-08",
    drills: [
      {
        id: "high-ball",
        name: "High-ball tracking",
        focus: "fielding",
        minutes: 20,
        intensity: "high",
      },
      {
        id: "reset",
        name: "Breathing reset",
        focus: "recovery",
        minutes: 10,
        intensity: "low",
      },
    ],
  });

  return completeTrainingSession({
    entryId: "boundary-entry",
    plan,
    completedAt: "2026-09-08T10:00:00.000Z",
    drills: [
      {
        drillId: "high-ball",
        completedMinutes: 18,
        perceivedEffort: 7,
        note: "Tracked the ball earlier.",
      },
    ],
    sessionNote: "Repeat under lights.",
  });
}

test("formats a completed entry with effort and private notes", () => {
  const output = formatJournalEntry(entry());

  assert.match(output, /Status: Partial/);
  assert.match(output, /Time: 18\/30 min \(60%\)/);
  assert.match(output, /Variance: -12 min/);
  assert.match(output, /High-ball tracking — 18\/20 min, partial, effort 7\/10/);
  assert.match(output, /Breathing reset — 0\/10 min, skipped, no effort/);
  assert.match(output, /Note: Tracked the ball earlier\./);
  assert.match(output, /Session note\nRepeat under lights\./);
});

test("formats newest-first collections without exposing private notes", () => {
  const one = entry();
  const output = formatJournalList([one]);

  assert.match(output, /Training journal — 1 entry/);
  assert.match(output, /boundary-entry \| partial \| 18\/30 min/);
  assert.doesNotMatch(output, /Repeat under lights/);
  assert.equal(formatJournalList([]), "Training journal is empty.");
});
