import type { Tool } from "@stackfast/schemas";

// ---------------------------------------------------------------------------
// Phase 5 extended types for blueprint AI enhancement
// ---------------------------------------------------------------------------

/**
 * Static cost estimate for a single tool, derived from registry pricing data.
 */
export interface ToolCostEstimate {
  toolId: string;
  toolName: string;
  pricingModel: "free" | "free-tier" | "paid";
  /** Estimated monthly cost in USD. Null for free tools. */
  estimatedMonthlyCost: number | null;
  note: string;
}

/**
 * Full cost breakdown for a blueprint stack.
 */
export interface BlueprintCostEstimate {
  items: ToolCostEstimate[];
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  currency: "USD";
}

/**
 * A phase in the implementation roadmap.
 */
export interface RoadmapPhase {
  name: string;
  duration: string;
  tasks: string[];
}

/**
 * Full implementation roadmap for a stack.
 */
export interface ImplementationRoadmap {
  phases: RoadmapPhase[];
  totalEstimate: string;
}

/**
 * "Why not" explanation for a rejected alternative.
 */
export interface WhyNotExplanation {
  reason: string;
  betterFor?: string;
}

/**
 * An alternative stack option with AI-enhanced metadata.
 */
export interface EnhancedAlternative {
  id: string;
  name: string;
  toolIds: string[];
  harmonyScore: number;
  tradeoffs: string[];
  tradeoffSource: "heuristic" | "ai";
  whyNot?: WhyNotExplanation;
}

/**
 * The full AI-enhanced blueprint response shape.
 */
export interface EnhancedBlueprintResponse {
  idea: string;
  recommendedStack: {
    toolIds: string[];
    tools: Tool[];
    harmonyScore: number;
    diagnostics: import("@stackfast/schemas").Diagnostic[];
    rationale: string;
    explanationSource: "heuristic" | "ai";
    keyReasons?: string[];
    confidence?: number;
  };
  alternatives: EnhancedAlternative[];
  risks: string[];
  costEstimate: BlueprintCostEstimate;
  roadmap?: ImplementationRoadmap;
  files: import("@stackfast/schemas").ExportFile[];
  export: import("@stackfast/schemas").ExportData;
}

/**
 * Configuration for the AI provider.
 */
export interface AiProviderConfig {
  provider: "gemini" | "azure-openai" | "heuristic";
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  azureResourceName?: string;
  azureApiVersion?: string;
}
