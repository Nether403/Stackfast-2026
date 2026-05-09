/**
 * Rules Engine with Fallback
 * 
 * Provides a unified interface for rule evaluation that automatically falls back
 * to main-thread execution if the Web Worker is unavailable or fails.
 */

import { evaluateRulesSync } from './rules-engine';
import { makeRulesWorker } from './worker-wrapper';
import type { Tool, Rule, EvaluationResult } from '@/types';

/**
 * Singleton worker instance
 */
let workerInstance: ReturnType<typeof makeRulesWorker> | null | undefined = undefined;

/**
 * Get or create the worker instance
 */
function getWorker(): ReturnType<typeof makeRulesWorker> {
  if (workerInstance === undefined) {
    workerInstance = makeRulesWorker();
  }
  return workerInstance;
}

/**
 * Evaluate rules with automatic fallback to main thread
 * 
 * Strategy:
 * 1. Try to use Web Worker if available
 * 2. Fall back to main thread if Worker fails or is unavailable
 * 3. Log performance metrics in dev mode
 */
export async function evaluateRulesWithFallback(
  selections: Tool[],
  rules: Rule[]
): Promise<EvaluationResult> {
  const worker = getWorker();
  
  // If Worker is not available (SSR or unsupported browser), use sync fallback
  if (!worker) {
    return evaluateRulesSync(selections, rules);
  }
  
  // Try Worker evaluation with fallback
  try {
    const result = await worker.evaluate(selections, rules);
    return result;
  } catch (error) {
    // Log warning and fall back to main thread
    console.warn('[Rules Engine] Worker failed, falling back to main thread:', error);
    return evaluateRulesSync(selections, rules);
  }
}

/**
 * Terminate the worker instance (for cleanup)
 */
export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}

/**
 * Export the sync version for direct use
 */
export { evaluateRulesSync };
