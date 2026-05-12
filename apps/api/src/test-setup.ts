/**
 * Vitest setup for apps/api.
 *
 * Runs before any test file is imported (see vitest.config.ts).
 * Forces the AI explainer to the deterministic "heuristic" mode so
 * unit tests don't hit live Gemini/OpenAI APIs, and clears any
 * stray DATABASE_URL inherited from the shell so auth middleware
 * exercises the non-auth local-dev path by default.
 */

process.env.AI_PROVIDER = "heuristic";
delete process.env.GEMINI_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DATABASE_URL;
delete process.env.BETTER_AUTH_SECRET;

// Each test opts into prod/auth behavior explicitly via c.env in app.request.
// The global here just keeps the default path deterministic.
