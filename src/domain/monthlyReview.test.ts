import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMonthlyPracticeReview,
  MonthlyReviewValidationError,
} from "./monthlyReview.js";
import { createSessionPlan } from "./sessionPlan.js";
import {
  completeTrainingSession,
  type TrainingJournalEntry,
} from "./trainingJournal.js";

function entry(
  id: string,
  completedAt: string,
  completedMinutes: number,
  effort = 7,
): TrainingJournalEntry {
  const plan = createSessionPlan({
    title: `Monthly review ${id}`,
    scheduledFor: completedAt.slice(0, 10),
    drills: [
      {
        id: "skill-block",
        name: "Skill block",
        focus: "batting",
        minutes: 20,
        intensity: "moderate",
      },
    ],
  });

  return completeTrainingSession({
    entryId: id,
    plan,
    completedAt,
    drills:
      completedMinutes === 0
        ? []
        : [
            {
              drillId: "skill-block",
              completedMinutes,
              perceivedEffort: effort,
            },
          ],
  });
}

test("builds calendar-month summaries, seven-day segments, and highlights", () => {
  const review = buildMonthlyPracticeReview(
    [
      entry("august-session", "2026-08-10T08:00:00.000Z", 20, 6),
      entry("september-one", "2026-09-01T08:00:00.000Z", 10),
      entry("september-two", "2026-09-02T08:00:00.000Z", 20),
      entry("september-three", "2026-09-03T08:00:00.000Z", 30),
      entry("september-ten-a", "2026-09-10T08:00:00.000Z", 25, 8),
      entry("september-ten-b", "2026-09-10T10:00:00.000Z", 15, 6),
      entry("september-missed", "2026-09-30T08:00:00.000Z", 0),
      entry("october-session", "2026-10-01T08:00:00.000Z", 40),
    ],
    "2026-09",
  );

  assert.equal(review.month, "2026-09");
  assert.equal(review.current.startDate, "2026-09-01");
  assert.equal(review.current.endDate, "2026-09-30");
  assert.equal(review.previous.startDate, "2026-08-01");
  assert.equal(review.previous.endDate, "2026-08-31");
  assert.equal(review.current.completedMinutes, 100);
  assert.equal(review.current.performedSessionCount, 5);
  assert.equal(review.current.missedSessionCount, 1);
  assert.equal(review.current.activeDays, 4);
  assert.equal(review.previous.completedMinutes, 20);
  assert.deepEqual(review.comparison.completedMinutes, {
    current: 100,
    previous: 20,
    delta: 80,
    percentageChange: 400,
    trend: "increased",
  });
  assert.deepEqual(
    review.segments.map((segment) => ({
      window: `${segment.startDate}/${segment.endDate}`,
      minutes: segment.completedMinutes,
    })),
    [
      { window: "2026-09-01/2026-09-07", minutes: 60 },
      { window: "2026-09-08/2026-09-14", minutes: 40 },
      { window: "2026-09-15/2026-09-21", minutes: 0 },
      { window: "2026-09-22/2026-09-28", minutes: 0 },
      { window: "2026-09-29/2026-09-30", minutes: 0 },
    ],
  );
  assert.deepEqual(review.longestActiveDayStreak, {
    days: 3,
    startDate: "2026-09-01",
    endDate: "2026-09-03",
  });
  assert.deepEqual(review.busiestTrainingDay, {
    date: "2026-09-10",
    completedMinutes: 40,
    effortLoad: 290,
    entryIds: ["september-ten-b", "september-ten-a"],
  });
  assert.ok(Object.isFrozen(review));
  assert.ok(Object.isFrozen(review.segments));
  assert.ok(Object.isFrozen(review.busiestTrainingDay?.entryIds));
});

test("handles leap months and previous-year boundaries", () => {
  const february = buildMonthlyPracticeReview([], "2028-02");
  assert.equal(february.current.endDate, "2028-02-29");
  assert.equal(february.segments.at(-1)?.startDate, "2028-02-29");
  assert.equal(february.segments.at(-1)?.endDate, "2028-02-29");

  const january = buildMonthlyPracticeReview([], "2027-01");
  assert.equal(january.previous.startDate, "2026-12-01");
  assert.equal(january.previous.endDate, "2026-12-31");
  assert.deepEqual(january.longestActiveDayStreak, {
    days: 0,
    startDate: null,
    endDate: null,
  });
  assert.equal(january.busiestTrainingDay, null);
});

test("deduplicates corrected identifiers across month boundaries", () => {
  const review = buildMonthlyPracticeReview(
    [
      entry("corrected-entry", "2026-08-20T08:00:00.000Z", 20),
      entry("corrected-entry", "2026-09-04T08:00:00.000Z", 12),
    ],
    "2026-09",
  );

  assert.equal(review.current.completedMinutes, 12);
  assert.equal(review.previous.completedMinutes, 0);
  assert.deepEqual(review.current.entryIds, ["corrected-entry"]);
});

test("rejects malformed and impossible months", () => {
  assert.throws(
    () => buildMonthlyPracticeReview([], "September 2026"),
    (error: unknown) =>
      error instanceof MonthlyReviewValidationError &&
      error.field === "month" &&
      /YYYY-MM/.test(error.message),
  );
  assert.throws(
    () => buildMonthlyPracticeReview([], "2026-13"),
    (error: unknown) =>
      error instanceof MonthlyReviewValidationError &&
      /real calendar month/.test(error.message),
  );
  assert.throws(
    () => buildMonthlyPracticeReview([], "0000-01"),
    (error: unknown) => error instanceof MonthlyReviewValidationError,
  );
});
