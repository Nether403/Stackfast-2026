import type { Diagnostic, Tool } from "@stackfast/schemas";

// ---------------------------------------------------------------------------
// System prompt — describes Stackfast's domain so the LLM has context
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are Stackfast, an expert developer-tool recommendation engine.
Your job is to explain WHY a particular set of developer tools (a "stack") is
recommended for a given project idea. You understand:

- Frontend frameworks (Next.js, Remix, Astro, SvelteKit)
- Runtimes (Node.js, Bun)
- Databases (Postgres, MySQL, SQLite, MongoDB)
- ORMs (Prisma, Drizzle)
- Auth providers (Clerk, Auth.js, Supabase Auth)
- Hosting platforms (Vercel, Railway, Netlify)
- Payment processors (Stripe, Lemon Squeezy)
- Email services (Resend, SendGrid)
- Storage solutions (S3, Cloudflare R2)
- CSS frameworks (Tailwind CSS, Vanilla Extract)

When explaining a stack, focus on:
1. Why these tools work well TOGETHER for the stated idea
2. Real integration benefits (e.g., "Clerk + Next.js has first-party middleware")
3. Developer experience advantages
4. Cost implications for the project scale
5. Potential risks or limitations

Be concise, technical, and actionable. Avoid marketing language.`;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export function buildExplanationPrompt(tools: Tool[], idea: string): string {
  const toolList = tools
    .map((t) => `- ${t.name} (${t.categoryId}): ${t.description}`)
    .join("\n");

  return `The user's project idea: "${idea}"

The recommended stack contains these tools:
${toolList}

Explain why this stack is recommended for this idea. Include:
- A 2-3 sentence summary
- 2-5 key reasons
- A confidence score (0-1) based on how well these tools fit the idea`;
}

export function buildTradeoffPrompt(
  tools: Tool[],
  diagnostics: Diagnostic[],
): string {
  const toolNames = tools.map((t) => t.name).join(", ");
  const diagList =
    diagnostics.length > 0
      ? diagnostics
          .filter((d) => d.level !== "info")
          .map((d) => `- [${d.level}] ${d.message}`)
          .join("\n")
      : "No diagnostics (clean stack).";

  return `Stack: ${toolNames}

Diagnostics from our compatibility engine:
${diagList}

Analyze the tradeoffs of this stack. For each tradeoff, provide:
- The aspect (e.g., Performance, Cost, DX, Scalability, Vendor Lock-in)
- A clear description of the tradeoff
- Severity: low, medium, or high`;
}

export function buildWhyNotPrompt(
  primaryTools: Tool[],
  alternativeTools: Tool[],
  idea: string,
): string {
  const primary = primaryTools.map((t) => t.name).join(", ");
  const alternative = alternativeTools.map((t) => t.name).join(", ");

  return `Project idea: "${idea}"

Primary (chosen) stack: ${primary}
Alternative stack: ${alternative}

Explain briefly:
1. Why the alternative was NOT chosen as the primary recommendation
2. What scenarios the alternative would actually be better for`;
}

export function buildRoadmapPrompt(tools: Tool[], idea: string): string {
  const toolNames = tools.map((t) => t.name).join(", ");

  return `Project idea: "${idea}"
Stack: ${toolNames}

Create an implementation roadmap with 2-5 phases. For each phase:
- A phase name (e.g., "Foundation", "Core Features", "Polish & Deploy")
- Estimated duration
- 1-6 key tasks

Also provide a total estimated timeline.`;
}
