import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "../domain/sessionPlan.js";
import { formatSessionPlan } from "./formatPlan.js";

test("formats a readable plan with drills and non-empty focus totals", () => {
  const output = formatSessionPlan({
    savedAt: "2026-08-23T16:10:00.000Z",
    plan: createSessionPlan({
      title: "Wicketkeeping movement",
      scheduledFor: "2026-08-31",
      drills: [
        {
          id: "lateral-takes",
          name: "Lateral takes",
          focus: "fielding",
          minutes: 18,
          intensity: "high",
        },
        {
          id: "mobility-reset",
          name: "Hip mobility reset",
          focus: "recovery",
          minutes: 12,
          intensity: "low",
        },
      ],
    }),
  });

  assert.equal(
    output,
    `Wicketkeeping movement
Scheduled: 2026-08-31
Saved: 2026-08-23T16:10:00.000Z
Duration: 30 min
Workload: 66 points

Drills
1. Lateral takes — 18 min, fielding, high
2. Hip mobility reset — 12 min, recovery, low

Focus
- Fielding: 18 min
- Recovery: 12 min`,
  );
  assert.doesNotMatch(output, /Batting:/);
});
