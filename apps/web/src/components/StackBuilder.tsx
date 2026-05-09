import { useState, useMemo } from 'react';
import { Download, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { CategorySection } from './CategorySection';
import { CompatibilityScore } from './CompatibilityScore';
import { SmartSuggestion } from './SmartSuggestion';
import { DiagnosticList } from './DiagnosticList';
import { useStackSelection } from '@/hooks/useStackSelection';
import { useRulesEngine } from '@/hooks/useRulesEngine';
import { useSuggestionsContext } from '@/context';
import { clearCatalogCache } from '@/lib/catalog-loader';
import type { Tool, Category, Rule, Diagnostic } from '@/types';
import type { Suggestion } from '@/types/suggestion';
import type { ScoreBreakdown } from './CompatibilityScore';

export interface StackBuilderProps {
  tools: Tool[];
  categories: Category[];
  rules: Rule[];
  onExport?: () => void;
  catalogVersion?: string;
  catalogUpdatedAt?: string;
}

/**
 * StackBuilder main container component
 * 
 * Features:
 * - Orchestrates all child components
 * - Displays compatibility score at top
 * - Shows smart suggestions below score
 * - Renders category sections in order
 * - Export button
 * - Responsive layout (mobile/tablet/desktop)
 */
export function StackBuilder({
  tools,
  categories,
  rules,
  onExport,
  catalogVersion,
  catalogUpdatedAt,
}: StackBuilderProps) {
  const { toast } = useToast();
  
  // Selection management
  const {
    selectTool,
    getSelectedTool,
    getAllSelectedTools,
    clearSelections,
  } = useStackSelection(categories);

  // Suggestions management
  const {
    dismissSuggestion,
    undoDismissal,
    getActiveSuggestions,
  } = useSuggestionsContext();

  // Category expansion state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.filter(c => c.required).map(c => c.id))
  );

  // Get selected tools as array
  const selectedToolsArray = useMemo(() => getAllSelectedTools(), [getAllSelectedTools]);

  // Rules engine evaluation
  const { result, isEvaluating, error } = useRulesEngine(
    selectedToolsArray,
    rules,
    true
  );

  // Calculate score breakdown from diagnostics
  const scoreBreakdown = useMemo((): ScoreBreakdown => {
    if (!result) {
      return {
        base: 50,
        bonuses: [],
        penalties: [],
        total: 50,
      };
    }

    const bonuses = result.diagnostics
      .filter(d => (d.weight ?? 0) > 0)
      .map(d => ({
        reason: d.message,
        weight: d.weight!,
        ruleId: d.ruleId,
        ruleVersion: d.ruleVersion,
      }));

    const penalties = result.diagnostics
      .filter(d => (d.weight ?? 0) < 0)
      .map(d => ({
        reason: d.message,
        weight: d.weight!,
        ruleId: d.ruleId,
        ruleVersion: d.ruleVersion,
      }));

    return {
      base: 50,
      bonuses,
      penalties,
      total: result.score,
    };
  }, [result]);

  // Get active suggestions
  const activeSuggestions = useMemo(() => getActiveSuggestions(), [getActiveSuggestions]);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Handle tool selection
  const handleSelectTool = (tool: Tool) => {
    try {
      selectTool(tool);
    } catch (error) {
      console.error('Failed to select tool:', error);
      // Error is already displayed via inline validation
    }
  };

  // Handle suggestion acceptance
  const handleAcceptSuggestion = (suggestion: Suggestion) => {
    // Expand target category
    setExpandedCategories(prev => new Set(prev).add(suggestion.targetCategoryId));

    // If suggestion includes a specific tool, select it
    if (suggestion.suggestedToolId && suggestion.action === 'select-tool') {
      const tool = tools.find(t => t.id === suggestion.suggestedToolId);
      if (tool) {
        // Check if tool is already selected to avoid duplicates
        const currentSelection = getSelectedTool(tool.categoryId);
        if (currentSelection?.id !== tool.id) {
          handleSelectTool(tool);
        }
      }
    }

    // Dismiss the suggestion after acceptance
    dismissSuggestion(suggestion.id);
  };

  // Handle "Fix it" button in diagnostics
  const handleFixIt = (diagnostic: Diagnostic) => {
    const { cta } = diagnostic;

    if (cta?.kind === 'expand-category' && cta.targetCategoryId) {
      const { targetCategoryId } = cta;
      setExpandedCategories(prev => new Set(prev).add(targetCategoryId));
    }
    
    if (cta?.kind === 'select-tool' && cta.suggestedToolId) {
      const tool = tools.find(t => t.id === cta.suggestedToolId);
      if (tool) {
        handleSelectTool(tool);
      }
    }
  };

  // Sort categories by order
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  // Show initial hint when no tools selected
  const showInitialHint = selectedToolsArray.length === 0;

  // Handle clear all data
  const handleClearAllData = () => {
    clearSelections();
    clearCatalogCache();
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    
    toast({
      title: 'Data cleared',
      description: 'All selections and cached data have been removed.',
    });
  };

  // Handle refresh catalog
  const handleRefreshCatalog = () => {
    clearCatalogCache();
    toast({
      title: 'Catalog refresh requested',
      description: 'Please refresh the page to load the latest catalog.',
    });
  };

  // Format catalog updated date
  const formattedUpdatedAt = catalogUpdatedAt
    ? new Date(catalogUpdatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-bold mb-2">StackFast</h1>
              <p className="text-lg text-muted-foreground">
                Build your perfect JavaScript tech stack with intelligent compatibility checking
              </p>
              {catalogVersion && formattedUpdatedAt && (
                <p className="text-sm text-muted-foreground mt-2">
                  Catalog v{catalogVersion} • Updated {formattedUpdatedAt}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefreshCatalog}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Catalog
              </Button>
              <Button
                onClick={handleClearAllData}
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Clear All Data
              </Button>
            </div>
          </div>
        </header>

        {/* Main content - responsive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Categories (2/3 width on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Initial hint */}
            {showInitialHint && (
              <div className="p-6 bg-primary/5 border border-primary/20 rounded-lg text-center">
                <p className="text-lg font-medium mb-2">
                  Select a frontend framework to get started
                </p>
                <p className="text-sm text-muted-foreground">
                  Choose from Next.js, Remix, Astro, or SvelteKit to begin building your stack
                </p>
              </div>
            )}

            {/* Category sections */}
            {sortedCategories.map(category => {
              const categoryTools = tools.filter(t => t.categoryId === category.id);
              const selectedTool = getSelectedTool(category.id);
              const categoryDiagnostics = result?.diagnostics.filter(d =>
                d.toolIds?.some(toolId => categoryTools.some(t => t.id === toolId))
              ) ?? [];

              return (
                <CategorySection
                  key={category.id}
                  category={category}
                  tools={categoryTools}
                  selectedTool={selectedTool}
                  onSelect={handleSelectTool}
                  diagnostics={categoryDiagnostics}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                />
              );
            })}
          </div>

          {/* Right column - Score, Suggestions, Diagnostics (1/3 width on desktop) */}
          <div className="space-y-6">
            {/* Compatibility Score */}
            <CompatibilityScore
              score={result?.score ?? 50}
              breakdown={scoreBreakdown}
              diagnostics={result?.diagnostics ?? []}
            />

            {/* Loading indicator */}
            {isEvaluating && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Evaluating compatibility...</span>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                <p className="font-medium mb-1">Evaluation Error</p>
                <p>{error.message}</p>
              </div>
            )}

            {/* Smart Suggestions */}
            {activeSuggestions.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Smart Suggestions</h2>
                {activeSuggestions.map(suggestion => (
                  <SmartSuggestion
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAccept={handleAcceptSuggestion}
                    onDismiss={dismissSuggestion}
                    onUndo={undoDismissal}
                  />
                ))}
              </div>
            )}

            {/* Diagnostics List */}
            {result && result.diagnostics.length > 0 && (
              <DiagnosticList
                diagnostics={result.diagnostics}
                onFixIt={handleFixIt}
              />
            )}

            {/* Export Button */}
            {selectedToolsArray.length > 0 && (
              <Button
                onClick={onExport}
                className="w-full gap-2"
                size="lg"
              >
                <Download className="h-5 w-5" />
                Export Stack Configuration
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
