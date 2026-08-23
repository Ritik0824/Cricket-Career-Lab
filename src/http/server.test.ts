import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  startLocalServer,
  LocalServerValidationError,
} from "./server.js";

test("starts on an ephemeral loopback port and serves the API", async () => {
  const directory = await mkdtemp(join(tmpdir(), "career-http-server-"));
  const running = await startLocalServer({
    port: 0,
    goalsDirectory: join(directory, "goals"),
    journalDirectory: join(directory, "journal"),
    now: () => new Date("2026-09-14T12:00:00.000Z"),
  });

  try {
    assert.equal(running.host, "127.0.0.1");
    assert.ok(running.port > 0);
    assert.match(running.origin, /^http:\/\/127\.0\.0\.1:\d+$/);

    const response = await fetch(`${running.origin}/api/health`);
    const body = (await response.json()) as {
      data: { status: string; privacy: string };
    };
    assert.equal(response.status, 200);
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.privacy, "local-read-only");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok(Number(response.headers.get("content-length")) > 0);
  } finally {
    await running.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("passes method and validation responses through the HTTP adapter", async () => {
  const directory = await mkdtemp(join(tmpdir(), "career-http-server-"));
  const running = await startLocalServer({
    port: 0,
    goalsDirectory: join(directory, "goals"),
    journalDirectory: join(directory, "journal"),
    now: () => new Date("2026-09-14T12:00:00.000Z"),
  });

  try {
    const method = await fetch(`${running.origin}/api/health`, {
      method: "POST",
    });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "GET");

    const invalid = await fetch(
      `${running.origin}/api/workload/month?month=2026-13`,
    );
    assert.equal(invalid.status, 400);
    assert.match(await invalid.text(), /INVALID_QUERY/);
  } finally {
    await running.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects remote bindings and invalid ports before opening a socket", async () => {
  await assert.rejects(
    () =>
      startLocalServer({
        host: "0.0.0.0",
        goalsDirectory: ".career/goals",
        journalDirectory: ".career/journal",
        now: () => new Date(),
      }),
    (error: unknown) =>
      error instanceof LocalServerValidationError && error.field === "host",
  );
  await assert.rejects(
    () =>
      startLocalServer({
        port: 65_536,
        goalsDirectory: ".career/goals",
        journalDirectory: ".career/journal",
        now: () => new Date(),
      }),
    (error: unknown) =>
      error instanceof LocalServerValidationError && error.field === "port",
  );
});
