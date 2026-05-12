import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { MiddlewareHandler } from "hono/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getDb, isDatabaseAvailable } from "../db/client.js";

// ---------------------------------------------------------------------------
// Better Auth server instance
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;

function createAuth() {
  const db = getDb();
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
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
 * Returns 401 if the user is not authenticated.
 * Falls through only in non-production catalog-only local dev mode.
 */
export function requireSession(): MiddlewareHandler<{
  Bindings: AuthBindings;
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const auth = getAuth();

    // When auth isn't configured (no DATABASE_URL), production must fail closed
    // with 503. Non-production with ALLOW_AUTH_BYPASS != "false" skips auth
    // so catalog-only local dev and unit tests can run.
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
