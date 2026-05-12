import { generateText } from "ai";
import { createAzure } from "@ai-sdk/azure";
import type {
  Diagnostic,
  ImplementationRoadmap,
  Tool,
  WhyNotExplanation,
} from "@stackfast/schemas";
import type {
  BlueprintExplainer,
  ExplanationResult,
  RoadmapResult,
  TradeoffResult,
  WhyNotResult,
} from "../index.js";
import {
  AiExplanationResponseSchema,
  AiRoadmapResponseSchema,
  AiTradeoffResponseSchema,
  AiWhyNotResponseSchema,
} from "../schemas.js";
import {
  SYSTEM_PROMPT,
  buildExplanationPrompt,
  buildRoadmapPrompt,
  buildTradeoffPrompt,
  buildWhyNotPrompt,
} from "../prompts.js";

// ---------------------------------------------------------------------------
// Azure OpenAI Explainer — powered by Vercel AI SDK + @ai-sdk/azure
// ---------------------------------------------------------------------------
//
// Azure deployments are customer-named, so the "model" here is actually the
// deployment name configured in the Azure OpenAI Foundry resource. The
// resource name, API key, and deployment name are all operator-provided.
// ---------------------------------------------------------------------------

export interface AzureOpenAIExplainerConfig {
  /** Azure resource name (the sub-domain in <resource>.openai.azure.com). */
  resourceName: string;
  /** Azure OpenAI API key. */
  apiKey: string;
  /** Deployment name (e.g., "gpt-5.5" or "gpt-4.1"). Must exist in the resource. */
  deployment: string;
  /** Optional API version override. */
  apiVersion?: string;
  /** Max output tokens. Default: 2048. */
  maxTokens?: number;
  /** Timeout in ms before falling back to heuristic. Default: 30000. */
  timeoutMs?: number;
}

export class AzureOpenAIExplainer implements BlueprintExplainer {
  private readonly azure;
  private readonly deployment: string;
  private readonly maxOutputTokens: number;
  private readonly timeoutMs: number;

  constructor(config: AzureOpenAIExplainerConfig) {
    this.azure = createAzure({
      resourceName: config.resourceName,
      apiKey: config.apiKey,
      ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
    });
    this.deployment = config.deployment;
    this.maxOutputTokens = config.maxTokens ?? 2048;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async explainStack(tools: Tool[], idea: string): Promise<ExplanationResult> {
    try {
      const result = await generateText({
        model: this.azure(this.deployment),
        system: SYSTEM_PROMPT,
        prompt:
          buildExplanationPrompt(tools, idea) +
          "\n\nRespond ONLY with a valid JSON object matching this shape: " +
          '{ "summary": string, "keyReasons": string[], "confidence": number }',
        maxOutputTokens: this.maxOutputTokens,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      });

      const raw = stripJsonFences(result.text);
      const parsed = AiExplanationResponseSchema.parse(JSON.parse(raw));

      const reasonsList = parsed.keyReasons
        .map((r: string, i: number) => `${i + 1}. ${r}`)
        .join("\n");

      return {
        text: `${parsed.summary}\n\nKey reasons:\n${reasonsList}`,
        source: "ai",
        keyReasons: parsed.keyReasons,
        confidence: parsed.confidence,
      };
    } catch (error) {
      console.warn(
        "[ai/azure-openai] explainStack failed, will fall back to heuristic:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  async summarizeTradeoffs(
    tools: Tool[],
    diagnostics: Diagnostic[],
  ): Promise<TradeoffResult> {
    try {
      const result = await generateText({
        model: this.azure(this.deployment),
        system: SYSTEM_PROMPT,
        prompt:
          buildTradeoffPrompt(tools, diagnostics) +
          "\n\nRespond ONLY with a valid JSON object matching this shape: " +
          '{ "tradeoffs": Array<{ "aspect": string, "description": string, "severity": "low"|"medium"|"high" }> }',
        maxOutputTokens: this.maxOutputTokens,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      });

      const raw = stripJsonFences(result.text);
      const parsed = AiTradeoffResponseSchema.parse(JSON.parse(raw));

      return {
        tradeoffs: parsed.tradeoffs.map(
          (t: {
            severity: "low" | "medium" | "high";
            aspect: string;
            description: string;
          }) => `[${t.severity.toUpperCase()}] ${t.aspect}: ${t.description}`,
        ),
        source: "ai",
      };
    } catch (error) {
      console.warn(
        "[ai/azure-openai] summarizeTradeoffs failed, will fall back to heuristic:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  async explainWhyNot(
    primaryTools: Tool[],
    alternativeTools: Tool[],
    idea: string,
  ): Promise<WhyNotResult> {
    try {
      const result = await generateText({
        model: this.azure(this.deployment),
        system: SYSTEM_PROMPT,
        prompt:
          buildWhyNotPrompt(primaryTools, alternativeTools, idea) +
          "\n\nRespond ONLY with a valid JSON object matching this shape: " +
          '{ "reason": string, "betterFor"?: string }',
        maxOutputTokens: this.maxOutputTokens,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      });

      const raw = stripJsonFences(result.text);
      const parsed = AiWhyNotResponseSchema.parse(JSON.parse(raw));

      const whyNot: WhyNotExplanation = parsed.betterFor
        ? { reason: parsed.reason, betterFor: parsed.betterFor }
        : { reason: parsed.reason };

      return { whyNot, source: "ai" };
    } catch (error) {
      console.warn(
        "[ai/azure-openai] explainWhyNot failed, will fall back to heuristic:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  async generateRoadmap(tools: Tool[], idea: string): Promise<RoadmapResult> {
    try {
      const result = await generateText({
        model: this.azure(this.deployment),
        system: SYSTEM_PROMPT,
        prompt:
          buildRoadmapPrompt(tools, idea) +
          "\n\nRespond ONLY with a valid JSON object matching this shape: " +
          '{ "phases": Array<{ "name": string, "duration": string, "tasks": string[] }>, "totalEstimate": string }. ' +
          "Return 2-5 phases with 1-6 tasks each.",
        maxOutputTokens: this.maxOutputTokens,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      });

      const raw = stripJsonFences(result.text);
      const parsed = AiRoadmapResponseSchema.parse(JSON.parse(raw));

      const roadmap: ImplementationRoadmap = {
        phases: parsed.phases,
        totalEstimate: parsed.totalEstimate,
      };

      return { roadmap, source: "ai" };
    } catch (error) {
      console.warn(
        "[ai/azure-openai] generateRoadmap failed, will fall back to heuristic:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Strip markdown ```json code fences the model might wrap output in.
 */
function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}
