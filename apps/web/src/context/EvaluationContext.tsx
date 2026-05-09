import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { EvaluationResult, Diagnostic } from '@/types';

/**
 * Evaluation state interface
 */
export interface EvaluationState {
  result: EvaluationResult | null;
  isEvaluating: boolean;
  error: Error | null;
}

/**
 * Evaluation context value interface
 */
export interface EvaluationContextValue {
  result: EvaluationResult | null;
  isEvaluating: boolean;
  error: Error | null;
  score: number;
  diagnostics: Diagnostic[];
  setResult: (result: EvaluationResult | null) => void;
  setIsEvaluating: (isEvaluating: boolean) => void;
  setError: (error: Error | null) => void;
  reset: () => void;
}

/**
 * Evaluation context
 */
const EvaluationContext = createContext<EvaluationContextValue | undefined>(undefined);

/**
 * Props for EvaluationProvider
 */
export interface EvaluationProviderProps {
  children: ReactNode;
}

/**
 * EvaluationProvider component
 * Manages rules evaluation state and results
 */
export function EvaluationProvider({ children }: EvaluationProviderProps) {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setIsEvaluating(false);
    setError(null);
  }, []);

  const score = useMemo(() => result?.score ?? 50, [result]);
  const diagnostics = useMemo(() => result?.diagnostics ?? [], [result]);

  const value = useMemo(
    () => ({
      result,
      isEvaluating,
      error,
      score,
      diagnostics,
      setResult,
      setIsEvaluating,
      setError,
      reset,
    }),
    [result, isEvaluating, error, score, diagnostics, reset]
  );

  return <EvaluationContext.Provider value={value}>{children}</EvaluationContext.Provider>;
}

/**
 * Hook to access evaluation context
 * @throws Error if used outside EvaluationProvider
 */
export function useEvaluationContext(): EvaluationContextValue {
  const context = useContext(EvaluationContext);
  if (!context) {
    throw new Error('useEvaluationContext must be used within EvaluationProvider');
  }
  return context;
}
