import { TRAINING_FOCUSES } from "../domain/sessionPlan.js";
import type { StoredSessionPlan } from "../storage/sessionPlanRecord.js";

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function formatSessionPlan(stored: StoredSessionPlan): string {
  const { plan } = stored;
  const drillLines = plan.drills.map(
    (drill, index) =>
      `${index + 1}. ${drill.name} — ${drill.minutes} min, ${drill.focus}, ${drill.intensity}`,
  );
  const focusLines = TRAINING_FOCUSES.filter(
    (focus) => plan.focusMinutes[focus] > 0,
  ).map(
    (focus) =>
      `- ${capitalize(focus)}: ${plan.focusMinutes[focus]} min`,
  );

  return [
    plan.title,
    `Scheduled: ${plan.scheduledFor}`,
    `Saved: ${stored.savedAt}`,
    `Duration: ${plan.totalMinutes} min`,
    `Workload: ${plan.workloadPoints} points`,
    "",
    "Drills",
    ...drillLines,
    "",
    "Focus",
    ...focusLines,
  ].join("\n");
}
