#!/usr/bin/env node

import {
  parseLocalServerArguments,
  LOCAL_SERVER_HELP,
  LocalServerUsageError,
} from "./arguments.js";
import {
  startLocalServer,
  LocalServerValidationError,
} from "./server.js";

async function main(): Promise<void> {
  let command;

  try {
    command = parseLocalServerArguments(process.argv.slice(2));
  } catch (error) {
    if (error instanceof LocalServerUsageError) {
      process.stderr.write(`Error: ${error.message}\n\n${LOCAL_SERVER_HELP}\n`);
      process.exitCode = 2;
      return;
    }

    throw error;
  }

  if (command.kind === "help") {
    process.stdout.write(`${LOCAL_SERVER_HELP}\n`);
    return;
  }

  try {
    const running = await startLocalServer({
      host: command.host,
      port: command.port,
      goalsDirectory: command.goalsDirectory,
      journalDirectory: command.journalDirectory,
      now: () => new Date(),
    });
    process.stdout.write(
      [
        `Cricket Career Lab is available at ${running.origin}`,
        `Goals: ${command.goalsDirectory}`,
        `Journal: ${command.journalDirectory}`,
        "Only loopback connections are accepted. Press Ctrl+C to stop.",
      ].join("\n") + "\n",
    );

    let stopping = false;
    const stop = async () => {
      if (stopping) {
        return;
      }

      stopping = true;
      try {
        await running.close();
        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(
          `Error: ${error instanceof Error ? error.message : "server could not stop cleanly"}\n`,
        );
        process.exitCode = 1;
      }
    };

    process.once("SIGINT", () => void stop());
    process.once("SIGTERM", () => void stop());
  } catch (error) {
    const message =
      error instanceof LocalServerValidationError
        ? `${error.field}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "local server could not start";
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}

void main();
