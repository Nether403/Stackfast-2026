import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { Suggestion } from '@/types';

/**
 * Suggestions context value interface
 */
export interface SuggestionsContextValue {
  suggestions: Suggestion[];
  dismissedSuggestionIds: Set<string>;
  setSuggestions: (suggestions: Suggestion[]) => void;
  dismissSuggestion: (suggestionId: string) => void;
  undoDismissal: (suggestionId: string) => void;
  clearDismissed: () => void;
  getActiveSuggestions: () => Suggestion[];
}

/**
 * Suggestions context
 */
const SuggestionsContext = createContext<SuggestionsContextValue | undefined>(undefined);

/**
 * Props for SuggestionsProvider
 */
export interface SuggestionsProviderProps {
  children: ReactNode;
}

/**
 * SuggestionsProvider component
 * Manages smart suggestions state and dismissals
 */
export function SuggestionsProvider({ children }: SuggestionsProviderProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());

  const dismissSuggestion = useCallback((suggestionId: string) => {
    setDismissedSuggestionIds((prev) => {
      const next = new Set(prev);
      next.add(suggestionId);
      return next;
    });
  }, []);

  const undoDismissal = useCallback((suggestionId: string) => {
    setDismissedSuggestionIds((prev) => {
      const next = new Set(prev);
      next.delete(suggestionId);
      return next;
    });
  }, []);

  const clearDismissed = useCallback(() => {
    setDismissedSuggestionIds(new Set());
  }, []);

  const getActiveSuggestions = useCallback(() => {
    return suggestions.filter((s) => !dismissedSuggestionIds.has(s.id));
  }, [suggestions, dismissedSuggestionIds]);

  const value = useMemo(
    () => ({
      suggestions,
      dismissedSuggestionIds,
      setSuggestions,
      dismissSuggestion,
      undoDismissal,
      clearDismissed,
      getActiveSuggestions,
    }),
    [
      suggestions,
      dismissedSuggestionIds,
      dismissSuggestion,
      undoDismissal,
      clearDismissed,
      getActiveSuggestions,
    ]
  );

  return <SuggestionsContext.Provider value={value}>{children}</SuggestionsContext.Provider>;
}

/**
 * Hook to access suggestions context
 * @throws Error if used outside SuggestionsProvider
 */
export function useSuggestionsContext(): SuggestionsContextValue {
  const context = useContext(SuggestionsContext);
  if (!context) {
    throw new Error('useSuggestionsContext must be used within SuggestionsProvider');
  }
  return context;
}
