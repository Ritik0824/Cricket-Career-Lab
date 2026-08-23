import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadSessionPlanFile } from "../storage/sessionPlanFileStore.js";
import { DevelopmentGoalFileRepository } from "../storage/developmentGoalRepository.js";
import { TrainingJournalFileRepository } from "../storage/trainingJournalRepository.js";
import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import { runCli, type CliEnvironment } from "./runCli.js";

const FIXED_NOW = new Date("2026-08-23T16:30:00.000Z");

function draftJson(): string {
  return JSON.stringify({
    title: "Death-over yorkers",
    scheduledFor: "2026-09-01",
    drills: [
      {
        id: "base-yorker",
        name: "Base-of-stump yorker",
        focus: "bowling",
        minutes: 24,
        intensity: "high",
      },
      {
        id: "slow-ball-release",
        name: "Slower-ball release",
        focus: "bowling",
        minutes: 16,
        intensity: "moderate",
      },
    ],
  });
}

function completionJson(effort = 8): string {
  return JSON.stringify({
    entryId: "death-over-entry",
    drills: [
      {
        drillId: "base-yorker",
        completedMinutes: 22,
        perceivedEffort: effort,
        note: "Missed fewer yorkers after shortening the run-up.",
      },
      {
        drillId: "slow-ball-release",
        completedMinutes: 16,
        perceivedEffort: 7,
      },
    ],
    sessionNote: "Repeat the final six-ball set.",
  });
}

function captureEnvironment(): {
  environment: CliEnvironment;
  output: string[];
  errors: string[];
} {
  const output: string[] = [];
  const errors: string[] = [];

  return {
    environment: {
      now: () => FIXED_NOW,
      writeOutput: (text) => output.push(text),
      writeError: (text) => errors.push(text),
    },
    output,
    errors,
  };
}

async function withTemporaryDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "cricket-career-cli-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("creates a validated record using the injected application clock", async () => {
  await withTemporaryDirectory(async (directory) => {
    const draftPath = join(directory, "draft.json");
    const planPath = join(directory, "private", "plan.json");
    await writeFile(draftPath, draftJson(), "utf8");
    const capture = captureEnvironment();

    const exitCode = await runCli(
      ["plan", "create", "--from", draftPath, "--to", planPath],
      capture.environment,
    );
    const stored = await loadSessionPlanFile(planPath);

    assert.equal(exitCode, 0);
    assert.equal(stored.savedAt, FIXED_NOW.toISOString());
    assert.equal(stored.plan.totalMinutes, 40);
    assert.match(capture.output.join(""), /Saved "Death-over yorkers"/);
    assert.deepEqual(capture.errors, []);
  });
});

test("shows saved plans as text and canonical JSON", async () => {
  await withTemporaryDirectory(async (directory) => {
    const draftPath = join(directory, "draft.json");
    const planPath = join(directory, "plan.json");
    await writeFile(draftPath, draftJson(), "utf8");
    const createCapture = captureEnvironment();
    await runCli(
      [
        "plan",
        "create",
        "--from",
        draftPath,
        "--to",
        planPath,
        "--saved-at",
        "2026-08-23T17:00:00.000Z",
      ],
      createCapture.environment,
    );

    const textCapture = captureEnvironment();
    assert.equal(
      await runCli(["plan", "show", planPath], textCapture.environment),
      0,
    );
    assert.match(textCapture.output.join(""), /Workload: 104 points/);
    assert.match(textCapture.output.join(""), /- Bowling: 40 min/);

    const jsonCapture = captureEnvironment();
    assert.equal(
      await runCli(
        ["plan", "show", planPath, "--json"],
        jsonCapture.environment,
      ),
      0,
    );
    const record = JSON.parse(jsonCapture.output.join("")) as Record<
      string,
      unknown
    >;
    assert.equal(record.version, 1);
    assert.equal(record.savedAt, "2026-08-23T17:00:00.000Z");
  });
});

