import type { ApiErrorBody } from "./types";

export const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ?? "http://localhost:8080";
export const AI_SERVICE_URL =
  (import.meta as any).env?.VITE_AI_SERVICE_URL ?? "http://localhost:8000";

/**
 * A failure the user can be shown. `friendly` is written for a citizen, not an
 * operator: it never leaks a policy id or a stack trace into the sentence,
 * though it keeps both on the object so they can go in a bug report.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  readonly policyId?: string;
  readonly friendly: string;

  constructor(status: number, body: Partial<ApiErrorBody>, friendly: string) {
    super(body.message ?? `HTTP ${status}`);
    this.status = status;
    this.code = body.code ?? "UNKNOWN";
    this.correlationId = body.correlationId;
    this.policyId = body.policyId;
    this.friendly = friendly;
  }
}

/** Raised when a service could not be reached at all, as opposed to refusing. */
export class ServiceUnreachable extends Error {
  readonly service: string;
  constructor(service: string, cause?: unknown) {
    super(`${service} is unreachable`);
    this.service = service;
    this.cause = cause;
  }
}

function newCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * A 403 is the one status a citizen is most likely to meet, and the backend's
 * message is written for a developer. These are written for the person.
 */
function friendlyMessage(status: number, body: Partial<ApiErrorBody>): string {
  switch (status) {
    case 401:
      return "Your session has ended. Please sign in again.";
    case 403:
      switch (body.code) {
        case "CONSENT_REQUIRED":
        case "CONSENT_EXPIRED":
          return "This family has not given you permission to see their details, or the permission has expired. Ask them to share it again.";
        case "OUT_OF_DISTRICT":
          return "This household is in another district, so you cannot open it.";
        case "SELF_APPROVAL_FORBIDDEN":
          return "You drafted or edited this version, so someone else has to publish it.";
        default:
          return "You do not have permission to see this.";
      }
    case 404:
      return "That was not found. It may not be published yet.";
    case 409:
      return "Someone changed this at the same time. Reload and try again.";
    case 429:
      return "Too many requests just now. Please wait a moment.";
    default:
      if (status >= 500) return "Something went wrong at our end. Please try again shortly.";
      return body.message ?? "That did not work.";
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token: string;
  correlationId?: string;
  baseUrl?: string;
  serviceName?: string;
  signal?: AbortSignal;
}

export async function request<T>(path: string, opts: RequestOptions): Promise<T> {
  const base = opts.baseUrl ?? BACKEND_URL;
  const service = opts.serviceName ?? "backend";
  const correlationId = opts.correlationId ?? newCorrelationId();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    "X-Correlation-Id": correlationId,
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (cause) {
    // A network-level failure, not a refusal. The chat page turns this into the
    // manual fallback rather than an error message.
    throw new ServiceUnreachable(service, cause);
  }

  if (response.status >= 500 && service === "ai-service") {
    throw new ServiceUnreachable(service);
  }

  if (!response.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = await response.json();
    } catch {
      /* a non-JSON error body is still an error */
    }
    throw new ApiError(response.status, body, friendlyMessage(response.status, body));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
