import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();
const port = Number(process.env.PORT ?? 3000);

app.get('/health', (c) => c.text('OK'));

serve({
	fetch: app.fetch,
	port,
});

console.log(`Stackfast API listening on http://localhost:${port}`);

export default app;
