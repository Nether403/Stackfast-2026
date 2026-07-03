/**
 * Sentry wiring for the web (browser) bundle.
 *
 * Behaviour contract (design § "apps/web/src/lib/sentry.ts", requirements
 * R7.2, R7.3, R7.4):
 *
 *   - `initSentry()` is a no-op when `import.meta.env.VITE_SENTRY_DSN` is
 *     falsy (R7.3). No client, transport, or global hook is registered.
 *   - `initSentry()` is idempotent: repeated calls with the same DSN leave
 *     exactly one active client (R7.4). A repeat call with a *different* DSN
 *     logs a warning and keeps the first client.
 *   - `release` is read from `import.meta.env.VITE_APP_RELEASE` so the
 *     browser bundle never sees server secrets (R7.2, R7.6).
 *
 * This mirrors the API-side module at `apps/api/src/observability/sentry.ts`.
 * `apps/web/src/main.tsx` calls `initSentry()` before `ReactDOM.createRoot`
 * in B5 so React error boundaries pick up the hub — B4 ships the module and
 * tests only, with no entrypoint wiring yet.
 */

import * as Sentry from "@sentry/react";

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

/** Coerce an `import.meta.env` value to a string, or `undefined`. */
function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Idempotent. No-op when `VITE_SENTRY_DSN` is missing. */
export function initSentry(options: InitSentryOptions = {}): void {
  // Static member access (not dynamic indexing) so Vite/Vitest link these to
  // the live env — `import.meta.env` is meant to be read by static key.
  const dsn = options.dsn ?? asString(import.meta.env.VITE_SENTRY_DSN);
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

  const release = options.release ?? asString(import.meta.env.VITE_APP_RELEASE);
  const environment = options.environment ?? asString(import.meta.env.MODE);

  Sentry.init({
    dsn,
    release: release || undefined,
    environment: environment || undefined,
    // MVP defaults (ADR 003 § 5): per-error at 100%, tracing disabled,
    // no PII forwarded by default. Mirrors the API side.
    sampleRate: 1.0,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });

  initialized = true;
  activeDsn = dsn;
}

export function isEnabled(): boolean {
  return initialized;
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
