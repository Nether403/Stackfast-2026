# Rollback runbook — Phase 8 (`stackfast-api` + `stackfast-web`)

> Operator runbook for reverting a bad Railway deploy, one service at a time.
> Decision of record: [ADR 003 — Deployment architecture for MVP][adr003], § "Rollback strategy".
> Requirements covered: R2.6, R2.7, R12.1, R12.2, R12.3, R12.4, R12.5, R12.6, R12.7.

[adr003]: ../../docs/decisions/003-deployment-architecture.md

Stackfast runs as two independent Railway services in one project:
`stackfast-api` (Node 20 Hono process) and `stackfast-web` (static bundle).
They are deployed, redeployed, and rolled back **independently** — a rollback of
one service never requires touching the other (R12.6, R12.7). Pick the section
for the service you need to revert.

---

## When to use this runbook

Use it when a deploy is live but bad: the API is crashing or serving wrong
responses, the web bundle is broken, or a smoke run
(`scripts/deploy/smoke.ts`) failed after a cutover. A rollback serves the
**immediately previous successful build** instead of the current one. It does
not change code or Git history — it only changes which build Railway serves.

Before rolling back the **API**, read § "Schema compatibility gate" below. Web
rollbacks have no data-layer implications and can be run immediately.

---

## Confirm the rollback command for your CLI version

The canonical command this project documents is:

```bash
railway rollback --service <service-name>
```

Railway's CLI surface has shifted across versions, so **confirm the command
your installed CLI exposes before a real incident**:

```bash
railway --version
railway --help            # look for `rollback` / `redeploy` / `deployment`
```

Depending on the CLI version, one of the following paths is available. All three
revert the running service to a prior build; use whichever your CLI supports:

1. **Direct rollback (preferred, per ADR 003):**
   ```bash
   railway rollback --service <service-name>
   ```
2. **List + dashboard rollback** — list the recent deployments to identify the
   last `SUCCESS` build, then confirm the rollback from the Railway dashboard
   (open the service → Deployments → ⋯ on the target deployment → **Rollback**):
   ```bash
   railway deployment list --service <service-name>
   # note the most recent deployment whose status is SUCCESS, then roll back from the dashboard
   ```
3. **Redeploy a known-good build** — when the previous build is still the most
   recent successful one and no new bad code was pushed over it:
   ```bash
   railway redeploy --service <service-name>
   ```

Always pass `--environment <env>` (`production` or `staging`) explicitly if your
shell is not already linked to the target environment, so you never roll back the
wrong environment.

---

## Step 1 — Roll back the Web Service `stackfast-web` (R12.1, R12.6)

The web service is a static bundle (`apps/web/dist`). A rollback has **no
data-layer implications** and is always safe — there is no schema gate.

1. Confirm you are targeting the right environment:
   ```bash
   railway status
   ```
2. (Optional) Identify the previous successful build:
   ```bash
   railway deployment list --service stackfast-web --environment production
   ```
3. Roll the web service back to the immediately previous successful build:
   ```bash
   railway rollback --service stackfast-web --environment production
   ```
4. Verify the SPA loads:
   ```bash
   curl -I https://stackfast.app
   ```
   Expect `HTTP/2 200`. Spot-check the app in a browser.

This step does **not** touch `stackfast-api` — the API keeps serving traffic
without a restart (R12.6).

---

## Step 2 — Roll back the API Service `stackfast-api` (R12.2, R12.7)

> **Do not run this step until you have cleared the schema compatibility gate
> below.** An API rollback is only safe when the rolled-back build's schema
> expectations match the current Neon Production Branch.

1. Confirm the environment:
   ```bash
   railway status
   ```
2. Identify the immediately previous successful build:
   ```bash
   railway deployment list --service stackfast-api --environment production
   ```
3. Roll the API back to the immediately previous successful build:
   ```bash
   railway rollback --service stackfast-api --environment production
   ```
4. Verify health (R5):
   ```bash
   curl https://api.stackfast.app/health
   ```
   Expect `200` with body `OK` within ~15s of the container marking ready.
5. Run the post-deploy smoke test to confirm the rolled-back build is healthy:
   ```bash
   pnpm exec tsx scripts/deploy/smoke.ts --base https://api.stackfast.app --web https://stackfast.app
   ```

