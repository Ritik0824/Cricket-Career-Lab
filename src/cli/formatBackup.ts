import {
  PRIVATE_BACKUP_RECORD_KIND,
  PRIVATE_BACKUP_RECORD_VERSION,
  type PrivateBackup,
} from "../storage/privateBackupRecord.js";

export interface PrivateBackupSummaryView {
  readonly kind: typeof PRIVATE_BACKUP_RECORD_KIND;
  readonly version: typeof PRIVATE_BACKUP_RECORD_VERSION;
  readonly exportedAt: string;
  readonly goalCount: number;
  readonly journalEntryCount: number;
  readonly goalIds: readonly string[];
  readonly journalEntries: readonly {
    readonly entryId: string;
    readonly completedAt: string;
  }[];
}

export function toPrivateBackupSummaryView(
  backup: PrivateBackup,
): PrivateBackupSummaryView {
  return Object.freeze({
    kind: PRIVATE_BACKUP_RECORD_KIND,
    version: PRIVATE_BACKUP_RECORD_VERSION,
    exportedAt: backup.exportedAt,
    goalCount: backup.goals.length,
    journalEntryCount: backup.journalEntries.length,
    goalIds: Object.freeze(backup.goals.map((goal) => goal.goalId)),
    journalEntries: Object.freeze(
      backup.journalEntries.map((entry) =>
        Object.freeze({
          entryId: entry.entryId,
          completedAt: entry.completedAt,
        }),
      ),
    ),
  });
}

export function formatPrivateBackupSummary(backup: PrivateBackup): string {
  const summary = toPrivateBackupSummaryView(backup);

  return [
    "Private career backup",
    `Format: version ${summary.version}`,
    `Exported: ${summary.exportedAt}`,
    `Goals: ${summary.goalCount}`,
    ...(summary.goalIds.length === 0
      ? ["Goal identifiers: none"]
      : [`Goal identifiers: ${summary.goalIds.join(", ")}`]),
    `Journal entries: ${summary.journalEntryCount}`,
    ...(summary.journalEntries.length === 0
      ? ["Journal evidence: none"]
      : [
          "Journal evidence:",
          ...summary.journalEntries.map(
            (entry) => `- ${entry.completedAt} | ${entry.entryId}`,
          ),
        ]),
    "Private notes are stored in the backup file but omitted from this summary.",
  ].join("\n");
}
