import type { TrainingJournalEntry } from "../domain/trainingJournal.js";

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function formatJournalEntry(entry: TrainingJournalEntry): string {
  const drillLines = entry.drills.flatMap((drill, index) => {
    const effort =
      drill.perceivedEffort === null ? "no effort" : `effort ${drill.perceivedEffort}/10`;
    const summary = `${index + 1}. ${drill.name} — ${drill.completedMinutes}/${drill.plannedMinutes} min, ${drill.status}, ${effort}`;

    return drill.note === null ? [summary] : [summary, `   Note: ${drill.note}`];
  });

  return [
    entry.planTitle,
    `Entry: ${entry.entryId}`,
    `Status: ${capitalize(entry.status)}`,
    `Scheduled: ${entry.scheduledFor}`,
    `Completed: ${entry.completedAt}`,
    `Time: ${entry.completedMinutes}/${entry.plannedMinutes} min (${entry.adherencePercentage}%)`,
    `Variance: ${entry.varianceMinutes >= 0 ? "+" : ""}${entry.varianceMinutes} min`,
    `Average effort: ${entry.averageEffort === null ? "n/a" : `${entry.averageEffort}/10`}`,
    `Effort load: ${entry.effortLoad}`,
    "",
    "Drills",
    ...drillLines,
    ...(entry.sessionNote === null
      ? []
      : ["", "Session note", entry.sessionNote]),
  ].join("\n");
}

export function formatJournalList(
  entries: readonly TrainingJournalEntry[],
): string {
  if (entries.length === 0) {
    return "Training journal is empty.";
  }

  return [
    `Training journal — ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`,
    ...entries.map(
      (entry) =>
        `${entry.completedAt} | ${entry.entryId} | ${entry.status} | ${entry.completedMinutes}/${entry.plannedMinutes} min | ${entry.planTitle}`,
    ),
  ].join("\n");
}
