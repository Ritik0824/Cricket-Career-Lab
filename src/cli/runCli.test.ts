import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadSessionPlanFile } from "../storage/sessionPlanFileStore.js";
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
