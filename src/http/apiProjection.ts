import type { DevelopmentGoalProgress } from "../domain/developmentGoal.js";
import type { TrainingJournalEntry } from "../domain/trainingJournal.js";

export interface JournalEntryApiView {
  readonly entryId: string;
  readonly planTitle: string;
  readonly scheduledFor: string;
  readonly completedAt: string;
  readonly status: TrainingJournalEntry["status"];
  readonly plannedMinutes: number;
  readonly completedMinutes: number;
  readonly varianceMinutes: number;
  readonly adherencePercentage: number;
  readonly averageEffort: number | null;
  readonly effortLoad: number;
  readonly completedFocusMinutes: TrainingJournalEntry["completedFocusMinutes"];
}

export interface DevelopmentGoalApiView {
  readonly goalId: string;
  readonly title: string;
  readonly metric: DevelopmentGoalProgress["goal"]["metric"];
  readonly target: number;
  readonly startDate: string;
  readonly dueDate: string;
  readonly focus: DevelopmentGoalProgress["goal"]["focus"];
  readonly status: DevelopmentGoalProgress["status"];
  readonly evaluatedOn: string;
  readonly currentValue: number;
  readonly remainingValue: number;
  readonly progressPercentage: number;
  readonly daysRemaining: number;
  readonly latestContributionAt: string | null;
  readonly evidence: DevelopmentGoalProgress["evidence"];
}

export function toJournalEntryApiView(
  entry: TrainingJournalEntry,
): JournalEntryApiView {
  return Object.freeze({
    entryId: entry.entryId,
    planTitle: entry.planTitle,
    scheduledFor: entry.scheduledFor,
    completedAt: entry.completedAt,
    status: entry.status,
    plannedMinutes: entry.plannedMinutes,
    completedMinutes: entry.completedMinutes,
    varianceMinutes: entry.varianceMinutes,
    adherencePercentage: entry.adherencePercentage,
    averageEffort: entry.averageEffort,
    effortLoad: entry.effortLoad,
    completedFocusMinutes: entry.completedFocusMinutes,
  });
}

export function toDevelopmentGoalApiView(
  progress: DevelopmentGoalProgress,
): DevelopmentGoalApiView {
  return Object.freeze({
    goalId: progress.goal.goalId,
    title: progress.goal.title,
    metric: progress.goal.metric,
    target: progress.goal.target,
    startDate: progress.goal.startDate,
    dueDate: progress.goal.dueDate,
    focus: progress.goal.focus,
    status: progress.status,
    evaluatedOn: progress.evaluatedOn,
    currentValue: progress.currentValue,
    remainingValue: progress.remainingValue,
    progressPercentage: progress.progressPercentage,
    daysRemaining: progress.daysRemaining,
    latestContributionAt: progress.latestContributionAt,
    evidence: progress.evidence,
  });
}
