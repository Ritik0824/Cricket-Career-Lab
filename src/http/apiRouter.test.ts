import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDevelopmentGoal } from "../domain/developmentGoal.js";
import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import { DevelopmentGoalFileRepository } from "../storage/developmentGoalRepository.js";
import { TrainingJournalFileRepository } from "../storage/trainingJournalRepository.js";
import {
  createLocalApiRouter,
  type LocalApiResponse,
  type LocalApiRouter,
} from "./apiRouter.js";

const FIXED_NOW = new Date("2026-09-14T12:00:00.000Z");

function parseBody(response: LocalApiResponse): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

async function withRouter(
  run: (
    router: LocalApiRouter,
    directories: { goals: string; journal: string },
  ) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "career-api-router-"));
  const directories = {
    goals: join(directory, "goals"),
    journal: join(directory, "journal"),
  };

  try {
    const router = createLocalApiRouter({
      goalsDirectory: directories.goals,
      journalDirectory: directories.journal,
      now: () => FIXED_NOW,
    });
    await run(router, directories);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function seedPrivateReviewData(
  directories: { goals: string; journal: string },
): Promise<void> {
  const plan = createSessionPlan({
    title: "Local API seam session",
    scheduledFor: "2026-09-10",
    drills: [
      {
        id: "local-api-seam",
        name: "Local API seam",
        focus: "bowling",
        minutes: 20,
        intensity: "moderate",
      },
    ],
  });
  await new TrainingJournalFileRepository(directories.journal).save(
    completeTrainingSession({
      entryId: "local-api-entry",
      plan,
      completedAt: "2026-09-10T08:00:00.000Z",
      drills: [
        {
          drillId: "local-api-seam",
          completedMinutes: 18,
          perceivedEffort: 7,
          note: "Private router drill note.",
        },
      ],
      sessionNote: "Private router session note.",
    }),
  );
  await new DevelopmentGoalFileRepository(directories.goals).save(
    createDevelopmentGoal({
      goalId: "local-api-volume",
      title: "Local API bowling volume",
      metric: "focus-minutes",
      target: 60,
      startDate: "2026-09-01",
      dueDate: "2026-09-30",
      focus: "bowling",
    }),
  );
}

test("serves health metadata without touching repositories", async () => {
  await withRouter(async (router) => {
    const response = await router({ method: "GET", url: "/api/health" });
    const body = parseBody(response) as {
      data: { status: string; apiVersion: number; privacy: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.apiVersion, 1);
    assert.equal(body.data.privacy, "local-read-only");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
  });
});

test("serves filtered journal summaries without private detail", async () => {
  await withRouter(async (router, directories) => {
    await seedPrivateReviewData(directories);
    const response = await router({
      method: "GET",
      url: "/api/journal?focus=bowling&status=partial&limit=1",
    });
    const body = parseBody(response) as {
      data: Array<Record<string, unknown>>;
      meta: { count: number; privateNotes: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.meta.count, 1);
    assert.equal(body.meta.privateNotes, "omitted");
    assert.equal(body.data[0]?.entryId, "local-api-entry");
    assert.equal(body.data[0]?.completedMinutes, 18);
    assert.equal("drills" in (body.data[0] ?? {}), false);
    assert.doesNotMatch(response.body, /Private router/);
  });
});

test("serves live goal progress using explicit and injected dates", async () => {
  await withRouter(async (router, directories) => {
    await seedPrivateReviewData(directories);
    const explicit = await router({
      method: "GET",
      url: "/api/goals?asOf=2026-09-10",
    });
    const explicitBody = parseBody(explicit) as {
      data: Array<Record<string, unknown>>;
      meta: { evaluatedOn: string };
    };
    assert.equal(explicitBody.data[0]?.currentValue, 18);
    assert.equal(explicitBody.meta.evaluatedOn, "2026-09-10");
    assert.doesNotMatch(explicit.body, /Private router/);

    const current = await router({ method: "GET", url: "/api/goals" });
    const currentBody = parseBody(current) as {
      meta: { evaluatedOn: string };
    };
    assert.equal(currentBody.meta.evaluatedOn, "2026-09-14");
  });
});

test("serves weekly and monthly deterministic review projections", async () => {
  await withRouter(async (router, directories) => {
    await seedPrivateReviewData(directories);
    const week = await router({
      method: "GET",
      url: "/api/workload/week?ending=2026-09-14",
    });
    const weekBody = parseBody(week) as {
      data: { current: { completedMinutes: number } };
    };
    assert.equal(week.status, 200);
    assert.equal(weekBody.data.current.completedMinutes, 18);

    const month = await router({
      method: "GET",
      url: "/api/workload/month?month=2026-09",
    });
    const monthBody = parseBody(month) as {
      data: { current: { completedMinutes: number }; segments: unknown[] };
    };
    assert.equal(month.status, 200);
    assert.equal(monthBody.data.current.completedMinutes, 18);
    assert.equal(monthBody.data.segments.length, 5);
  });
});

test("returns stable client errors for methods, routes, and query mistakes", async () => {
  await withRouter(async (router) => {
    const method = await router({ method: "POST", url: "/api/health" });
    assert.equal(method.status, 405);
    assert.equal(method.headers.allow, "GET");

    const missing = await router({ method: "GET", url: "/api/missing" });
    assert.equal(missing.status, 404);

    const unknown = await router({
      method: "GET",
      url: "/api/journal?secret=yes",
    });
    assert.equal(unknown.status, 400);
    assert.match(unknown.body, /INVALID_QUERY/);
    assert.match(unknown.body, /secret/);

    const duplicate = await router({
      method: "GET",
      url: "/api/goals?asOf=2026-09-10&asOf=2026-09-11",
    });
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body, /may appear only once/);

    const invalidDate = await router({
      method: "GET",
      url: "/api/workload/week?ending=2026-02-30",
    });
    assert.equal(invalidDate.status, 400);
    assert.match(invalidDate.body, /weekEnding/);
  });
});

test("does not expose storage diagnostics through internal errors", async () => {
  await withRouter(async (router, directories) => {
    const corruptPath = join(directories.journal, "corrupt-entry.json");
    await mkdir(directories.journal, { recursive: true, mode: 0o700 });
    await writeFile(corruptPath, "{broken", { encoding: "utf8", mode: 0o600 });
    const response = await router({ method: "GET", url: "/api/journal" });

    assert.equal(response.status, 500);
    assert.match(response.body, /INTERNAL_ERROR/);
    assert.doesNotMatch(response.body, /corrupt-entry/);
    assert.doesNotMatch(response.body, /journal/);
  });
});
