import { useMemo, useCallback, useEffect } from 'react';
import { useSuggestionsContext } from '@/context';
import { generateSuggestions } from '@/data/suggestions';
import type { Tool, Category, CategoryId } from '@/types';
import type { Suggestion } from '@/types/suggestion';

/**
 * Hook for managing smart suggestions
 * 
 * Features:
 * - Generates suggestions based on current selections (synchronous, uses useMemo)
 * - Handles suggestion acceptance with category expansion and tool pre-selection
 * - Implements suggestion dismissal with undo capability
 * 
 * @param selectedTools - Currently selected tools
 * @param allTools - All available tools from catalog
 * @param categories - All available categories
 * @param onExpandCategory - Callback to expand a category
 * @param onSelectTool - Callback to select a tool
 * @returns Suggestion management functions and state
 */
export function useSuggestions(
  selectedTools: Tool[],
  allTools: Tool[],
  _categories: Category[],
  onExpandCategory?: (categoryId: CategoryId) => void,
  onSelectTool?: (tool: Tool) => void
) {
  const {
    suggestions,
    dismissedSuggestionIds,
    setSuggestions,
    dismissSuggestion,
    undoDismissal,
    clearDismissed,
    getActiveSuggestions,
  } = useSuggestionsContext();

  /**
   * Generate suggestions based on current selections
   * Uses useMemo for synchronous, memoized computation
   */
  const generatedSuggestions = useMemo(() => {
    return generateSuggestions(selectedTools, allTools);
  }, [selectedTools, allTools]);

  /**
   * Update suggestions context when generated suggestions change
   */
  useEffect(() => {
    setSuggestions(generatedSuggestions);
  }, [generatedSuggestions, setSuggestions]);

  /**
   * Get active (non-dismissed) suggestions
   */
  const activeSuggestions = useMemo(() => {
    return getActiveSuggestions();
  }, [getActiveSuggestions]);

  /**
   * Accept a suggestion
   * - Expands the target category if needed
   * - Pre-selects the suggested tool if specified
   * - Dismisses the suggestion
   * 
   * @param suggestion - The suggestion to accept
   * @returns Object with undo function
   */
  const acceptSuggestion = useCallback(
    (suggestion: Suggestion): { undo: () => void } => {
      // Expand the target category
      if (onExpandCategory) {
        onExpandCategory(suggestion.targetCategoryId);
      }

      // If a specific tool is suggested, select it
      if (suggestion.suggestedToolId && onSelectTool) {
        const toolToSelect = allTools.find((t) => t.id === suggestion.suggestedToolId);
        
        if (toolToSelect) {
          // Check if tool is already selected to avoid duplicates
          const isAlreadySelected = selectedTools.some((t) => t.id === toolToSelect.id);
          
          if (!isAlreadySelected) {
            try {
              onSelectTool(toolToSelect);
            } catch (error) {
              // If selection fails (e.g., cardinality violation), log but don't throw
              console.warn('Failed to select suggested tool:', error);
            }
          }
        }
      }

      // Dismiss the suggestion
      dismissSuggestion(suggestion.id);

      // Return undo function
      return {
        undo: () => {
          undoDismissal(suggestion.id);
        },
      };
    },
    [
      onExpandCategory,
      onSelectTool,
      allTools,
      selectedTools,
      dismissSuggestion,
      undoDismissal,
    ]
  );

  /**
   * Dismiss a suggestion
   * 
   * @param suggestionId - ID of the suggestion to dismiss
   * @returns Object with undo function
   */
  const dismissSuggestionWithUndo = useCallback(
    (suggestionId: string): { undo: () => void } => {
      dismissSuggestion(suggestionId);

      return {
        undo: () => {
          undoDismissal(suggestionId);
        },
      };
    },
    [dismissSuggestion, undoDismissal]
  );

  /**
   * Clear all dismissed suggestions
   */
  const clearAllDismissed = useCallback(() => {
    clearDismissed();
  }, [clearDismissed]);

  /**
   * Check if a suggestion is dismissed
   */
  const isSuggestionDismissed = useCallback(
    (suggestionId: string): boolean => {
      return dismissedSuggestionIds.has(suggestionId);
    },
    [dismissedSuggestionIds]
  );

  /**
   * Get suggestion by ID
   */
  const getSuggestionById = useCallback(
    (suggestionId: string): Suggestion | undefined => {
      return suggestions.find((s) => s.id === suggestionId);
    },
    [suggestions]
  );

  return {
    // State
    suggestions: activeSuggestions,
    allSuggestions: suggestions,
    dismissedSuggestionIds,
    
    // Actions
    acceptSuggestion,
    dismissSuggestion: dismissSuggestionWithUndo,
    clearAllDismissed,
    
    // Queries
    isSuggestionDismissed,
    getSuggestionById,
  };
}
