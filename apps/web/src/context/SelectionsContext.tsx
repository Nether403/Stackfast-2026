import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { Tool, ToolId, CategoryId } from '@/types';

/**
 * LocalStorage key for persisting selections
 */
const STORAGE_KEY = 'stackfast-selections';

/**
 * Selections state interface
 */
export interface SelectionsState {
  selectedTools: Map<CategoryId, Tool>;
}

/**
 * Selections context value interface
 */
export interface SelectionsContextValue {
  selectedTools: Map<CategoryId, Tool>;
  selectTool: (tool: Tool) => void;
  deselectTool: (categoryId: CategoryId) => void;
  clearSelections: () => void;
  getSelectedTool: (categoryId: CategoryId) => Tool | undefined;
  getAllSelectedTools: () => Tool[];
  isToolSelected: (toolId: ToolId) => boolean;
}

/**
 * Selections context
 */
const SelectionsContext = createContext<SelectionsContextValue | undefined>(undefined);

/**
 * Props for SelectionsProvider
 */
export interface SelectionsProviderProps {
  children: ReactNode;
  initialSelections?: Map<CategoryId, Tool>;
}

/**
 * Load selections from localStorage (client-side only)
 */
function loadSelectionsFromStorage(): Map<CategoryId, Tool> {
  // Guard localStorage access (SSR safety)
  if (typeof window === 'undefined') {
    return new Map();
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return new Map();
    }
    
    const parsed = JSON.parse(stored) as Array<[CategoryId, Tool]>;
    return new Map(parsed);
  } catch (error) {
    console.warn('[SelectionsContext] Failed to load from localStorage:', error);
    return new Map();
  }
}

/**
 * Save selections to localStorage (client-side only)
 */
function saveSelectionsToStorage(selections: Map<CategoryId, Tool>): void {
  // Guard localStorage access (SSR safety)
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const serialized = JSON.stringify(Array.from(selections.entries()));
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.warn('[SelectionsContext] Failed to save to localStorage:', error);
  }
}

/**
 * SelectionsProvider component
 * Manages tool selection state across categories with localStorage persistence
 */
export function SelectionsProvider({ children, initialSelections }: SelectionsProviderProps) {
  const [selectedTools, setSelectedTools] = useState<Map<CategoryId, Tool>>(() => {
    // Load from localStorage on mount, or use initialSelections
    return initialSelections ?? loadSelectionsFromStorage();
  });

  // Persist selections to localStorage whenever they change
  useEffect(() => {
    saveSelectionsToStorage(selectedTools);
  }, [selectedTools]);

  const selectTool = useCallback((tool: Tool) => {
    setSelectedTools((prev) => {
      const next = new Map(prev);
      next.set(tool.categoryId, tool);
      return next;
    });
  }, []);

  const deselectTool = useCallback((categoryId: CategoryId) => {
    setSelectedTools((prev) => {
      const next = new Map(prev);
      next.delete(categoryId);
      return next;
    });
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedTools(new Map());
  }, []);

  const getSelectedTool = useCallback(
    (categoryId: CategoryId) => {
      return selectedTools.get(categoryId);
    },
    [selectedTools]
  );

  const getAllSelectedTools = useCallback(() => {
    return Array.from(selectedTools.values());
  }, [selectedTools]);

  const isToolSelected = useCallback(
    (toolId: ToolId) => {
      return Array.from(selectedTools.values()).some((tool) => tool.id === toolId);
    },
    [selectedTools]
  );

  const value = useMemo(
    () => ({
      selectedTools,
      selectTool,
      deselectTool,
      clearSelections,
      getSelectedTool,
      getAllSelectedTools,
      isToolSelected,
    }),
    [
      selectedTools,
      selectTool,
      deselectTool,
      clearSelections,
      getSelectedTool,
      getAllSelectedTools,
      isToolSelected,
    ]
  );

  return <SelectionsContext.Provider value={value}>{children}</SelectionsContext.Provider>;
}

/**
 * Hook to access selections context
 * @throws Error if used outside SelectionsProvider
 */
export function useSelectionsContext(): SelectionsContextValue {
  const context = useContext(SelectionsContext);
  if (!context) {
    throw new Error('useSelectionsContext must be used within SelectionsProvider');
  }
  return context;
}

/**
 * Alias for useSelectionsContext (shorter name for convenience)
 */
export const useSelections = useSelectionsContext;
