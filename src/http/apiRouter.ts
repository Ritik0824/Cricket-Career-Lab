import {
  evaluateDevelopmentGoals,
  DevelopmentGoalValidationError,
} from "../domain/developmentGoal.js";
import {
  buildMonthlyPracticeReview,
  MonthlyReviewValidationError,
} from "../domain/monthlyReview.js";
import {
  filterTrainingJournal,
  TrainingJournalQueryError,
  type TrainingJournalQueryInput,
} from "../domain/trainingJournalQuery.js";
import {
  buildWeeklyWorkloadReview,
  WeeklyWorkloadValidationError,
} from "../domain/weeklyWorkload.js";
import { DevelopmentGoalFileRepository } from "../storage/developmentGoalRepository.js";
import { TrainingJournalFileRepository } from "../storage/trainingJournalRepository.js";
import {
  toDevelopmentGoalApiView,
  toJournalEntryApiView,
} from "./apiProjection.js";

export interface LocalApiRequest {
  readonly method: string;
  readonly url: string;
}

export interface LocalApiResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface LocalApiRouterOptions {
  readonly goalsDirectory: string;
  readonly journalDirectory: string;
  readonly now: () => Date;
}

export type LocalApiRouter = (
  request: LocalApiRequest,
) => Promise<LocalApiResponse>;

class ApiQueryError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "ApiQueryError";
    this.field = field;
  }
}

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
});

function jsonResponse(status: number, value: unknown): LocalApiResponse {
  return Object.freeze({
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(value, null, 2),
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  field?: string,
): LocalApiResponse {
  return jsonResponse(status, {
    error: {
      code,
      message,
      ...(field === undefined ? {} : { field }),
    },
  });
}

function validateParameters(
  parameters: URLSearchParams,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  const seen = new Set<string>();

  for (const key of parameters.keys()) {
    if (!allowedSet.has(key)) {
      throw new ApiQueryError(key, `query parameter ${key} is not supported`);
    }

    if (seen.has(key)) {
      throw new ApiQueryError(key, `query parameter ${key} may appear only once`);
    }

    seen.add(key);
  }
}

function optionalParameter(
  parameters: URLSearchParams,
  key: string,
): string | undefined {
  const value = parameters.get(key);
  return value === null ? undefined : value;
}

function journalQuery(
  parameters: URLSearchParams,
): TrainingJournalQueryInput {
  validateParameters(parameters, [
    "from",
    "to",
    "focus",
    "intensity",
    "status",
    "text",
    "limit",
  ]);
  const from = optionalParameter(parameters, "from");
  const to = optionalParameter(parameters, "to");
  const focus = optionalParameter(parameters, "focus");
  const intensity = optionalParameter(parameters, "intensity");
  const status = optionalParameter(parameters, "status");
  const text = optionalParameter(parameters, "text");
  const limitText = optionalParameter(parameters, "limit");

  return {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(focus === undefined ? {} : { focus }),
    ...(intensity === undefined ? {} : { intensity }),
    ...(status === undefined ? {} : { status }),
    ...(text === undefined ? {} : { text }),
    ...(limitText === undefined ? {} : { limit: Number(limitText) }),
  };
}

function today(now: () => Date): string {
  return now().toISOString().slice(0, 10);
}

function currentMonth(now: () => Date): string {
  return now().toISOString().slice(0, 7);
}

function isValidationError(error: unknown): error is {
  readonly field: string;
  readonly message: string;
} {
  return (
    error instanceof ApiQueryError ||
    error instanceof TrainingJournalQueryError ||
    error instanceof DevelopmentGoalValidationError ||
    error instanceof WeeklyWorkloadValidationError ||
    error instanceof MonthlyReviewValidationError
  );
}

export function createLocalApiRouter(
  options: LocalApiRouterOptions,
): LocalApiRouter {
  const goalRepository = new DevelopmentGoalFileRepository(
    options.goalsDirectory,
  );
  const journalRepository = new TrainingJournalFileRepository(
    options.journalDirectory,
  );

  return async (request): Promise<LocalApiResponse> => {
    if (request.method.toUpperCase() !== "GET") {
      return Object.freeze({
        ...errorResponse(
          405,
          "METHOD_NOT_ALLOWED",
          "this local API supports GET requests only",
        ),
        headers: Object.freeze({ ...JSON_HEADERS, allow: "GET" }),
      });
    }

    let url: URL;

    try {
      url = new URL(request.url, "http://127.0.0.1");
    } catch {
      return errorResponse(400, "INVALID_URL", "request URL is invalid");
    }

    try {
      if (url.pathname === "/api/health") {
        validateParameters(url.searchParams, []);
        return jsonResponse(200, {
          data: {
            status: "ok",
            apiVersion: 1,
            privacy: "local-read-only",
          },
        });
      }

      if (url.pathname === "/api/journal") {
        const entries = filterTrainingJournal(
          await journalRepository.list(),
          journalQuery(url.searchParams),
        );

        return jsonResponse(200, {
          data: entries.map(toJournalEntryApiView),
          meta: { count: entries.length, privateNotes: "omitted" },
        });
      }

      if (url.pathname === "/api/goals") {
        validateParameters(url.searchParams, ["asOf"]);
        const asOf = optionalParameter(url.searchParams, "asOf") ?? today(options.now);
        const [goals, entries] = await Promise.all([
          goalRepository.list(),
          journalRepository.list(),
        ]);
        const progress = evaluateDevelopmentGoals(goals, entries, asOf);

        return jsonResponse(200, {
          data: progress.map(toDevelopmentGoalApiView),
          meta: {
            count: progress.length,
            evaluatedOn: asOf,
            privateNotes: "omitted",
          },
        });
      }

      if (url.pathname === "/api/workload/week") {
        validateParameters(url.searchParams, ["ending"]);
        const ending = optionalParameter(url.searchParams, "ending") ?? today(options.now);
        const review = buildWeeklyWorkloadReview(
          await journalRepository.list(),
          ending,
        );

        return jsonResponse(200, { data: review });
      }

      if (url.pathname === "/api/workload/month") {
        validateParameters(url.searchParams, ["month"]);
        const month =
          optionalParameter(url.searchParams, "month") ?? currentMonth(options.now);
        const review = buildMonthlyPracticeReview(
          await journalRepository.list(),
          month,
        );

        return jsonResponse(200, { data: review });
      }

      return errorResponse(404, "NOT_FOUND", "API route was not found");
    } catch (error) {
      if (isValidationError(error)) {
        return errorResponse(
          400,
          "INVALID_QUERY",
          error.message,
          error.field,
        );
      }

      return errorResponse(
        500,
        "INTERNAL_ERROR",
        "local review data could not be loaded",
      );
    }
  };
}
