import { useEffect, useRef, useCallback } from 'react';
import { useEvaluationContext } from '@/context';
import { evaluateRulesWithFallback } from '@/engine';
import { apiClient } from '@/lib/api-client';
import type { StackAnalyzeResponse } from '@stackfast/schemas';
import type { Tool, Rule, EvaluationResult, Diagnostic } from '@/types';

/**
 * Debounce delay for rapid selections (in milliseconds)
 */
const DEBOUNCE_DELAY_MS = 100;

function diagnosticsFromApiResponse(response: StackAnalyzeResponse): Diagnostic[] {
  const diagnostics = new Map<string, Diagnostic>();

  for (const diagnostic of [
    ...response.conflicts,
    ...response.warnings,
    ...response.synergies,
  ] as Diagnostic[]) {
    diagnostics.set(diagnostic.id, diagnostic);
  }

  response.recommendations.forEach((message, index) => {
    const id = `api-recommendation-${index}`;
    if (!diagnostics.has(id)) {
      diagnostics.set(id, {
        id,
        level: 'info',
        category: 'coverage',
        message,
        weight: 0,
      });
    }
  });

  return Array.from(diagnostics.values());
}

function buildEvaluationResultFromApi(
  response: StackAnalyzeResponse,
  evaluationTimeMs: number
): EvaluationResult {
  const diagnostics = diagnosticsFromApiResponse(response);
  const bonuses = diagnostics
    .filter((diagnostic) => (diagnostic.weight ?? 0) > 0)
    .map((diagnostic) => ({ reason: diagnostic.message, weight: diagnostic.weight ?? 0 }));
  const penalties = diagnostics
    .filter((diagnostic) => (diagnostic.weight ?? 0) < 0)
    .map((diagnostic) => ({ reason: diagnostic.message, weight: diagnostic.weight ?? 0 }));

  return {
    score: response.harmonyScore,
    diagnostics,
    evaluationTimeMs,
    breakdown: {
      base: 50,
      bonuses,
      penalties,
      total: response.harmonyScore,
    },
  };
}

/**
 * Hook for managing rules engine evaluation with async handling
 * 
 * Features:
 * - Async evaluation using useEffect (NOT useMemo)
 * - Sequence token to prevent race conditions
 * - Debouncing for rapid selections
 * - Worker usage guarded by environment check
 * - Performance tracking with performance.now()
 * 
 * @param selections - Currently selected tools
 * @param rules - Compatibility rules to evaluate
 * @param enabled - Whether evaluation is enabled (default: true)
 */
export function useRulesEngine(
  selections: Tool[],
  rules: Rule[],
  enabled: boolean = true
) {
  const {
    setResult,
    setIsEvaluating,
    setError,
    result,
    isEvaluating,
    error,
  } = useEvaluationContext();

  // Sequence token to prevent race conditions
  const sequenceRef = useRef(0);
  
  // Debounce timer
  const debounceTimerRef = useRef<number | null>(null);

  /**
   * Perform evaluation with sequence token and performance tracking
   */
  const performEvaluation = useCallback(
    async (currentSequence: number) => {
      // Guard: Skip if disabled
      if (!enabled) {
        return;
      }

      setIsEvaluating(true);
      setError(null);

      try {
        // Track performance
        const startTime = performance.now();

        let evaluationResult: EvaluationResult;

        if (selections.length > 0) {
          try {
            const apiResult = await apiClient.analyzeStack({
              toolIds: selections.map((tool) => tool.id),
            });
            evaluationResult = buildEvaluationResultFromApi(apiResult, performance.now() - startTime);
          } catch (apiError) {
            console.warn('[Rules Engine] API analysis failed; falling back to local evaluation:', apiError);
            evaluationResult = await evaluateRulesWithFallback(selections, rules);
          }
        } else {
          evaluationResult = await evaluateRulesWithFallback(selections, rules);
        }

        const endTime = performance.now();
        const evaluationTime = endTime - startTime;
        evaluationResult.evaluationTimeMs = evaluationTime;

        // Log performance in dev mode (only log if not in production)
        if (typeof window !== 'undefined' && !window.location.hostname.includes('vercel')) {
          console.log(`[Rules Engine] Evaluation completed in ${evaluationTime.toFixed(2)}ms`);
        }

        // Only update state if this is still the latest evaluation
        if (currentSequence === sequenceRef.current) {
          setResult(evaluationResult);
          setIsEvaluating(false);
        }
      } catch (err) {
        // Only update error if this is still the latest evaluation
        if (currentSequence === sequenceRef.current) {
          const error = err instanceof Error ? err : new Error('Unknown evaluation error');
          setError(error);
          setIsEvaluating(false);
          console.error('[Rules Engine] Evaluation failed:', error);
        }
      }
    },
    [enabled, selections, rules, setResult, setIsEvaluating, setError]
  );

  /**
   * Debounced evaluation trigger
   */
  const triggerEvaluation = useCallback(() => {
    // Clear existing timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    // Increment sequence token
    const currentSequence = ++sequenceRef.current;

    // Set new debounced timer
    debounceTimerRef.current = setTimeout(() => {
      performEvaluation(currentSequence);
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY_MS) as unknown as number;
  }, [performEvaluation]);

  /**
   * Effect: Trigger evaluation when selections or rules change
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    triggerEvaluation();

    // Cleanup: Cancel pending evaluation on unmount or dependency change
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [enabled, triggerEvaluation]);

  /**
   * Manual re-evaluation (bypasses debounce)
   */
  const reEvaluate = useCallback(() => {
    // Clear debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Increment sequence and evaluate immediately
    const currentSequence = ++sequenceRef.current;
    performEvaluation(currentSequence);
  }, [performEvaluation]);

  return {
    result,
    isEvaluating,
    error,
    reEvaluate,
  };
}
