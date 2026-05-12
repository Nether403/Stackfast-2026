import { serve } from "@hono/node-server";
import app from "./app.js";

const port = Number(process.env.PORT ?? 3000);

serve({
	fetch: app.fetch,
	port,
});

console.log(`Stackfast API listening on http://localhost:${port}`);

export default app;
