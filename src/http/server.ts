import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { createLocalApiRouter, type LocalApiRouter } from "./apiRouter.js";

export interface LocalServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly goalsDirectory: string;
  readonly journalDirectory: string;
  readonly now: () => Date;
}

export interface RunningLocalServer {
  readonly host: string;
  readonly port: number;
  readonly origin: string;
  readonly server: Server;
  readonly close: () => Promise<void>;
}

export class LocalServerValidationError extends Error {
  readonly field: "host" | "port";

  constructor(field: "host" | "port", message: string) {
    super(message);
    this.name = "LocalServerValidationError";
    this.field = field;
  }
}

const LOOPBACK_HOSTS = ["127.0.0.1", "::1", "localhost"] as const;

function normalizeHost(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "127.0.0.1";

  if (!(LOOPBACK_HOSTS as readonly string[]).includes(normalized)) {
    throw new LocalServerValidationError(
      "host",
      `host must be one of ${LOOPBACK_HOSTS.join(", ")}`,
    );
  }

  return normalized;
}

function normalizePort(value: number | undefined): number {
  const port = value ?? 4317;

  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new LocalServerValidationError(
      "port",
      "port must be an integer from 0 to 65535",
    );
  }

  return port;
}

function writeResponse(
  response: ServerResponse,
  status: number,
  headers: Readonly<Record<string, string>>,
  body: string,
): void {
  response.writeHead(status, {
    ...headers,
    "content-length": String(Buffer.byteLength(body)),
  });
  response.end(body);
}

function requestHandler(router: LocalApiRouter) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      const result = await router({
        method: request.method ?? "GET",
        url: request.url ?? "/",
      });
      writeResponse(response, result.status, result.headers, result.body);
    } catch {
      const body = JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "local API request could not be completed",
        },
      });
      writeResponse(
        response,
        500,
        {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
        body,
      );
    }
  };
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function originFor(host: string, port: number): string {
  return `http://${host.includes(":") ? `[${host}]` : host}:${port}`;
}

export async function startLocalServer(
  options: LocalServerOptions,
): Promise<RunningLocalServer> {
  const host = normalizeHost(options.host);
  const port = normalizePort(options.port);
  const router = createLocalApiRouter(options);
  const server = createServer(requestHandler(router));

  await listen(server, port, host);
  const address = server.address();

  if (address === null || typeof address === "string") {
    await closeServer(server);
    throw new Error("local API did not receive a TCP address");
  }

  const boundPort = (address as AddressInfo).port;

  return Object.freeze({
    host,
    port: boundPort,
    origin: originFor(host, boundPort),
    server,
    close: () => closeServer(server),
  });
}