test("returns usage status 2 without performing work", async () => {
  const capture = captureEnvironment();
  const exitCode = await runCli(
    ["plan", "create", "--from", "draft.json"],
    capture.environment,
  );

  assert.equal(exitCode, 2);
  assert.deepEqual(capture.output, []);
  assert.match(capture.errors.join(""), /requires --to/);
  assert.match(capture.errors.join(""), /Usage:/);
});

test("reports invalid drafts and missing records as operational failures", async () => {
  await withTemporaryDirectory(async (directory) => {
    const draftPath = join(directory, "invalid.json");
    const planPath = join(directory, "plan.json");
    await writeFile(draftPath, "{invalid", "utf8");
    const draftCapture = captureEnvironment();

    assert.equal(
      await runCli(
        ["plan", "create", "--from", draftPath, "--to", planPath],
        draftCapture.environment,
      ),
      1,
    );
    assert.match(draftCapture.errors.join(""), /draft invalid_json/);

    const missingCapture = captureEnvironment();
    assert.equal(
      await runCli(["plan", "show", planPath], missingCapture.environment),
      1,
    );
    assert.match(missingCapture.errors.join(""), /plan file not_found/);
  });
});

test("prints help without reading or writing plan files", async () => {
  const capture = captureEnvironment();

  assert.equal(await runCli(["--help"], capture.environment), 0);
  assert.match(capture.output.join(""), /Cricket Career Lab/);
  assert.match(capture.output.join(""), /plan create/);
  assert.deepEqual(capture.errors, []);
});

test("completes a plan and supports journal list, show, and delete", async () => {
  await withTemporaryDirectory(async (directory) => {
    const draftPath = join(directory, "plan-draft.json");
    const planPath = join(directory, "plan.json");
    const completionPath = join(directory, "completion.json");
    const journalPath = join(directory, "journal");
    await writeFile(draftPath, draftJson(), "utf8");
    await writeFile(completionPath, completionJson(), "utf8");
    await runCli(
      ["plan", "create", "--from", draftPath, "--to", planPath],
      captureEnvironment().environment,
    );

    const completeCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "journal",
          "complete",
          "--plan",
          planPath,
          "--from",
          completionPath,
          "--journal",
          journalPath,
        ],
        completeCapture.environment,
      ),
      0,
    );
    const repository = new TrainingJournalFileRepository(journalPath);
    const saved = await repository.load("death-over-entry");
    assert.equal(saved.completedAt, FIXED_NOW.toISOString());
    assert.equal(saved.status, "partial");
    assert.equal(saved.completedMinutes, 38);
    assert.match(completeCapture.output.join(""), /Recorded "Death-over yorkers"/);

    const listCapture = captureEnvironment();
    assert.equal(
      await runCli(
        ["journal", "list", "--journal", journalPath],
        listCapture.environment,
      ),
      0,
    );
    assert.match(listCapture.output.join(""), /death-over-entry/);
    assert.doesNotMatch(listCapture.output.join(""), /Repeat the final/);

    const jsonListCapture = captureEnvironment();
    assert.equal(
      await runCli(
        ["journal", "list", "--journal", journalPath, "--json"],
        jsonListCapture.environment,
      ),
      0,
    );
    const records = JSON.parse(jsonListCapture.output.join("")) as Array<
      Record<string, unknown>
    >;
    assert.equal(records.length, 1);
    assert.equal(records[0]?.entryId, "death-over-entry");

    const showCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "journal",
          "show",
          "death-over-entry",
          "--journal",
          journalPath,
        ],
        showCapture.environment,
      ),
      0,
    );
    assert.match(showCapture.output.join(""), /Average effort:/);
    assert.match(showCapture.output.join(""), /Session note/);

    const deleteCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "journal",
          "delete",
          "death-over-entry",
          "--journal",
          journalPath,
        ],
        deleteCapture.environment,
      ),
      0,
    );
    assert.match(deleteCapture.output.join(""), /Deleted journal entry/);
    assert.deepEqual(await repository.list(), []);

    const missingDeleteCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "journal",
          "delete",
          "death-over-entry",
          "--journal",
          journalPath,
        ],
        missingDeleteCapture.environment,
      ),
      0,
    );
    assert.match(missingDeleteCapture.output.join(""), /was found/);
  });
});

