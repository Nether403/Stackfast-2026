import type { Diagnostic, Tool } from "@stackfast/schemas";
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

/**
 * Abstraction over the explanation layer.
 *
 * Phase 3 shipped a HeuristicExplainer (deterministic, no LLM).
 * Phase 5 adds AI-backed implementations via the Vercel AI SDK
 * as a drop-in replacement via `createExplainer({ provider: "gemini" })`.
 */
export interface BlueprintExplainer {
  explainStack(tools: Tool[], idea: string): Promise<ExplanationResult>;
  summarizeTradeoffs(tools: Tool[], diagnostics: Diagnostic[]): Promise<TradeoffResult>;
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
