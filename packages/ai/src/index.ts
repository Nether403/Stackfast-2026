import type { Diagnostic, ImplementationRoadmap, Tool, WhyNotExplanation } from "@stackfast/schemas";
import { GeminiExplainer } from "./providers/gemini.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExplanationResult {
  /** Human-readable explanation of the stack recommendation. */
  text: string;
  /** Discriminator so the UI can badge heuristic vs. AI output. */
  source: "heuristic" | "ai";
  /** AI-generated key reasons (only present when source === "ai"). */
  keyReasons?: string[];
  /** AI confidence score 0-1 (only present when source === "ai"). */
  confidence?: number;
}

export interface TradeoffResult {
  tradeoffs: string[];
  source: "heuristic" | "ai";
}

export interface WhyNotResult {
  whyNot: WhyNotExplanation;
  source: "heuristic" | "ai";
}

export interface RoadmapResult {
  roadmap: ImplementationRoadmap;
  source: "heuristic" | "ai";
}

/**
 * Abstraction over the explanation layer.
 *
 * Phase 3 shipped a HeuristicExplainer (deterministic, no LLM).
 * Phase 5 adds AI-backed implementations via the Vercel AI SDK
 * as a drop-in replacement via `createExplainer({ provider: "gemini" })`.
 *
 * All methods have heuristic fallbacks — callers can always trust
 * they will return a valid result, even if the LLM fails.
 */
export interface BlueprintExplainer {
  explainStack(tools: Tool[], idea: string): Promise<ExplanationResult>;
  summarizeTradeoffs(tools: Tool[], diagnostics: Diagnostic[]): Promise<TradeoffResult>;
  explainWhyNot(
    primaryTools: Tool[],
    alternativeTools: Tool[],
    idea: string,
  ): Promise<WhyNotResult>;
  generateRoadmap(tools: Tool[], idea: string): Promise<RoadmapResult>;
}

// ---------------------------------------------------------------------------
// Heuristic implementation (fallback — always available)
// ---------------------------------------------------------------------------

class HeuristicExplainer implements BlueprintExplainer {
  async explainStack(tools: Tool[], idea: string): Promise<ExplanationResult> {
    const names = tools.map((t) => t.name).join(", ");
    return {
      text: `Recommended ${names} because it provides a validated path for "${idea.trim()}" with common integration coverage.`,
      source: "heuristic",
    };
  }

  async summarizeTradeoffs(tools: Tool[], diagnostics: Diagnostic[]): Promise<TradeoffResult> {
    const tradeoffs = diagnostics
      .filter((d) => d.level !== "info")
      .map((d) => d.message);

    if (tradeoffs.length === 0) {
      return {
        tradeoffs: [`${tools[0]?.name ?? "This stack"} has no blocking compatibility diagnostics.`],
        source: "heuristic",
      };
    }

    return { tradeoffs, source: "heuristic" };
  }

  async explainWhyNot(
    primaryTools: Tool[],
    alternativeTools: Tool[],
    _idea: string,
  ): Promise<WhyNotResult> {
    const changed = diffToolNames(primaryTools, alternativeTools);
    const altName = alternativeTools.map((t) => t.name).join(" + ");

    // Figure out which dimension changed (hosting swap, ORM swap, etc.) and
    // emit a reason based on the category of the changed tool(s).
    const reason =
      changed.length > 0
        ? `Uses ${changed.map((c) => c.alt.name).join(", ")} instead of ${changed.map((c) => c.primary.name).join(", ")}. This is a reasonable alternative, but the primary stack was scored higher by the compatibility engine.`
        : `The alternative stack ${altName} scored slightly lower on the compatibility engine's harmony score.`;

    const betterFor = inferBetterFor(changed);

    return {
      whyNot: betterFor ? { reason, betterFor } : { reason },
      source: "heuristic",
    };
  }

