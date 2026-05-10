import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Diagnostic, Tool } from "@stackfast/schemas";
import type { BlueprintExplainer, ExplanationResult, TradeoffResult } from "../index.js";
import {
  AiExplanationResponseSchema,
  AiTradeoffResponseSchema,
} from "../schemas.js";
import {
  SYSTEM_PROMPT,
  buildExplanationPrompt,
  buildTradeoffPrompt,
} from "../prompts.js";

// ---------------------------------------------------------------------------
// Gemini Explainer — powered by Vercel AI SDK + @ai-sdk/google
// ---------------------------------------------------------------------------

export interface GeminiExplainerConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export class GeminiExplainer implements BlueprintExplainer {
  private readonly google;
  private readonly modelId: string;
  private readonly maxOutputTokens: number;
  private readonly timeoutMs: number;

  constructor(config: GeminiExplainerConfig) {
    this.google = createGoogleGenerativeAI({ apiKey: config.apiKey });
    this.modelId = config.model ?? "gemini-2.0-flash";
    this.maxOutputTokens = config.maxTokens ?? 2048;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async explainStack(tools: Tool[], idea: string): Promise<ExplanationResult> {
    try {
      const result = await generateText({
        model: this.google(this.modelId),
        system: SYSTEM_PROMPT,
        prompt: buildExplanationPrompt(tools, idea) +
          "\n\nRespond ONLY with a valid JSON object matching this shape: " +
          '{ "summary": string, "keyReasons": string[], "confidence": number }',
        maxOutputTokens: this.maxOutputTokens,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      });

      // Strip markdown code fences if the model wraps output in them
      const raw = result.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = AiExplanationResponseSchema.parse(JSON.parse(raw));

      const reasonsList = parsed.keyReasons
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n");

      return {
        text: `${parsed.summary}\n\nKey reasons:\n${reasonsList}`,
        source: "ai",
        keyReasons: parsed.keyReasons,
        confidence: parsed.confidence,
      };
    } catch (error) {
      console.warn(
        `[ai/gemini] explainStack failed, will fall back to heuristic:`,
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
        model: this.google(this.modelId),
        system: SYSTEM_PROMPT,
        prompt: buildTradeoffPrompt(tools, diagnostics) +
          "\n\nRespond ONLY with a valid JSON object matching this shape: " +
          '{ "tradeoffs": Array<{ "aspect": string, "description": string, "severity": "low"|"medium"|"high" }> }',
        maxOutputTokens: this.maxOutputTokens,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      });

      const raw = result.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = AiTradeoffResponseSchema.parse(JSON.parse(raw));

      return {
        tradeoffs: parsed.tradeoffs.map(
          (t) => `[${t.severity.toUpperCase()}] ${t.aspect}: ${t.description}`,
        ),
        source: "ai",
      };
    } catch (error) {
      console.warn(
        `[ai/gemini] summarizeTradeoffs failed, will fall back to heuristic:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }
}
