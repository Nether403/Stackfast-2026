#!/usr/bin/env tsx
/**
 * scripts/deploy/smoke.ts — post-deploy smoke test (Phase 8, task D4).
 *
 * A standalone, dependency-free smoke test the operator runs after every
 * deploy to prove the API is wired correctly end-to-end. It uses only the
 * Node 20+ global `fetch` — no Playwright, no test runner — so it runs
 * anywhere Node 20 runs, including a Railway one-shot.
 *
 * Run it as:
 *
 *   pnpm exec tsx scripts/deploy/smoke.ts --base <api-url> --web <web-url>
 *
 * Defaults: --base http://localhost:3000, --web http://localhost:5173
 * (the local `pnpm dev` topology — API on :3000, web on :5173).
 *
 * The six assertions (design § Testing strategy "Deploy smoke"):
 *   1. R5.4  — GET ${base}/health records status + body (expects 200 / "OK").
 *   2. R6.1  — 31 POST ${base}/api/v1/blueprints from a fixed IP; the 31st is 429
 *              (generation bucket = 30 / 60s).
 *   3. R6.3  — 101 GET ${base}/api/v1/tools/search from a fixed IP; the 101st is 429
 *              (read bucket = 100 / 60s).
 *   4. R8.3  — POST ${base}/admin/compatibility/recompute with a wrong key is 401.
 *   5. R10.2 — OPTIONS ${base}/api/v1/tools/search with Origin: ${web} returns an
 *              exact-match Access-Control-Allow-Origin == web origin.
 *   6. R10.3 — OPTIONS ${base}/api/v1/tools/search with Origin: https://evil.example
 *              returns an absent or non-matching ACAO (never `*`, never the evil origin).
 *
 * Behaviour:
 *   - Each assertion is captured with a name, the requirement id, a pass/fail
 *     flag, and a detail object (status codes, headers) so the JSON report is
 *     useful on its own.
 *   - The rate-limit bursts each use a distinct, fixed `x-forwarded-for` value
 *     so the generation and read buckets are isolated from each other and from
 *     repeat runs against a fresh process. Generation requests POST an empty
 *     `{}` body: the limiter runs before validation/auth in app.ts, so each
 *     request still consumes a generation token while failing fast (400) on the
 *     other side — exactly what we want to drive the bucket to its limit.
 *   - Prints a one-line JSON summary to stdout for the operator's runbook.
 *   - Writes a timestamped report to test-results/deploy-smoke-<timestamp>.json
 *     (creating the directory if missing).
 *   - Exits 0 when every assertion passes, non-zero otherwise. A run against a
 *     stopped API exits non-zero with the health assertion marked failed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── Tunables ───────────────────────────────────────────────────────────────
const GENERATION_LIMIT = 30; // requests / 60s (R6.1 / R4.2)
const READ_LIMIT = 100; // requests / 60s (R6.3 / R4.3)
const REQUEST_TIMEOUT_MS = 10_000; // per-request timeout so a hung server can't stall the run.

// Distinct fixed client IPs (TEST-NET-3, RFC 5737) so each burst lands in its
// own `{bucket}:{clientId}` key and the buckets stay isolated.
const GENERATION_CLIENT_IP = "203.0.113.31";
const READ_CLIENT_IP = "203.0.113.101";

const WRONG_ADMIN_KEY = "smoke-test-wrong-admin-key";
const EVIL_ORIGIN = "https://evil.example";

interface CliArgs {
  base: string;
  web: string;
}

interface AssertionResult {
  name: string;
  requirement: string;
  pass: boolean;
  detail: Record<string, unknown>;
}

function log(message: string): void {
  console.log(`[smoke] ${message}`);
}

function errorLog(message: string): void {
  console.error(`[smoke] ${message}`);
}

function parseArgs(argv: string[]): CliArgs {
  let base = "http://localhost:3000";
  let web = "http://localhost:5173";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") {
      base = argv[++i] ?? base;
    } else if (arg.startsWith("--base=")) {
      base = arg.slice("--base=".length);
    } else if (arg === "--web") {
      web = argv[++i] ?? web;
    } else if (arg.startsWith("--web=")) {
      web = arg.slice("--web=".length);
    }
  }
  // Strip any trailing slash so `${base}/health` never double-slashes.
  return { base: base.replace(/\/+$/, ""), web: web.replace(/\/+$/, "") };
}

/** A `fetch` with a per-request timeout. Rejects on network error or timeout. */
async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Assertion 1 (R5.4): GET /health. Records the status and body. Passes on a
 * 200 with body "OK". A connection failure (API stopped) is caught and the
 * assertion is marked failed — this is the failure-path signal the runbook
 * relies on.
 */