test("reports completion-domain failures without creating a journal entry", async () => {
  await withTemporaryDirectory(async (directory) => {
    const draftPath = join(directory, "plan-draft.json");
    const planPath = join(directory, "plan.json");
    const completionPath = join(directory, "completion.json");
    const journalPath = join(directory, "journal");
    await writeFile(draftPath, draftJson(), "utf8");
    await writeFile(completionPath, completionJson(11), "utf8");
    await runCli(
      ["plan", "create", "--from", draftPath, "--to", planPath],
      captureEnvironment().environment,
    );
    const capture = captureEnvironment();

    assert.equal(
      await runCli(
        [
          "journal",
          "complete",
          "--plan",
          planPath,
          "--from",
          completionPath,
          "--journal",
          journalPath,
        ],
        capture.environment,
      ),
      1,
    );
    assert.match(capture.errors.join(""), /journal entry invalid/);
    assert.deepEqual(
      await new TrainingJournalFileRepository(journalPath).list(),
      [],
    );
  });
});

test("filters journal lists through the public command", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(directory);
    const plan = createSessionPlan({
      title: "Seam control session",
      scheduledFor: "2026-09-10",
      drills: [
        {
          id: "seam-control",
          name: "Upright seam control",
          focus: "bowling",
          minutes: 20,
          intensity: "moderate",
        },
      ],
    });
    await repository.save(
      completeTrainingSession({
        entryId: "seam-partial",
        plan,
        completedAt: "2026-09-10T09:00:00.000Z",
        drills: [
          {
            drillId: "seam-control",
            completedMinutes: 12,
            perceivedEffort: 7,
            note: "Seam stayed upright.",
          },
        ],
      }),
    );
    await repository.save(
      completeTrainingSession({
        entryId: "seam-complete",
        plan,
        completedAt: "2026-09-11T09:00:00.000Z",
        drills: [
          {
            drillId: "seam-control",
            completedMinutes: 20,
            perceivedEffort: 8,
          },
        ],
      }),
    );

    const capture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "journal",
          "list",
          "--journal",
          directory,
          "--from",
          "2026-09-10",
          "--to",
          "2026-09-10",
          "--focus",
          "BOWLING",
          "--intensity",
          "moderate",
          "--status",
          "partial",
          "--text",
          "upright",
          "--limit",
          "1",
        ],
        capture.environment,
      ),
      0,
    );
    assert.match(capture.output.join(""), /seam-partial/);
    assert.doesNotMatch(capture.output.join(""), /seam-complete/);

    const invalidCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "journal",
          "list",
          "--journal",
          directory,
          "--focus",
          "captaincy",
        ],
        invalidCapture.environment,
      ),
      1,
    );
    assert.match(invalidCapture.errors.join(""), /journal query invalid at focus/);
  });
});

