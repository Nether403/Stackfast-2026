import { serve } from "@hono/node-server";
import app, { rateLimitBuckets } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

serve({
	fetch: app.fetch,
	port,
});

console.log(`Stackfast API listening on http://localhost:${port}`);

// --- Rate limit stale key cleanup (in-memory, single-process) ---
// TODO Phase 8: Replace with Upstash/Redis-backed rate limiting for multi-instance support
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60_000; // every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[rate-limit] Cleaned ${cleaned} stale bucket(s)`);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);

export default app;
