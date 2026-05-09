import { useCallback, useEffect } from 'react';
import { useSelectionsContext } from '@/context';
import type { Tool, Category, CategoryId } from '@/types';

/**
 * Storage key for persisting selections
 */
const SELECTIONS_STORAGE_KEY = 'stackfast-selections';

/**
 * Serialized selection data for storage
 */
interface SerializedSelections {
  version: string;
  selections: Record<CategoryId, Tool>;
  timestamp: number;
}

/**
 * Cardinality validation error
 */
export class CardinalityViolationError extends Error {
  constructor(
    public categoryName: string,
    public attemptedToolName: string
  ) {
    super(`Cannot select ${attemptedToolName}. Only one ${categoryName} may be selected.`);
    this.name = 'CardinalityViolationError';
  }
}

/**
 * Hook for managing stack tool selections with cardinality enforcement
 * 
 * Features:
 * - Cardinality validation at UI layer
 * - localStorage persistence (client-only)
 * - Import/Export selections as JSON
 * 
 * @param categories - Available categories for validation
 * @returns Selection management functions
 */
export function useStackSelection(categories: Category[]) {
  const {
    selectedTools,
    selectTool,
    deselectTool,
    clearSelections,
    getSelectedTool,
    getAllSelectedTools,
    isToolSelected,
  } = useSelectionsContext();

  /**
   * Validate if a tool can be selected based on category cardinality
   */
  const canSelectTool = useCallback(
    (tool: Tool): { canSelect: boolean; reason?: string } => {
      const category = categories.find((c) => c.id === tool.categoryId);
      
      if (!category) {
        return { canSelect: false, reason: 'Category not found' };
      }

      const currentSelection = getSelectedTool(tool.categoryId);
      
      // If same tool is already selected, allow (no-op)
      if (currentSelection?.id === tool.id) {
        return { canSelect: true };
      }

      // Check cardinality rules
      switch (category.cardinality) {
        case 'exactly-one':
        case 'at-most-one':
        case 'zero-or-one':
          // These cardinalities allow only one selection
          // If something is already selected, prevent new selection
          if (currentSelection) {
            return {
              canSelect: false,
              reason: `Only one ${category.name} may be selected. Deselect ${currentSelection.name} first.`,
            };
          }
          return { canSelect: true };

        case 'zero-to-many':
          // Multiple selections allowed
          return { canSelect: true };

        default:
          return { canSelect: false, reason: 'Unknown cardinality type' };
      }
    },
    [categories, getSelectedTool]
  );

  /**
   * Select a tool with cardinality validation
   * @throws CardinalityViolationError if selection violates cardinality rules
   */
  const selectToolWithValidation = useCallback(
    (tool: Tool) => {
      const validation = canSelectTool(tool);
      
      if (!validation.canSelect) {
        const category = categories.find((c) => c.id === tool.categoryId);
        throw new CardinalityViolationError(
          category?.name ?? tool.categoryId,
          tool.name
        );
      }

      selectTool(tool);
    },
    [canSelectTool, selectTool, categories]
  );

  /**
   * Load selections from localStorage (client-only)
   */
  const loadSelectionsFromStorage = useCallback((): Map<CategoryId, Tool> | null => {
    // Guard against SSR
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem(SELECTIONS_STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const parsed: SerializedSelections = JSON.parse(stored);
      
      // Convert Record to Map
      const selectionsMap = new Map<CategoryId, Tool>();
      Object.entries(parsed.selections).forEach(([categoryId, tool]) => {
        selectionsMap.set(categoryId as CategoryId, tool);
      });

      return selectionsMap;
    } catch (error) {
      console.warn('Failed to load selections from storage:', error);
      return null;
    }
  }, []);

  /**
   * Save selections to localStorage (client-only)
   */
  const saveSelectionsToStorage = useCallback(() => {
    // Guard against SSR
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const selectionsRecord: Partial<Record<CategoryId, Tool>> = {};
      selectedTools.forEach((tool, categoryId) => {
        selectionsRecord[categoryId] = tool;
      });

      const data: SerializedSelections = {
        version: '1.0',
        selections: selectionsRecord as Record<CategoryId, Tool>,
        timestamp: Date.now(),
      };

      localStorage.setItem(SELECTIONS_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save selections to storage:', error);
    }
  }, [selectedTools]);

  /**
   * Export selections as JSON string
   */
  const exportSelections = useCallback((): string => {
    const selectionsRecord: Partial<Record<CategoryId, Tool>> = {};
    selectedTools.forEach((tool, categoryId) => {
      selectionsRecord[categoryId] = tool;
    });

    const data: SerializedSelections = {
      version: '1.0',
      selections: selectionsRecord as Record<CategoryId, Tool>,
      timestamp: Date.now(),
    };

    return JSON.stringify(data, null, 2);
  }, [selectedTools]);

  /**
   * Import selections from JSON string
   * @throws Error if JSON is invalid or contains invalid tools
   */
  const importSelections = useCallback(
    (jsonString: string) => {
      try {
        const parsed: SerializedSelections = JSON.parse(jsonString);
        
        // Clear existing selections
        clearSelections();

        // Import each tool with validation
        Object.entries(parsed.selections).forEach(([, tool]) => {
          try {
            selectToolWithValidation(tool);
          } catch (error) {
            console.warn(`Failed to import tool ${tool.name}:`, error);
          }
        });
      } catch (error) {
        throw new Error(`Failed to import selections: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [clearSelections, selectToolWithValidation]
  );

  /**
   * Clear all selections and storage
   */
  const clearAllSelections = useCallback(() => {
    clearSelections();
    
    // Clear from storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SELECTIONS_STORAGE_KEY);
    }
  }, [clearSelections]);

  /**
   * Auto-save selections to localStorage when they change
   */
  useEffect(() => {
    saveSelectionsToStorage();
  }, [saveSelectionsToStorage]);

  return {
    // State
    selectedTools,
    
    // Selection operations
    selectTool: selectToolWithValidation,
    deselectTool,
    clearSelections: clearAllSelections,
    getSelectedTool,
    getAllSelectedTools,
    isToolSelected,
    
    // Validation
    canSelectTool,
    
    // Import/Export
    exportSelections,
    importSelections,
    loadSelectionsFromStorage,
  };
}