  async generateRoadmap(tools: Tool[], _idea: string): Promise<RoadmapResult> {
    // Deterministic 3-phase skeleton keyed off the tools selected.
    const hasAuth = tools.some((t) => t.categoryId === "auth");
    const hasDb = tools.some((t) => t.categoryId === "database" || t.categoryId === "orm");
    const hasPayments = tools.some((t) => t.categoryId === "payments");
    const hasHosting = tools.some((t) => t.categoryId === "hosting");

    const foundationTasks: string[] = [
      `Scaffold ${tools.find((t) => t.categoryId === "frontend")?.name ?? "the frontend"} app and install dependencies`,
      "Configure local environment variables from `.env.example`",
    ];
    if (hasDb) foundationTasks.push("Provision the database and run initial migrations");
    if (hasAuth) foundationTasks.push("Wire up authentication provider and protect routes");

    const coreTasks: string[] = [
      "Build primary data models and server routes",
      "Implement main UI screens with loading and error states",
    ];
    if (hasPayments) coreTasks.push("Integrate payments checkout and webhooks");
    coreTasks.push("Add validation, logging, and basic observability");

    const deployTasks: string[] = [
      "Write smoke tests for critical paths",
      hasHosting
        ? `Deploy to ${tools.find((t) => t.categoryId === "hosting")?.name ?? "production"} with production env vars`
        : "Deploy to production with production env vars",
      "Configure custom domain and monitoring",
    ];

    return {
      roadmap: {
        phases: [
          { name: "Foundation", duration: "1-2 weeks", tasks: foundationTasks },
          { name: "Core Features", duration: "2-4 weeks", tasks: coreTasks },
          { name: "Polish & Deploy", duration: "1-2 weeks", tasks: deployTasks },
        ],
        totalEstimate: "4-8 weeks",
      },
      source: "heuristic",
    };
  }
}

// ---------------------------------------------------------------------------
// Heuristic helpers
// ---------------------------------------------------------------------------

/**
 * Identify which tools differ between the primary and alternative stacks.
 * Pairs alternates by category when possible so we can say
 * "Drizzle instead of Prisma" rather than "Drizzle instead of everything".
 */
function diffToolNames(
  primary: Tool[],
  alternative: Tool[],
): Array<{ primary: Tool; alt: Tool }> {
  const primaryIds = new Set(primary.map((t) => t.id));
  const altIds = new Set(alternative.map((t) => t.id));

  const removed = primary.filter((t) => !altIds.has(t.id));
  const added = alternative.filter((t) => !primaryIds.has(t.id));

  const pairs: Array<{ primary: Tool; alt: Tool }> = [];
  for (const removedTool of removed) {
    const match = added.find((t) => t.categoryId === removedTool.categoryId);
    if (match) {
      pairs.push({ primary: removedTool, alt: match });
    }
  }
  return pairs;
}

function inferBetterFor(
  changed: Array<{ primary: Tool; alt: Tool }>,
): string | undefined {
  if (changed.length === 0) return undefined;
  const { primary, alt } = changed[0];

  // A small set of category-based heuristics. The AI provider will produce
  // richer copy; this just gives the UI something meaningful to show.
  switch (alt.categoryId) {
    case "hosting":
      return alt.selfHostable
        ? `Teams who prefer more control over runtime and pricing than ${primary.name}.`
        : `Projects with a strong preference for ${alt.name}'s deployment model.`;
    case "orm":
      return `Projects that prefer ${alt.name}'s ${alt.id === "drizzle" ? "SQL-first, lightweight" : "higher-level"} approach.`;
    case "database":
      return `Workloads that align with ${alt.name}'s data model.`;
    default:
      return `Teams already standardized on ${alt.name}.`;
  }
}

// ---------------------------------------------------------------------------
// Fallback wrapper — catches AI errors and falls back to heuristic
// ---------------------------------------------------------------------------

