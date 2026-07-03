#!/usr/bin/env tsx
/**
 * scripts/deploy/migrate.ts — one-shot Drizzle migration runner (Phase 8).
 *
 * Wraps `drizzle-kit push` so Drizzle migrations run as a one-shot deploy step,
 * separate from the API start script (R2.4). It is invoked in production as:
 *
 *   railway run --service stackfast-api -- pnpm exec tsx scripts/deploy/migrate.ts
 *
 * Behaviour:
 *   1. Validates DATABASE_URL is set; exits non-zero with a clear message if not.
 *   2. Waits for the database to accept connections, retrying transient
 *      connection failures for up to ~30 seconds before erroring (R2.3). The
 *      probe is a dependency-free TCP connect to the Postgres host:port so the
 *      script resolves cleanly whether it is launched from the repo root or the
 *      API service image.
 *   3. Runs `drizzle-kit push` against the schema (config: apps/api/drizzle.config.ts).
 *      - Default (apply) mode applies pending DDL. Migrations are forward-only in
 *        production (R2.5): destructive column drops/renames are NOT auto-applied
 *        here — those ship across two sequential deploys (R2.6) and are driven
 *        manually by the operator.
 *      - `--dry-run` prints the pending DDL (or "no changes") WITHOUT applying it.
 *        drizzle-kit `push` has no native `--dry-run` flag, so dry-run runs
 *        `push --strict`: strict mode pauses for explicit approval before
 *        executing any statement, and this runner never approves — it captures
 *        the printed DDL and aborts the child at the approval prompt, guaranteeing
 *        nothing is written to the database.
 *
 * Exit codes: 0 on success / "no changes"; non-zero on any failure (missing
 * DATABASE_URL, connection deadline exceeded, or drizzle-kit error).
 */
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ── Tunables ───────────────────────────────────────────────────────────────
const RETRY_DEADLINE_MS = 30_000; // R2.3: retry transient failures for up to 30s.
const PROBE_TIMEOUT_MS = 5_000; // per-attempt TCP connect timeout.
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5_000;
const DEFAULT_PG_PORT = 5432;
const DRY_RUN_IDLE_MS = 3_000; // once drizzle-kit goes quiet at the approval prompt, abort.
const DRY_RUN_HARD_MS = 60_000; // absolute cap for a dry-run.
const APPLY_HARD_MS = 5 * 60_000; // absolute cap for an apply so a stuck prompt cannot hang forever.

const IS_WINDOWS = process.platform === "win32";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function log(message: string): void {
  console.log(`[migrate] ${message}`);
}

function errorLog(message: string): void {
  console.error(`[migrate] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CliArgs {
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  return { dryRun: argv.includes("--dry-run") };
}

interface ConnectionTarget {
  host: string;
  port: number;
}

/**
 * Parse the host and port out of a Postgres connection string. Node's WHATWG
 * URL parser handles the `postgresql://` / `postgres://` schemes fine.
 */
function resolveTarget(databaseUrl: string): ConnectionTarget {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection URL");
  }
  const host = parsed.hostname;
  if (!host) {
    throw new Error("DATABASE_URL has no host component");
  }
  const port = parsed.port ? Number(parsed.port) : DEFAULT_PG_PORT;
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`DATABASE_URL has an invalid port: ${parsed.port}`);
  }
  return { host, port };
}

/**
 * Attempt a single TCP connection to the database host. Resolves on connect,
 * rejects on any error or timeout.
 */
function probeOnce(target: ConnectionTarget, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: target.host, port: target.port });
    let settled = false;
    const finish = (err?: Error): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish());
    socket.once("timeout", () => finish(new Error(`connection timed out after ${timeoutMs}ms`)));
    socket.once("error", (err: Error) => finish(err));
  });
}

/**
 * Retry the TCP probe with exponential backoff until the database is reachable
 * or the 30s deadline is exceeded (R2.3). Any connection failure (DNS, refused,
 * reset, timeout, unreachable host) is treated as transient and retried until
 * the deadline.
 */
async function waitForConnection(target: ConnectionTarget): Promise<void> {
  const deadline = Date.now() + RETRY_DEADLINE_MS;
  let backoff = INITIAL_BACKOFF_MS;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      await probeOnce(target, PROBE_TIMEOUT_MS);
      log(`database reachable at ${target.host}:${target.port} (attempt ${attempt})`);
      return;
    } catch (err) {
      const remaining = deadline - Date.now();
      const reason = err instanceof Error ? ((err as NodeJS.ErrnoException).code ?? err.message) : String(err);
      if (remaining <= 0) {
        throw new Error(
          `could not connect to ${target.host}:${target.port} within ${RETRY_DEADLINE_MS / 1000}s ` +
            `(${attempt} attempts; last error: ${reason})`,
        );
      }
      const wait = Math.min(backoff, remaining);
      log(
        `attempt ${attempt} failed (${reason}); retrying in ${wait}ms ` +
          `(~${Math.ceil(remaining / 1000)}s left before giving up)`,
      );
      await sleep(wait);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  }
}

