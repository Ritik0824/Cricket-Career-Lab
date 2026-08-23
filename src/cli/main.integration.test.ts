import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

interface ProcessResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runExecutable(argumentsList: readonly string[]): Promise<ProcessResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      [resolve("dist/cli/main.js"), ...argumentsList],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolveResult({ exitCode, stdout, stderr });
    });
  });
}

test("compiled executable creates and displays a private plan", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cricket-career-e2e-"));

  try {
    const draftPath = join(directory, "draft.json");
    const planPath = join(directory, "plan.json");
    await writeFile(
      draftPath,
      JSON.stringify({
        title: "Running between wickets",
        scheduledFor: "2026-09-02",
        drills: [
          {
            id: "two-turns",
            name: "Two-run turns",
            focus: "fitness",
            minutes: 20,
            intensity: "high",
          },
        ],
      }),
      "utf8",
    );

    const create = await runExecutable([
      "plan",
      "create",
      "--from",
      draftPath,
      "--to",
      planPath,
      "--saved-at",
      "2026-08-23T18:00:00.000Z",
    ]);
    assert.equal(create.exitCode, 0);
    assert.equal(create.stderr, "");
    assert.match(create.stdout, /Saved "Running between wickets"/);

    const show = await runExecutable(["plan", "show", planPath]);
    assert.equal(show.exitCode, 0);
    assert.equal(show.stderr, "");
    assert.match(show.stdout, /Duration: 20 min/);
    assert.match(show.stdout, /Focus\n- Fitness: 20 min/);

    const completionPath = join(directory, "completion.json");
    const journalPath = join(directory, "journal");
    await writeFile(
      completionPath,
      JSON.stringify({
        entryId: "running-entry",
        drills: [
          {
            drillId: "two-turns",
            completedMinutes: 18,
            perceivedEffort: 8,
          },
        ],
        sessionNote: "Turning technique improved.",
      }),
      "utf8",
    );

    const complete = await runExecutable([
      "journal",
      "complete",
      "--plan",
      planPath,
      "--from",
      completionPath,
      "--journal",
      journalPath,
      "--completed-at",
      "2026-09-02T12:00:00.000Z",
    ]);
    assert.equal(complete.exitCode, 0);
    assert.equal(complete.stderr, "");
    assert.match(complete.stdout, /Recorded "Running between wickets"/);

    const journal = await runExecutable([
      "journal",
      "show",
      "running-entry",
      "--journal",
      journalPath,
    ]);
    assert.equal(journal.exitCode, 0);
    assert.match(journal.stdout, /Status: Partial/);
    assert.match(journal.stdout, /Turning technique improved/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
