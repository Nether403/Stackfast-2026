import type { Diagnostic, Tool } from "@stackfast/schemas";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExplanationResult {
  /** Human-readable explanation of the stack recommendation. */
  text: string;
  /** Discriminator so the UI can badge heuristic vs. AI output. */
  source: "heuristic" | "ai";
}

export interface TradeoffResult {
  tradeoffs: string[];
  source: "heuristic" | "ai";
}

/**
 * Abstraction over the explanation layer.
 *
 * Phase 3 ships a HeuristicExplainer (deterministic, no LLM).
 * Phase 5 adds AiExplainer (OpenAI / Gemini / Anthropic) as a
 * drop-in replacement via `createExplainer({ provider: "openai" })`.
 */
export interface BlueprintExplainer {
  explainStack(tools: Tool[], idea: string): Promise<ExplanationResult>;
  summarizeTradeoffs(tools: Tool[], diagnostics: Diagnostic[]): Promise<TradeoffResult>;
}

// ---------------------------------------------------------------------------
// Heuristic implementation (Phase 3)
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
// Factory
// ---------------------------------------------------------------------------

export interface ExplainerConfig {
  /** Which provider to use. Only "heuristic" is available in Phase 3. */
  provider?: "heuristic" | "openai" | "gemini" | "anthropic";
  /** API key for the selected AI provider (unused for heuristic). */
  apiKey?: string;
}

/**
 * Create a BlueprintExplainer instance.
 *
 * ```ts
 * const explainer = createExplainer(); // defaults to heuristic
 * const result = await explainer.explainStack(tools, idea);
 * ```
 *
 * In Phase 5 this factory will return an AI-backed implementation
 * when `provider` is set to an AI provider name.
 */
export function createExplainer(config?: ExplainerConfig): BlueprintExplainer {
  const provider = config?.provider ?? "heuristic";

  if (provider === "heuristic") {
    return new HeuristicExplainer();
  }

  // Phase 5: add AI provider implementations here.
  // For now, fall back to heuristic with a warning.
  console.warn(
    `[ai] Provider "${provider}" is not implemented yet (Phase 5). Falling back to heuristic.`,
  );
  return new HeuristicExplainer();
}
