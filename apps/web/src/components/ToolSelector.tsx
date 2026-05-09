import { ExternalLink, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Tool } from '@/types/tool';

export interface ToolSelectorProps {
  tool: Tool;
  isSelected: boolean;
  onSelect: (tool: Tool) => void;
  name: string; // Radio group name
}

/**
 * ToolSelector component displays a single tool option with detailed information
 * 
 * Features:
 * - Radio button for single-selection
 * - Tool name, description, and metadata
 * - Hover tooltip with additional details
 * - Pricing information with staleness indicator
 * - Documentation links
 */
export function ToolSelector({
  tool,
  isSelected,
  onSelect,
  name,
}: ToolSelectorProps) {
  // Check if pricing data is stale (>90 days)
  const isPricingStale = tool.pricing?.lastVerified 
    ? isDataStale(tool.pricing.lastVerified, 90)
    : false;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <label
            className={`
              flex items-start gap-3 p-4 rounded-md border cursor-pointer
              transition-all duration-200
              ${isSelected 
                ? 'border-primary bg-primary/5 shadow-sm' 
                : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }
            `}
          >
            <input
              type="radio"
              name={name}
              value={tool.id}
              checked={isSelected}
              onChange={() => onSelect(tool)}
              className="mt-1 h-4 w-4 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-describedby={`tool-${tool.id}-description`}
            />
            
            <div className="flex-1 min-w-0 space-y-2">
              {/* Tool name and badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-semibold text-base">{tool.name}</div>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tool.hosted && (
                      <Badge variant="secondary" className="text-xs">
                        Hosted
                      </Badge>
                    )}
                    {tool.selfHostable && (
                      <Badge variant="secondary" className="text-xs">
                        Self-hostable
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Documentation link */}
                {tool.docsUrl && (
                  <a
                    href={tool.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors"
                    aria-label={`View ${tool.name} documentation`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* Description */}
              <p
                id={`tool-${tool.id}-description`}
                className="text-sm text-muted-foreground leading-relaxed"
              >
                {tool.description}
              </p>

              {/* Pricing information */}
              {tool.pricing && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">
                    {tool.pricing.model === 'free' && 'Free'}
                    {tool.pricing.model === 'free-tier' && 'Free tier available'}
                    {tool.pricing.model === 'paid' && 'Paid'}
                  </span>
                  
                  {tool.pricing.note && (
                    <span className="text-muted-foreground">
                      • {tool.pricing.note}
                    </span>
                  )}

                  {tool.pricing.lastVerified && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      • Last verified: {formatDate(tool.pricing.lastVerified)}
                      {isPricingStale && (
                        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 ml-1">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          May be outdated
                        </Badge>
                      )}
                    </span>
                  )}

                  {tool.pricing.url && (
                    <a
                      href={tool.pricing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View pricing
                    </a>
                  )}
                </div>
              )}
            </div>
          </label>
        </TooltipTrigger>

        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-2">
            <div>
              <div className="font-semibold mb-1">Supported Languages</div>
              <div className="text-sm text-muted-foreground">
                {tool.languages.join(', ')}
              </div>
            </div>

            {tool.supports.runtime && tool.supports.runtime.length > 0 && (
              <div>
                <div className="font-semibold mb-1">Runtime</div>
                <div className="text-sm text-muted-foreground">
                  {tool.supports.runtime.join(', ')}
                </div>
              </div>
            )}

            {tool.supports.dbs && tool.supports.dbs.length > 0 && (
              <div>
                <div className="font-semibold mb-1">Databases</div>
                <div className="text-sm text-muted-foreground">
                  {tool.supports.dbs.join(', ')}
                </div>
              </div>
            )}

            {tool.supports.frameworks && tool.supports.frameworks.length > 0 && (
              <div>
                <div className="font-semibold mb-1">Frameworks</div>
                <div className="text-sm text-muted-foreground">
                  {tool.supports.frameworks.join(', ')}
                </div>
              </div>
            )}

            {tool.integrations.length > 0 && (
              <div>
                <div className="font-semibold mb-1">Known Integrations</div>
                <div className="text-sm text-muted-foreground">
                  {tool.integrations.length} integration{tool.integrations.length !== 1 ? 's' : ''} available
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Check if data is stale based on last verified date
 */
function isDataStale(lastVerified: string, daysThreshold: number): boolean {
  try {
    const lastVerifiedDate = new Date(lastVerified);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastVerifiedDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff > daysThreshold;
  } catch {
    return false;
  }
}

/**
 * Format ISO date string to readable format
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}
