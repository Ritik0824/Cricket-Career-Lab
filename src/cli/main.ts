#!/usr/bin/env node

import { runCli } from "./runCli.js";

const exitCode = await runCli(process.argv.slice(2), {
  now: () => new Date(),
  writeOutput: (text) => process.stdout.write(text),
  writeError: (text) => process.stderr.write(text),
});

process.exitCode = exitCode;
