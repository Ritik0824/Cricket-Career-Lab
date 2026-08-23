import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import { createPrivateBackup } from "../storage/privateBackupRecord.js";
import {
  formatPrivateBackupSummary,
  toPrivateBackupSummaryView,
} from "./formatBackup.js";

test("summarizes backup evidence without exposing embedded notes", () => {
  const plan = createSessionPlan({
    title: "Backup summary",
    scheduledFor: "2026-09-10",
    drills: [
      {
        id: "backup-summary",
        name: "Backup summary drill",
        focus: "recovery",
        minutes: 10,
        intensity: "low",
      },
    ],
  });
  const entry = completeTrainingSession({
    entryId: "backup-summary-entry",
    plan,
    completedAt: "2026-09-10T08:00:00.000Z",
    drills: [
      {
        drillId: "backup-summary",
        completedMinutes: 10,
        perceivedEffort: 3,
        note: "Private embedded note.",
      },
    ],
    sessionNote: "Private embedded session note.",
  });
  const backup = createPrivateBackup(
    [],
    [entry],
    "2026-10-01T08:00:00.000Z",
  );
  const text = formatPrivateBackupSummary(backup);
  const view = toPrivateBackupSummaryView(backup);

  assert.match(text, /Journal entries: 1/);
  assert.match(text, /backup-summary-entry/);
  assert.match(text, /notes are stored.*omitted/);
  assert.doesNotMatch(text, /Private embedded/);
  assert.equal(view.version, 1);
  assert.deepEqual(view.journalEntries, [
    {
      entryId: "backup-summary-entry",
      completedAt: "2026-09-10T08:00:00.000Z",
    },
  ]);
  assert.doesNotMatch(JSON.stringify(view), /Private embedded/);
});
