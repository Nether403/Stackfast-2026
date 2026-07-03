import { serve } from "@hono/node-server";
import app from "./app.js";
import { initSentry } from "./observability/sentry.js";

const port = Number(process.env.PORT ?? 3000);

// Initialize error tracking before the server starts handling requests.
// No-op when SENTRY_DSN is unset (R7.3); installs the @sentry/node client
// with the MVP sampling defaults and PII scrubber otherwise (R7.1).
initSentry();

serve({
	fetch: app.fetch,
	port,
});

console.log(`Stackfast API listening on http://localhost:${port}`);

export default app;