async function checkHealth(base: string): Promise<AssertionResult> {
  const url = `${base}/health`;
  try {
    const res = await timedFetch(url, { method: "GET" });
    const body = (await res.text()).trim();
    const pass = res.status === 200 && body === "OK";
    return {
      name: "health",
      requirement: "R5.4",
      pass,
      detail: { url, status: res.status, body },
    };
  } catch (err) {
    return {
      name: "health",
      requirement: "R5.4",
      pass: false,
      detail: { url, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/** Issue `count` sequential requests, returning the status of each (or 0 on error). */
async function burst(
  count: number,
  makeRequest: (index: number) => Promise<Response>,
): Promise<{ statuses: number[]; error?: string }> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += 1) {
    try {
      const res = await makeRequest(i);
      statuses.push(res.status);
    } catch (err) {
      return { statuses, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { statuses };
}

/**
 * Assertion 2 (R6.1): 31 generation requests from a fixed IP; the 31st must be
 * 429. The limiter runs before validation/auth, so the empty `{}` body is fine.
 */
async function checkGenerationBurst(base: string): Promise<AssertionResult> {
  const url = `${base}/api/v1/blueprints`;
  const total = GENERATION_LIMIT + 1; // 31
  const { statuses, error } = await burst(total, () =>
    timedFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": GENERATION_CLIENT_IP,
      },
      body: "{}",
    }),
  );
  const lastStatus = statuses[statuses.length - 1];
  const pass = statuses.length === total && lastStatus === 429;
  return {
    name: "generation-rate-limit",
    requirement: "R6.1/R6.2",
    pass,
    detail: {
      url,
      clientIp: GENERATION_CLIENT_IP,
      requestsSent: statuses.length,
      expectedLimit: GENERATION_LIMIT,
      finalStatus: lastStatus,
      count429: statuses.filter((s) => s === 429).length,
      ...(error ? { error } : {}),
    },
  };
}

/**
 * Assertion 3 (R6.3): 101 read requests from a fixed IP; the 101st must be 429.
 */
async function checkReadBurst(base: string): Promise<AssertionResult> {
  const url = `${base}/api/v1/tools/search`;
  const total = READ_LIMIT + 1; // 101
  const { statuses, error } = await burst(total, () =>
    timedFetch(url, {
      method: "GET",
      headers: { "x-forwarded-for": READ_CLIENT_IP },
    }),
  );
  const lastStatus = statuses[statuses.length - 1];
  const pass = statuses.length === total && lastStatus === 429;
  return {
    name: "read-rate-limit",
    requirement: "R6.3",
    pass,
    detail: {
      url,
      clientIp: READ_CLIENT_IP,
      requestsSent: statuses.length,
      expectedLimit: READ_LIMIT,
      finalStatus: lastStatus,
      count429: statuses.filter((s) => s === 429).length,
      ...(error ? { error } : {}),
    },
  };
}

/**
 * Assertion 4 (R8.3): admin route with a wrong key must be 401.
 */
async function checkAdmin401(base: string): Promise<AssertionResult> {
  const url = `${base}/admin/compatibility/recompute`;
  try {
    const res = await timedFetch(url, {
      method: "POST",
      headers: { "X-Admin-API-Key": WRONG_ADMIN_KEY },
    });
    return {
      name: "admin-401",
      requirement: "R8.3",
      pass: res.status === 401,
      detail: { url, status: res.status, sentKey: "wrong" },
    };
  } catch (err) {
    return {
      name: "admin-401",
      requirement: "R8.3",
      pass: false,
      detail: { url, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/**
 * Assertion 5 (R10.2): a same-origin preflight returns an exact-match ACAO.
 */
async function checkCorsSameOrigin(base: string, web: string): Promise<AssertionResult> {
  const url = `${base}/api/v1/tools/search`;
  try {
    const res = await timedFetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: web,
        "Access-Control-Request-Method": "GET",
      },
    });
    const acao = res.headers.get("access-control-allow-origin");
    const acac = res.headers.get("access-control-allow-credentials");
    return {
      name: "cors-same-origin-acao",
      requirement: "R10.2",
      pass: acao === web,
      detail: {
        url,
        requestOrigin: web,
        accessControlAllowOrigin: acao,
        accessControlAllowCredentials: acac,
        status: res.status,
      },
    };
  } catch (err) {
    return {
      name: "cors-same-origin-acao",
      requirement: "R10.2",
      pass: false,
      detail: { url, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/**
 * Assertion 6 (R10.3): an evil-origin preflight must never echo `*` and never
 * echo the evil origin. An absent or non-matching ACAO passes.
 */
async function checkCorsEvilOrigin(base: string): Promise<AssertionResult> {
  const url = `${base}/api/v1/tools/search`;
  try {
    const res = await timedFetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: EVIL_ORIGIN,
        "Access-Control-Request-Method": "GET",
      },
    });
    const acao = res.headers.get("access-control-allow-origin");
    const pass = acao === null || (acao !== "*" && acao !== EVIL_ORIGIN);
    return {
      name: "cors-evil-origin-acao",
      requirement: "R10.3",
      pass,
      detail: {
        url,
        requestOrigin: EVIL_ORIGIN,
        accessControlAllowOrigin: acao,
        status: res.status,
      },
    };
  } catch (err) {
    return {
      name: "cors-evil-origin-acao",
      requirement: "R10.3",
      pass: false,
      detail: { url, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

function writeReport(report: Record<string, unknown>, timestamp: string): string {
  const dir = path.join(REPO_ROOT, "test-results");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `deploy-smoke-${timestamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return file;
}

async function main(): Promise<number> {
  const { base, web } = parseArgs(process.argv.slice(2));
  const startedAt = new Date();
  const timestamp = startedAt.toISOString().replace(/[:.]/g, "-");

  log(`base=${base} web=${web}`);

  // Health runs first. If the API is down, the remaining assertions will also
  // fail (their fetches reject), but each one captures its own error so the
  // report stays useful.
  const health = await checkHealth(base);
  log(`health: ${health.pass ? "PASS" : "FAIL"} (status=${String(health.detail.status ?? "n/a")})`);

  const assertions: AssertionResult[] = [health];

  // The rate-limit bursts mutate server-side bucket state, so run them in
  // sequence. The remaining stateless checks run after.
  assertions.push(await checkGenerationBurst(base));
  assertions.push(await checkReadBurst(base));
  assertions.push(await checkAdmin401(base));
  assertions.push(await checkCorsSameOrigin(base, web));
  assertions.push(await checkCorsEvilOrigin(base));

  for (const a of assertions.slice(1)) {
    log(`${a.name} (${a.requirement}): ${a.pass ? "PASS" : "FAIL"}`);
  }

  const passed = assertions.filter((a) => a.pass).length;
  const total = assertions.length;
  const ok = passed === total;
  const finishedAt = new Date();

  const report = {
    ok,
    passed,
    total,
    base,
    web,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    assertions,
  };

  let reportPath: string | undefined;
  try {
    reportPath = writeReport(report, timestamp);
    log(`report written to ${reportPath}`);
  } catch (err) {
    errorLog(`failed to write report: ${err instanceof Error ? err.message : String(err)}`);
  }

  // One-line JSON summary for the runbook.
  const summary = {
    ok,
    passed,
    total,
    base,
    web,
    failed: assertions.filter((a) => !a.pass).map((a) => `${a.name}(${a.requirement})`),
    reportPath,
  };
  console.log(JSON.stringify(summary));

  return ok ? 0 : 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    errorLog(`unexpected error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    process.exit(1);
  });
