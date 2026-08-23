import assert from "node:assert/strict";
import test from "node:test";

import {
  parseLocalServerArguments,
  LocalServerUsageError,
  LOCAL_SERVER_DEFAULT_GOALS,
  LOCAL_SERVER_DEFAULT_HOST,
  LOCAL_SERVER_DEFAULT_JOURNAL,
  LOCAL_SERVER_DEFAULT_PORT,
} from "./arguments.js";

test("parses help and default local server settings", () => {
  assert.deepEqual(parseLocalServerArguments(["--help"]), { kind: "help" });
  assert.deepEqual(parseLocalServerArguments([]), {
    kind: "start",
    host: LOCAL_SERVER_DEFAULT_HOST,
    port: LOCAL_SERVER_DEFAULT_PORT,
    goalsDirectory: LOCAL_SERVER_DEFAULT_GOALS,
    journalDirectory: LOCAL_SERVER_DEFAULT_JOURNAL,
  });
});

test("parses explicit server directories and socket settings", () => {
  assert.deepEqual(
    parseLocalServerArguments([
      "--journal",
      "private/journal",
      "--port",
      "0",
      "--host",
      "localhost",
      "--goals",
      "private/goals",
    ]),
    {
      kind: "start",
      host: "localhost",
      port: 0,
      goalsDirectory: "private/goals",
      journalDirectory: "private/journal",
    },
  );
});

test("rejects missing, duplicate, unknown, and non-integer options", () => {
  assert.throws(
    () => parseLocalServerArguments(["--port"]),
    (error: unknown) =>
      error instanceof LocalServerUsageError && /requires a value/.test(error.message),
  );
  assert.throws(
    () => parseLocalServerArguments(["--port", "4317", "--port", "4318"]),
    /only be provided once/,
  );
  assert.throws(
    () => parseLocalServerArguments(["--port", "many"]),
    /requires an integer/,
  );
  assert.throws(
    () => parseLocalServerArguments(["--public"]),
    /unknown local server option --public/,
  );
});
