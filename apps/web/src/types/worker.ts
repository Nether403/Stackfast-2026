import { z } from 'zod';
import type { Tool } from './tool';
import type { Rule } from './rule';
import type { Diagnostic } from './diagnostic';

/**
 * Score breakdown structure
 */
export interface ScoreBreakdown {
  base: number;
  bonuses: Array<{ reason: string; weight: number }>;
  penalties: Array<{ reason: string; weight: number }>;
  total: number;
}

/**
 * Evaluation result from rules engine
 */
export interface EvaluationResult {
  score: number;
  breakdown: ScoreBreakdown;
  diagnostics: Diagnostic[];
  evaluationTimeMs: number;
}

/**
 * Worker request payload for rule evaluation
 */
export interface EvaluatePayload {
  selections: Tool[];
  rules: Rule[];
}

/**
 * Worker request message (RPC pattern)
 */
export interface WorkerReq {
  id: number;
  type: 'evaluate';
  payload: EvaluatePayload;
}

/**
 * Worker response message (RPC pattern)
 */
export type WorkerRes =
  | { id: number; ok: true; result: EvaluationResult }
  | { id: number; ok: false; error: string };

/**
 * Zod schema for ScoreBreakdown validation
 */
export const ScoreBreakdownSchema = z.object({
  base: z.number(),
  bonuses: z.array(z.object({
    reason: z.string(),
    weight: z.number(),
  })),
  penalties: z.array(z.object({
    reason: z.string(),
    weight: z.number(),
  })),
  total: z.number(),
});

/**
 * Zod schema for EvaluationResult validation
 */
export const EvaluationResultSchema = z.object({
  score: z.number(),
  breakdown: ScoreBreakdownSchema,
  diagnostics: z.array(z.any()), // Use DiagnosticSchema if imported
  evaluationTimeMs: z.number(),
});

/**
 * Zod schema for EvaluatePayload validation
 */
export const EvaluatePayloadSchema = z.object({
  selections: z.array(z.any()), // Use ToolSchema if imported
  rules: z.array(z.any()), // Use RuleSchema if imported
});

/**
 * Zod schema for WorkerReq validation
 */
export const WorkerReqSchema = z.object({
  id: z.number(),
  type: z.literal('evaluate'),
  payload: EvaluatePayloadSchema,
});

/**
 * Zod schema for WorkerRes validation
 */
export const WorkerResSchema = z.discriminatedUnion('ok', [
  z.object({
    id: z.number(),
    ok: z.literal(true),
    result: EvaluationResultSchema,
  }),
  z.object({
    id: z.number(),
    ok: z.literal(false),
    error: z.string(),
  }),
]);

/**
 * Type guard for WorkerReq
 */
export function isWorkerReq(value: unknown): value is WorkerReq {
  return WorkerReqSchema.safeParse(value).success;
}

/**
 * Type guard for WorkerRes
 */
export function isWorkerRes(value: unknown): value is WorkerRes {
  return WorkerResSchema.safeParse(value).success;
}
