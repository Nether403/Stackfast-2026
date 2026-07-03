/**
 * Sentry wiring for the API service.
 *
 * Behaviour contract (design § 3, requirements R7.1, R7.3, R7.4, R7.5, R7.6):
 *
 *   - `initSentry()` is a no-op when `SENTRY_DSN` is falsy (R7.3).
 *   - `initSentry()` is idempotent: repeated calls with the same DSN leave
 *     exactly one active client (R7.4). A repeat call with a *different*
 *     DSN logs a warning and keeps the first client.
 *   - `release` is read from `RAILWAY_GIT_COMMIT_SHA || SENTRY_RELEASE`.
 *     If both are unset in production, emit a warning but still init
 *     (R7.6).
 *   - `scrubEvent` removes `idea` and `constraints` from
 *     `event.request.data` and never mutates the input (R7.5).
 *   - `attachSentryToHono()` registers a Hono `onError` handler that pipes
 *     errors into Sentry tagged with the request id. It is a no-op whenever
 *     `isEnabled()` is false so the module has zero observable effect when
 *     the feature flag is off.
 *
 * The module is imported only from `apps/api/src/index.ts` (process startup)
 * and `apps/api/src/app.ts` (middleware wiring) in B3. B1 ships the module
 * and tests only — no wiring yet.
 */

import * as Sentry from "@sentry/node";
import type { Env, Hono, Schema } from "hono";

export interface InitSentryOptions {
  /** Override env-based DSN for tests. */
  dsn?: string;
  /** Override env-based release for tests. */
  release?: string;
  /** Override env-based environment for tests. */
  environment?: string;
  /** Inject a logger for tests. Defaults to console.warn. */
  logger?: (msg: string, ...args: unknown[]) => void;
}

type Logger = (msg: string, ...args: unknown[]) => void;

let initialized = false;
let activeDsn: string | null = null;

/** Idempotent. No-op when DSN is missing. */
export function initSentry(options: InitSentryOptions = {}): void {
  const dsn = options.dsn ?? process.env.SENTRY_DSN;
  const warn: Logger = options.logger ?? ((msg, ...rest) => console.warn(msg, ...rest));

  if (!dsn) {
    // R7.3 — silent no-op.
    return;
  }

  if (initialized) {
    // R7.4 — idempotent. A repeat call with the *same* DSN is silent;
    // a repeat call with a *different* DSN is rejected with a warning
    // and the first client stays active.
    if (activeDsn !== dsn) {
      warn("[sentry] initSentry called again with a different DSN; ignoring.");
    }
    return;
  }

  const release =
    options.release ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.SENTRY_RELEASE;

  if (!release && process.env.NODE_ENV === "production") {
    warn(
      "[sentry] No release tag set (RAILWAY_GIT_COMMIT_SHA / SENTRY_RELEASE unset); continuing without release.",
    );
  }

  Sentry.init({
    dsn,
    release: release || undefined,
    environment: options.environment ?? process.env.NODE_ENV,
    // `beforeSend` only ever receives an `ErrorEvent` (transaction events go
    // through `beforeSendTransaction`). `scrubEvent` is typed against the
    // wider `Sentry.Event` per the design contract, so we narrow the return
    // back to `ErrorEvent` — the scrub only ever spreads the input event, so
    // the runtime shape is preserved.
    beforeSend: (event) => scrubEvent(event) as Sentry.ErrorEvent,
    // MVP defaults (ADR 003 § 5): per-error at 100%, tracing disabled,
    // no PII forwarded by default. Can be tuned post-MVP.
    sampleRate: 1.0,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });

  initialized = true;
  activeDsn = dsn;
}

/**
 * Hono integration. Registers an `onError` handler that forwards errors to
 * Sentry tagged with the request id, then re-throws so downstream handlers
 * (including the existing 500 JSON formatter in `apps/api/src/app.ts`) can
 * still render a user-facing response.
 *
 * No-op whenever `isEnabled()` is false — the feature flag completely
 * disables the attachment path so tests can run without a DSN and still
 * exercise the rest of the app.
 */
export function attachSentryToHono<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = string,
>(app: Hono<E, S, BasePath>): void {
  if (!isEnabled()) {
    return;
  }

  app.onError((err, c) => {
    const requestId = (c as { get(key: string): unknown }).get("requestId") as
      | string
      | undefined;
    Sentry.captureException(err, {
      tags: requestId ? { requestId } : undefined,
    });
    throw err;
  });
}

export function isEnabled(): boolean {
  return initialized;
}

/**
 * Strips `idea` and `constraints` keys from `event.request.data` (R7.5).
 *
 * Returns a **new** event object whenever a scrub is performed — the input
 * event and its nested `request` / `data` objects are never mutated so a
 * caller holding a reference to the original payload keeps it intact. When
 * there is nothing to scrub, the original reference is returned verbatim.
 *
 * `event.request.data` may be a string, `ArrayBuffer`, `FormData`,
 * `URLSearchParams`, or an arbitrary JSON record. We only scrub the JSON
 * record case; everything else is passed through unchanged.
 */
export function scrubEvent(event: Sentry.Event): Sentry.Event {
  const request = event.request;
  if (!request || request.data == null) {
    return event;
  }

  const data: unknown = request.data;
  if (typeof data !== "object" || Array.isArray(data)) {
    return event;
  }

  const record = data as Record<string, unknown>;
  if (!("idea" in record) && !("constraints" in record)) {
    return event;
  }

  const scrubbed: Record<string, unknown> = { ...record };
  delete scrubbed.idea;
  delete scrubbed.constraints;

  return {
    ...event,
    request: { ...request, data: scrubbed },
  };
}

/**
 * Test-only: reset module state and detach any registered Sentry client
 * from the current, isolation, and global scopes so the next test starts
 * from a clean slate.
 *
 * Sentry v10 does not expose a `close()` that clears the global client —
 * clients are attached to scopes, so we detach from all three to fully
 * reset (see the v10 carrier model).
 */
export function __resetSentryForTests(): void {
  initialized = false;
  activeDsn = null;

  const scopes = [
    Sentry.getCurrentScope?.(),
    Sentry.getIsolationScope?.(),
    Sentry.getGlobalScope?.(),
  ];
  for (const scope of scopes) {
    scope?.setClient(undefined);
  }
}
