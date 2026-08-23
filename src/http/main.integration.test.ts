import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

interface ProcessResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runProcess(argumentsList: readonly string[]): Promise<ProcessResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      [resolve("dist/http/main.js"), ...argumentsList],
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

function startProcess(
  argumentsList: readonly string[],
): Promise<{
  child: ChildProcessWithoutNullStreams;
  origin: string;
  readStderr: () => string;
}> {
  return new Promise((resolveStart, reject) => {
    const child = spawn(
      process.execPath,
      [resolve("dist/http/main.js"), ...argumentsList],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`local server did not start; stdout=${stdout}; stderr=${stderr}`));
    }, 5_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      const match = /available at (http:\/\/127\.0\.0\.1:\d+)/.exec(stdout);

      if (match?.[1] !== undefined) {
        clearTimeout(timeout);
        resolveStart({
          child,
          origin: match[1],
          readStderr: () => stderr,
        });
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timeout);
      reject(new Error(`local server exited before startup with ${exitCode}`));
    });
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", resolveExit);
  });
}

test("compiled local server prints help and rejects remote hosts", async () => {
  const help = await runProcess(["--help"]);
  assert.equal(help.exitCode, 0);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /loopback-only HTTP API/);

  const remote = await runProcess(["--host", "0.0.0.0"]);
  assert.equal(remote.exitCode, 1);
  assert.match(remote.stderr, /host must be one of/);
});

test("compiled local server accepts HTTP and shuts down on SIGTERM", async () => {
  const directory = await mkdtemp(join(tmpdir(), "career-http-main-"));
  const started = await startProcess([
    "--port",
    "0",
    "--goals",
    join(directory, "goals"),
    "--journal",
    join(directory, "journal"),
  ]);

  try {
    const page = await fetch(started.origin);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await page.text(), /Current training picture/);

    const script = await fetch(`${started.origin}/assets/app.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /loadDashboard/);

    const response = await fetch(`${started.origin}/api/health`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /local-read-only/);

    const exitPromise = waitForExit(started.child);
    assert.equal(started.child.kill("SIGTERM"), true);
    assert.equal(await exitPromise, 0);
    assert.equal(started.readStderr(), "");
  } finally {
    if (!started.child.killed) {
      started.child.kill("SIGTERM");
    }
    await rm(directory, { recursive: true, force: true });
  }
});