test("creates, evaluates, shows, and deletes live development goals", async () => {
  await withTemporaryDirectory(async (directory) => {
    const goalsPath = join(directory, "goals");
    const journalPath = join(directory, "journal");
    const goalDraftPath = join(directory, "goal.json");
    await writeFile(
      goalDraftPath,
      JSON.stringify({
        goalId: "seam-volume",
        title: "Build seam bowling volume",
        metric: "focus-minutes",
        target: 60,
        startDate: "2026-09-01",
        dueDate: "2026-09-30",
        focus: "bowling",
      }),
      "utf8",
    );

    const plan = createSessionPlan({
      title: "Seam movement",
      scheduledFor: "2026-09-10",
      drills: [
        {
          id: "wobble-seam",
          name: "Wobble seam release",
          focus: "bowling",
          minutes: 30,
          intensity: "moderate",
        },
      ],
    });
    await new TrainingJournalFileRepository(journalPath).save(
      completeTrainingSession({
        entryId: "wobble-seam-entry",
        plan,
        completedAt: "2026-09-10T07:30:00.000Z",
        drills: [
          {
            drillId: "wobble-seam",
            completedMinutes: 24,
            perceivedEffort: 7,
            note: "Private wrist cue.",
          },
        ],
        sessionNote: "Private follow-up note.",
      }),
    );

    const createCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "goal",
          "create",
          "--from",
          goalDraftPath,
          "--goals",
          goalsPath,
        ],
        createCapture.environment,
      ),
      0,
    );
    assert.match(createCapture.output.join(""), /Saved goal.*seam-volume/);
    assert.equal(
      (await new DevelopmentGoalFileRepository(goalsPath).load("seam-volume"))
        .target,
      60,
    );

    const listCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "goal",
          "list",
          "--goals",
          goalsPath,
          "--journal",
          journalPath,
          "--as-of",
          "2026-09-10",
        ],
        listCapture.environment,
      ),
      0,
    );
    assert.match(listCapture.output.join(""), /seam-volume/);
    assert.match(listCapture.output.join(""), /24\/60 min \(40%\)/);
    assert.doesNotMatch(listCapture.output.join(""), /Private/);

    const showCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "goal",
          "show",
          "seam-volume",
          "--goals",
          goalsPath,
          "--journal",
          journalPath,
          "--as-of",
          "2026-09-10",
          "--json",
        ],
        showCapture.environment,
      ),
      0,
    );
    const view = JSON.parse(showCapture.output.join("")) as {
      goal: Record<string, unknown>;
      progress: {
        currentValue: number;
        evidence: Array<Record<string, unknown>>;
      };
    };
    assert.equal(view.goal.version, 1);
    assert.equal(view.progress.currentValue, 24);
    assert.equal(view.progress.evidence[0]?.entryId, "wobble-seam-entry");
    assert.doesNotMatch(showCapture.output.join(""), /Private/);

    const deleteCapture = captureEnvironment();
    assert.equal(
      await runCli(
        ["goal", "delete", "seam-volume", "--goals", goalsPath],
        deleteCapture.environment,
      ),
      0,
    );
    assert.match(deleteCapture.output.join(""), /Deleted development goal/);

    const missingDeleteCapture = captureEnvironment();
    assert.equal(
      await runCli(
        ["goal", "delete", "seam-volume", "--goals", goalsPath],
        missingDeleteCapture.environment,
      ),
      0,
    );
    assert.match(missingDeleteCapture.output.join(""), /was found/);
  });
});

test("reports invalid goal drafts and evaluation dates without partial writes", async () => {
  await withTemporaryDirectory(async (directory) => {
    const goalsPath = join(directory, "goals");
    const invalidDraftPath = join(directory, "invalid-goal.json");
    await writeFile(
      invalidDraftPath,
      JSON.stringify({
        goalId: "invalid-window",
        title: "Invalid window",
        metric: "training-minutes",
        target: 20,
        startDate: "2026-09-10",
        dueDate: "2026-09-01",
      }),
      "utf8",
    );
    const draftCapture = captureEnvironment();

    assert.equal(
      await runCli(
        [
          "goal",
          "create",
          "--from",
          invalidDraftPath,
          "--goals",
          goalsPath,
        ],
        draftCapture.environment,
      ),
      1,
    );
    assert.match(draftCapture.errors.join(""), /goal draft invalid_goal/);
    assert.deepEqual(
      await new DevelopmentGoalFileRepository(goalsPath).list(),
      [],
    );

    const dateCapture = captureEnvironment();
    assert.equal(
      await runCli(
        [
          "goal",
          "list",
          "--goals",
          goalsPath,
          "--journal",
          join(directory, "journal"),
          "--as-of",
          "2026-02-30",
        ],
        dateCapture.environment,
      ),
      1,
    );
    assert.match(dateCapture.errors.join(""), /goal invalid at evaluatedOn/);
  });
});