/**
 * Base argument list for invoking drizzle-kit scoped to the API package, so its
 * binary and `drizzle.config.ts` resolve regardless of the cwd this script was
 * launched from. `pnpm --filter <pkg> exec` runs with cwd set to the package dir.
 */
function drizzleKitArgs(extra: string[]): string[] {
  return [
    "--filter",
    "@stackfast/api",
    "exec",
    "drizzle-kit",
    "push",
    "--config",
    "drizzle.config.ts",
    "--verbose",
    ...extra,
  ];
}

function spawnPnpm(args: string[], stdio: "inherit" | "pipe"): ChildProcess {
  return spawn("pnpm", args, {
    cwd: REPO_ROOT,
    env: process.env,
    shell: IS_WINDOWS, // pnpm is a .cmd shim on Windows.
    stdio: stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
  });
}

/** Best-effort kill of the child process tree (drizzle-kit spawns sub-processes). */
function killTree(child: ChildProcess): void {
  if (child.pid == null) {
    child.kill("SIGKILL");
    return;
  }
  if (IS_WINDOWS) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGKILL");
  }
}

/**
 * Apply pending migrations. Additive (forward-only) changes apply without a
 * prompt. The hard timeout is a safety net so the one-shot can never hang.
 */
function runApply(): Promise<number> {
  log("applying pending migrations via `drizzle-kit push`...");
  return new Promise((resolve) => {
    const child = spawnPnpm(drizzleKitArgs([]), "inherit");
    const hardTimer = setTimeout(() => {
      errorLog(`drizzle-kit push exceeded ${APPLY_HARD_MS / 1000}s; aborting`);
      killTree(child);
    }, APPLY_HARD_MS);
    child.on("error", (err) => {
      clearTimeout(hardTimer);
      errorLog(`failed to launch drizzle-kit: ${err.message}`);
      resolve(1);
    });
    child.on("close", (code, signal) => {
      clearTimeout(hardTimer);
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

/**
 * Dry-run: print pending DDL without applying it. Runs `push --strict` and
 * aborts at the approval prompt so nothing is ever written.
 */
function runDryRun(): Promise<number> {
  log("dry-run: computing pending DDL (nothing will be applied)...");
  return new Promise((resolve) => {
    const child = spawnPnpm(drizzleKitArgs(["--strict"]), "pipe");
    let buffered = "";
    let abortedAtPrompt = false;
    let idleTimer: NodeJS.Timeout | undefined;

    const armIdle = (): void => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // drizzle-kit has printed the diff and is now blocked waiting for
        // approval. We never approve — abort so nothing is applied.
        abortedAtPrompt = true;
        log("dry-run: reached approval prompt; aborting without applying");
        killTree(child);
      }, DRY_RUN_IDLE_MS);
    };

    const hardTimer = setTimeout(() => {
      abortedAtPrompt = true;
      killTree(child);
    }, DRY_RUN_HARD_MS);

    const onData = (chunk: Buffer): void => {
      const text = chunk.toString();
      buffered += text;
      process.stdout.write(text);
      armIdle();
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    child.on("error", (err) => {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(hardTimer);
      errorLog(`failed to launch drizzle-kit: ${err.message}`);
      resolve(1);
    });

    child.on("close", (code, signal) => {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(hardTimer);

      if (abortedAtPrompt) {
        // We intentionally killed it at the prompt: the pending DDL was printed
        // above. This is a successful dry-run.
        log("dry-run complete: pending DDL shown above; no changes applied.");
        resolve(0);
        return;
      }

      // drizzle-kit exited on its own before any prompt.
      if (code === 0) {
        if (/no changes/i.test(buffered)) {
          log("dry-run complete: no changes.");
        } else {
          log("dry-run complete: no changes applied.");
        }
        resolve(0);
        return;
      }

      errorLog(`drizzle-kit exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`);
      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<number> {
  const { dryRun } = parseArgs(process.argv.slice(2));

  // R2.4 / clear failure: DATABASE_URL must be set.
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    errorLog(
      "DATABASE_URL is not set. Set it to the Neon pooled connection string " +
        "for the target environment before running migrations.",
    );
    return 1;
  }

  let target: ConnectionTarget;
  try {
    target = resolveTarget(databaseUrl);
  } catch (err) {
    errorLog(err instanceof Error ? err.message : String(err));
    return 1;
  }

  log(`mode: ${dryRun ? "dry-run" : "apply"}`);
  log(`waiting for database at ${target.host}:${target.port} (up to ${RETRY_DEADLINE_MS / 1000}s)...`);

  try {
    await waitForConnection(target);
  } catch (err) {
    errorLog(err instanceof Error ? err.message : String(err));
    return 1;
  }

  return dryRun ? runDryRun() : runApply();
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    errorLog(`unexpected error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    process.exit(1);
  });