class FallbackExplainer implements BlueprintExplainer {
  constructor(
    private readonly primary: BlueprintExplainer,
    private readonly fallback: BlueprintExplainer = new HeuristicExplainer(),
  ) {}

  async explainStack(tools: Tool[], idea: string): Promise<ExplanationResult> {
    try {
      return await this.primary.explainStack(tools, idea);
    } catch {
      console.warn("[ai] Primary explainer failed, using heuristic fallback.");
      return this.fallback.explainStack(tools, idea);
    }
  }

  async summarizeTradeoffs(tools: Tool[], diagnostics: Diagnostic[]): Promise<TradeoffResult> {
    try {
      return await this.primary.summarizeTradeoffs(tools, diagnostics);
    } catch {
      console.warn("[ai] Primary tradeoff analysis failed, using heuristic fallback.");
      return this.fallback.summarizeTradeoffs(tools, diagnostics);
    }
  }

  async explainWhyNot(
    primaryTools: Tool[],
    alternativeTools: Tool[],
    idea: string,
  ): Promise<WhyNotResult> {
    try {
      return await this.primary.explainWhyNot(primaryTools, alternativeTools, idea);
    } catch {
      console.warn("[ai] Primary why-not explanation failed, using heuristic fallback.");
      return this.fallback.explainWhyNot(primaryTools, alternativeTools, idea);
    }
  }

  async generateRoadmap(tools: Tool[], idea: string): Promise<RoadmapResult> {
    try {
      return await this.primary.generateRoadmap(tools, idea);
    } catch {
      console.warn("[ai] Primary roadmap generation failed, using heuristic fallback.");
      return this.fallback.generateRoadmap(tools, idea);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface ExplainerConfig {
  /** Which provider to use. Defaults to "heuristic". */
  provider?: "heuristic" | "gemini" | "openai";
  /** API key for the selected AI provider (unused for heuristic). */
  apiKey?: string;
  /** Model ID override (e.g., "gemini-2.0-flash", "gpt-4o-mini"). */
  model?: string;
  /** Max tokens per AI response. Default: 2048. */
  maxTokens?: number;
  /** Timeout in ms before falling back to heuristic. Default: 30000. */
  timeoutMs?: number;
}

/**
 * Create a BlueprintExplainer instance.
 *
 * ```ts
 * // Heuristic (no API key needed)
 * const explainer = createExplainer();
 *
 * // Gemini AI (default provider)
 * const explainer = createExplainer({
 *   provider: "gemini",
 *   apiKey: process.env.GEMINI_API_KEY,
 * });
 * ```
 *
 * All AI providers automatically fall back to heuristic mode on failure.
 */
export function createExplainer(config?: ExplainerConfig): BlueprintExplainer {
  const provider = config?.provider ?? "heuristic";

  if (provider === "heuristic") {
    return new HeuristicExplainer();
  }

  if (provider === "gemini") {
    if (!config?.apiKey) {
      console.warn("[ai] Gemini selected but no API key provided. Falling back to heuristic.");
      return new HeuristicExplainer();
    }

    const gemini = new GeminiExplainer({
      apiKey: config.apiKey,
      model: config.model,
      maxTokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
    });

    return new FallbackExplainer(gemini);
  }

  if (provider === "openai") {
    // OpenAI support will be added later (user will add via Azure)
    console.warn("[ai] OpenAI provider is not yet implemented. Falling back to heuristic.");
    return new HeuristicExplainer();
  }

  console.warn(`[ai] Unknown provider "${provider}". Falling back to heuristic.`);
  return new HeuristicExplainer();
}

// Re-exports for consumers
export { estimateCosts } from "./cost-estimator.js";
export type { BlueprintCostEstimate, ToolCostEstimate, ImplementationRoadmap, WhyNotExplanation, EnhancedBlueprintResponse, EnhancedAlternative } from "./types.js";
export type { AiExplanationResponse, AiTradeoffResponse, AiWhyNotResponse, AiRoadmapResponse } from "./schemas.js";
