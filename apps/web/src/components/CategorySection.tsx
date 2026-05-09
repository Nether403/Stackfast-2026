import { ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ToolSelector } from './ToolSelector';
import type { Category } from '@/types/category';
import type { Tool } from '@/types/tool';
import type { Diagnostic } from '@/types/diagnostic';

export interface CategorySectionProps {
  category: Category;
  tools: Tool[];
  selectedTool?: Tool;
  onSelect: (tool: Tool) => void;
  diagnostics: Diagnostic[];
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * CategorySection component displays a collapsible category with tool selection
 * 
 * Features:
 * - Collapsible header with expand/collapse
 * - Radio buttons for exactly-one/at-most-one cardinality
 * - Inline diagnostics display
 * - ARIA attributes for accessibility
 * - Selected tool count when collapsed
 */
export function CategorySection({
  category,
  tools,
  selectedTool,
  onSelect,
  diagnostics,
  isExpanded,
  onToggle,
}: CategorySectionProps) {
  // Filter diagnostics relevant to this category
  const categoryDiagnostics = diagnostics.filter(d => 
    d.toolIds?.some(toolId => tools.some(t => t.id === toolId))
  );

  const hasError = categoryDiagnostics.some(d => d.level === 'error');
  const hasWarning = categoryDiagnostics.some(d => d.level === 'warning');
  const hasSynergy = categoryDiagnostics.some(d => d.category === 'synergy');

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggle}
      className="border rounded-lg bg-card"
    >
      <CollapsibleTrigger
        className="flex items-center justify-between w-full p-4 text-left hover:bg-accent/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`category-${category.id}-content`}
      >
        <div className="flex items-center gap-3 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">
                {category.name}
                {category.required && (
                  <span className="text-destructive ml-1" aria-label="required">*</span>
                )}
              </h3>
              
              {!isExpanded && selectedTool && (
                <Badge variant="secondary" className="ml-2">
                  {selectedTool.name}
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mt-1">
              {category.description}
            </p>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {hasError && (
              <Badge variant="destructive" className="text-xs">
                Error
              </Badge>
            )}
            {hasWarning && !hasError && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                Warning
              </Badge>
            )}
            {hasSynergy && !hasError && !hasWarning && (
              <Badge variant="outline" className="text-xs border-green-500 text-green-700">
                Synergy
              </Badge>
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent
        id={`category-${category.id}-content`}
        className="px-4 pb-4"
      >
        <div className="space-y-3 mt-2">
          {/* Tool selection area */}
          <div
            role="radiogroup"
            aria-labelledby={`category-${category.id}-label`}
            className="space-y-3"
          >
            <span id={`category-${category.id}-label`} className="sr-only">
              Select a {category.name}
            </span>
            
            {tools.map(tool => {
              const isSelected = selectedTool?.id === tool.id;
              const toolDiagnostics = diagnostics.filter(d => 
                d.toolIds?.includes(tool.id)
              );

              return (
                <div key={tool.id} className="space-y-2">
                  <ToolSelector
                    tool={tool}
                    isSelected={isSelected}
                    onSelect={onSelect}
                    name={`category-${category.id}`}
                  />

                  {/* Inline diagnostics for this tool */}
                  {toolDiagnostics.length > 0 && (
                    <div
                      id={`tool-${tool.id}-diagnostics`}
                      className="ml-7 space-y-1"
                      role="status"
                      aria-live="polite"
                    >
                      {toolDiagnostics.map(diagnostic => (
                        <div
                          key={diagnostic.id}
                          className={`
                            text-sm p-2 rounded-md flex items-start gap-2
                            ${diagnostic.level === 'error' ? 'bg-destructive/10 text-destructive' : ''}
                            ${diagnostic.level === 'warning' ? 'bg-yellow-50 text-yellow-800' : ''}
                            ${diagnostic.level === 'success' ? 'bg-green-50 text-green-800' : ''}
                            ${diagnostic.level === 'info' ? 'bg-blue-50 text-blue-800' : ''}
                          `}
                        >
                          <span className="flex-1">{diagnostic.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Category-level diagnostics */}
          {categoryDiagnostics.length > 0 && (
            <div className="mt-4 space-y-2" role="status" aria-live="polite">
              {categoryDiagnostics
                .filter(d => !d.toolIds || d.toolIds.length === 0)
                .map(diagnostic => (
                  <div
                    key={diagnostic.id}
                    className={`
                      text-sm p-3 rounded-md
                      ${diagnostic.level === 'error' ? 'bg-destructive/10 text-destructive' : ''}
                      ${diagnostic.level === 'warning' ? 'bg-yellow-50 text-yellow-800' : ''}
                      ${diagnostic.level === 'success' ? 'bg-green-50 text-green-800' : ''}
                      ${diagnostic.level === 'info' ? 'bg-blue-50 text-blue-800' : ''}
                    `}
                  >
                    {diagnostic.message}
                  </div>
                ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