This step does **not** touch `stackfast-web` — the web service keeps serving
traffic without a restart (R12.7).

> **Migrations are not re-run on rollback.** Drizzle migrations are forward-only
> in production (ADR 003 § 2, § 7). Rolling the API back does **not** roll the
> database back. Schema compatibility is what makes a one-deploy rollback safe —
> see the gate below.

---

## Schema compatibility gate (API rollbacks only)

### Single-deploy rollback is safe by design (R12.3)

When the API is rolled back by **exactly one deploy**, the Neon Production Branch
schema remains compatible with the rolled-back build (R12.3). This holds **only
because** every schema change obeys the two-deploy rule below. A one-generation
rollback always lands on a build that was designed to read the current schema.

### The two-deploy schema rule (R2.6, R2.7)

This is a **process rule** the operator enforces by hand — Phase 8 ships no
tooling to enforce it automatically (that is a v1.x candidate).

- **Column drops and renames ship across two sequential deploys (R2.6).**
  - **Deploy 1 (expand):** add the new column. The API writes the new column
    and **keeps reading both** the old and new columns. The old column is left
    in place. After this deploy, the *previous* build is still schema-compatible,
    so a one-deploy rollback is safe.
  - **Deploy 2 (contract):** remove the old column. Only ship this once Deploy 1
    is confirmed healthy and you no longer need to roll back past it.
  - A rename is modelled as add-new + backfill + drop-old across the same two
    deploys — never as an in-place rename.

- **Additive-only migrations may ship in a single deploy (R2.7).** A migration
  that only **adds** new columns, new tables, or new indexes — and makes no
  change that breaks the current API build — does not need the two-deploy split.
  Ship it in one deploy. The previous build simply ignores the additions, so a
  one-deploy rollback stays safe.

### Decision: is this rollback safe to run automatically?

Before running an API rollback, answer: **does the rollback target's schema
expectation conflict with the current Neon Production Branch schema?**

- **No conflict** → proceed with Step 2.
- **Conflict** (the target build expects a column/table that a later migration
  has already dropped or renamed) → **STOP. Do not run the automatic rollback
  (R12.4).** Perform a manual forward-migration intervention first:
  1. Block the automatic rollback — do not run `railway rollback` yet.
  2. Write and apply a **new forward migration** that restores the schema shape
     the target build expects (e.g. re-add the dropped column and backfill it).
     Never re-run old/destructive DDL — migrations are forward-only.
     ```bash
     railway run --service stackfast-api --environment production -- pnpm exec tsx scripts/deploy/migrate.ts
     ```
  3. Confirm the Neon branch now satisfies the target build's expectations.
  4. Retry the rollback from Step 2.

### Rollbacks spanning more than one deploy (R12.5)

A rollback that spans **more than one deploy generation** MAY be executed, but
schema compatibility is **not guaranteed** and manual reconciliation may be
required. Treat any multi-generation rollback as a conflict case:

1. Inspect every migration applied between the current build and the rollback
   target.
2. If any of them dropped or renamed a column the target build reads, follow the
   manual forward-migration intervention above before rolling back.
3. Proceed at your discretion once the schema is reconciled, and re-run the smoke
   test to confirm.

---

## Post-rollback checklist

- [ ] `curl -I https://stackfast.app` returns `200` (web rolled back) and/or
      `curl https://api.stackfast.app/health` returns `200` / `OK` (API rolled back).
- [ ] `scripts/deploy/smoke.ts` passes against the rolled-back origins (API rollbacks).
- [ ] The other service is still serving traffic untouched (R12.6 / R12.7).
- [ ] The deploy log records which service was rolled back, the target build id,
      and — for API rollbacks — the schema-compatibility decision.
- [ ] If a schema conflict forced a manual forward migration, the new migration
      is committed and noted in the deploy log.

---

## Related

- [ADR 003 — Deployment architecture for MVP][adr003] § "Rollback strategy", § 2 (Database), § 7.
- `scripts/deploy/migrate.ts` — one-shot forward-only migration runner (R2.3–R2.5).
- `scripts/deploy/smoke.ts` — post-deploy verification (R5.4, R6.1–R6.3, R8.3, R10.2, R10.3).
