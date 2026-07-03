import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { MiddlewareHandler } from "hono/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getDb, isDatabaseAvailable } from "../db/client.js";

// ---------------------------------------------------------------------------
// Better Auth server instance
// ---------------------------------------------------------------------------

/**
 * Cross-subdomain cookie domain used in production so the session cookie set
 * by `api.stackfast.app` is also sent to `stackfast.app` (Phase 8 R3.4 and
 * design § Data flow steps 4–6). Leading dot scopes the cookie to the apex
 * domain and all of its subdomains.
 */
const CROSS_SUBDOMAIN_COOKIE_DOMAIN = ".stackfast.app";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;

/**
 * Build the Better Auth options object (everything except the database
 * adapter, which requires a live connection).
 *
 * Factored out as a pure, side-effect-free helper so the production vs.
 * non-production cookie branches can be unit-tested without constructing a
 * real Drizzle/Neon connection (Phase 8 task C3).
 *
 * Cookie behavior (R3.3, R3.4, R3.6):
 *   - Production: cross-subdomain cookies enabled with `Domain=.stackfast.app`
 *     and default attributes `Secure`, `HttpOnly`, `SameSite=None` so the
 *     session round-trips between `stackfast.app` and `api.stackfast.app`.
 *   - Non-production: the `advanced` block is omitted entirely so cookies stay
 *     host-only and same-origin, keeping Vite's dev proxy and unit tests
 *     unaffected (no `SameSite=None`, no cross-subdomain domain).
 */
export function buildAuthOptions(env?: AuthBindings): BetterAuthOptions {
  const options: BetterAuthOptions = {
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
  };

  if (isProduction(env)) {
    options.advanced = {
      crossSubDomainCookies: {
        enabled: true,
        domain: CROSS_SUBDOMAIN_COOKIE_DOMAIN,
      },
      defaultCookieAttributes: {
        secure: true,
        httpOnly: true,
        sameSite: "none",
      },
    };
  }

  return options;
}

function createAuth() {
  const db = getDb();
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    ...buildAuthOptions(),
  });
}

/**
 * Get or create the Better Auth server instance.
 * Returns null if DATABASE_URL is not configured.
 */
export function getAuth() {
  if (!isDatabaseAvailable()) {
    return null;
  }
  if (!_auth) {
    _auth = createAuth();
  }
  return _auth as ReturnType<typeof betterAuth>;
}

// ---------------------------------------------------------------------------
// User context type
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

// ---------------------------------------------------------------------------
// Middleware: require authenticated session
// ---------------------------------------------------------------------------

type AuthBindings = {
  ADMIN_API_KEY?: string;
  NODE_ENV?: string;
};

type AuthVariables = {
  requestId: string;
  user?: SessionUser;
};

function isProduction(env?: AuthBindings): boolean {
  return (env?.NODE_ENV ?? process.env.NODE_ENV) === "production";
}

function canBypassAuthForLocalDev(env?: AuthBindings): boolean {
  return !isProduction(env) && process.env.ALLOW_AUTH_BYPASS !== "false";
}

/**
 * Middleware that requires a valid Better Auth session.
 *
 * Fail-closed ordering (see Phase 8 design § 3 and R11.2–R11.5):
 *   1. Resolve `auth` from `getAuth()`. Both a `null` return and a throw are
 *      treated identically — some Better Auth construction errors (missing
 *      secret, unreachable DB) surface as throws rather than null.
 *   2. In production, any missing `auth` short-circuits with HTTP 503
 *      regardless of `ALLOW_AUTH_BYPASS`. This is deliberately checked
 *      BEFORE the bypass branch so setting `ALLOW_AUTH_BYPASS=true` in prod
 *      by mistake cannot open a hole.
 *   3. Otherwise (non-production), `canBypassAuthForLocalDev()` may skip auth
 *      for catalog-only local dev and unit tests.
 *   4. If auth is available and bypass is not active, validate the session
 *      and return 401 for unauthenticated / invalid sessions.
 */
export function requireSession(): MiddlewareHandler<{
  Bindings: AuthBindings;
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    let auth: ReturnType<typeof betterAuth> | null;
    try {
      auth = getAuth();
    } catch {
      // Treat a throw from getAuth() the same as a null return — some
      // Better Auth construction errors (missing secret, bad DB) surface
      // as throws rather than null. Production MUST fail closed either way.
      auth = null;
    }

    // Production-first fail-closed guard (R11.2–R11.5): runs before the bypass
    // branch so `ALLOW_AUTH_BYPASS=true` set in prod by mistake cannot open
    // a hole.
    if (isProduction(c.env) && !auth) {
      return c.json(
        { error: "Authentication is not configured", requestId: c.get("requestId") },
        503 as ContentfulStatusCode,
      );
    }

    // Non-production path: when auth is missing, catalog-only local dev and
    // unit tests may proceed if bypass is allowed; otherwise still 503 so the
    // misconfiguration is visible.
    if (!auth) {
      if (canBypassAuthForLocalDev(c.env)) {
        await next();
        return;
      }
      return c.json(
        { error: "Authentication is not configured", requestId: c.get("requestId") },
        503 as ContentfulStatusCode,
      );
    }

    // When auth IS configured, non-production may still bypass for tests/dev
    // unless the operator explicitly sets ALLOW_AUTH_BYPASS=false.
    if (canBypassAuthForLocalDev(c.env)) {
      await next();
      return;
    }

    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (!session?.user) {
        return c.json(
          { error: "Authentication required", requestId: c.get("requestId") },
          401 as ContentfulStatusCode,
        );
      }

      c.set("user", {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      });
    } catch {
      return c.json(
        { error: "Invalid session", requestId: c.get("requestId") },
        401 as ContentfulStatusCode,
      );
    }

    await next();
  };
}

/**
 * Middleware that attaches user info to context if a valid session exists,
 * but does NOT block the request if the user is unauthenticated.
 */
export function optionalSession(): MiddlewareHandler<{
  Bindings: AuthBindings;
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const auth = getAuth();

    if (auth) {
      try {
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });

        if (session?.user) {
          c.set("user", {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name ?? null,
            image: session.user.image ?? null,
          });
        }
      } catch {
        // Silently continue — session is optional
      }
    }

    await next();
  };
}
