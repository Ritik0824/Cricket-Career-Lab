import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCliArguments,
  CliUsageError,
  type CliCommand,
} from "./arguments.js";

test("empty and explicit help arguments select help", () => {
  assert.deepEqual(parseCliArguments([]), { kind: "help" });
  assert.deepEqual(parseCliArguments(["--help"]), { kind: "help" });
  assert.deepEqual(parseCliArguments(["plan", "show", "--help"]), {
    kind: "help",
  });
});

test("parses required and optional plan-create arguments", () => {
  assert.deepEqual(
    parseCliArguments([
      "plan",
      "create",
      "--from",
      "draft.json",
      "--to",
      "plan.json",
      "--saved-at",
      "2026-08-23T16:00:00.000Z",
    ]),
    {
      kind: "plan-create",
      from: "draft.json",
      to: "plan.json",
      savedAt: "2026-08-23T16:00:00.000Z",
    },
  );

  const withoutClock: CliCommand = parseCliArguments([
    "plan",
    "create",
    "--to",
    "plan.json",
    "--from",
    "draft.json",
  ]);
  assert.deepEqual(withoutClock, {
    kind: "plan-create",
    from: "draft.json",
    to: "plan.json",
  });
});

test("parses text and JSON plan-show commands", () => {
  assert.deepEqual(parseCliArguments(["plan", "show", "plan.json"]), {
    kind: "plan-show",
    filePath: "plan.json",
    json: false,
  });
  assert.deepEqual(
    parseCliArguments(["plan", "show", "--json", "plan.json"]),
    {
      kind: "plan-show",
      filePath: "plan.json",
      json: true,
    },
  );
});

test("rejects missing, duplicate, and unknown create options", () => {
  assert.throws(
    () => parseCliArguments(["plan", "create", "--from", "draft.json"]),
    (error: unknown) =>
      error instanceof CliUsageError && /requires --to/.test(error.message),
  );
  assert.throws(
    () =>
      parseCliArguments([
        "plan",
        "create",
        "--from",
        "one.json",
        "--from",
        "two.json",
        "--to",
        "plan.json",
      ]),
    /only be provided once/,
  );
  assert.throws(
    () =>
      parseCliArguments([
        "plan",
        "create",
        "--from",
        "draft.json",
        "--to",
        "plan.json",
        "--publish",
        "yes",
      ]),
    /unknown create option --publish/,
  );
});

test("rejects incomplete show and unknown command forms", () => {
  assert.throws(
    () => parseCliArguments(["plan", "show"]),
    /requires <plan.json>/,
  );
  assert.throws(
    () => parseCliArguments(["plan", "show", "one.json", "two.json"]),
    /unexpected show argument/,
  );
  assert.throws(() => parseCliArguments(["sync"]), /unknown command sync/);
  assert.throws(
    () => parseCliArguments(["plan", "delete"]),
    /unknown plan command delete/,
  );
});
