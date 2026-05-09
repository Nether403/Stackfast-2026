import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Diagnostic } from '@/types/diagnostic';

export interface ScoreBreakdown {
  base: number;
  bonuses: Array<{ reason: string; weight: number; ruleId?: string; ruleVersion?: string }>;
  penalties: Array<{ reason: string; weight: number; ruleId?: string; ruleVersion?: string }>;
  total: number;
}

export interface CompatibilityScoreProps {
  score: number;
  breakdown: ScoreBreakdown;
  diagnostics?: Diagnostic[]; // Optional, for future use
}

/**
 * CompatibilityScore component displays the overall compatibility score with breakdown
 * 
 * Features:
 * - Visual meter with color coding (red <50, yellow 50-75, green >75)
 * - Expandable breakdown showing bonuses and penalties
 * - ARIA live region for score updates
 * - Rule provenance display
 */
export function CompatibilityScore({
  score,
  breakdown,
}: CompatibilityScoreProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine score color
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Compatibility Score</span>
          <Badge variant={scoreColor === 'red' ? 'destructive' : 'secondary'}>
            {scoreLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Score meter */}
        <div className="space-y-2">
          <div
            className="flex items-center justify-between"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="text-sm font-medium">Overall Score</span>
            <span className={`text-3xl font-bold ${getScoreTextColor(scoreColor)}`}>
              {score}
            </span>
          </div>

          {/* Visual meter */}
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getScoreBarColor(scoreColor)}`}
              style={{ width: `${score}%` }}
              role="progressbar"
              aria-valuenow={score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Compatibility score"
            />
          </div>

          {/* Score range labels */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* Expandable breakdown */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              aria-expanded={isExpanded}
              aria-controls="score-breakdown"
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                View Score Breakdown
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent id="score-breakdown" className="mt-4 space-y-4">
            {/* Base score */}
            <div className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Base Score</span>
                <span className="text-sm font-semibold">{breakdown.base}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Starting point for all stacks
              </p>
            </div>

            {/* Bonuses */}
            {breakdown.bonuses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-green-700">Bonuses</h4>
                  <span className="text-sm font-semibold text-green-700">
                    +{breakdown.bonuses.reduce((sum, b) => sum + b.weight, 0)}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {breakdown.bonuses.map((bonus, index) => (
                    <div
                      key={`bonus-${index}`}
                      className="p-3 bg-green-50 border border-green-200 rounded-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm flex-1">{bonus.reason}</span>
                        <span className="text-sm font-semibold text-green-700">
                          +{bonus.weight}
                        </span>
                      </div>
                      
                      {(bonus.ruleId || bonus.ruleVersion) && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          {bonus.ruleId && (
                            <span>Rule: {bonus.ruleId}</span>
                          )}
                          {bonus.ruleVersion && (
                            <span>v{bonus.ruleVersion}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Penalties */}
            {breakdown.penalties.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-red-700">Penalties</h4>
                  <span className="text-sm font-semibold text-red-700">
                    {breakdown.penalties.reduce((sum, p) => sum + p.weight, 0)}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {breakdown.penalties.map((penalty, index) => (
                    <div
                      key={`penalty-${index}`}
                      className="p-3 bg-red-50 border border-red-200 rounded-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm flex-1">{penalty.reason}</span>
                        <span className="text-sm font-semibold text-red-700">
                          {penalty.weight}
                        </span>
                      </div>
                      
                      {(penalty.ruleId || penalty.ruleVersion) && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          {penalty.ruleId && (
                            <span>Rule: {penalty.ruleId}</span>
                          )}
                          {penalty.ruleVersion && (
                            <span>v{penalty.ruleVersion}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final calculation */}
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Final Score</span>
                <span className="text-lg font-bold">{breakdown.total}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Clamped to range [0, 100]
              </p>
            </div>

            {/* Explanation */}
            <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
              <p className="font-medium mb-1">How scoring works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Base score: 50 (neutral starting point)</li>
                <li>Maximum bonus: +40</li>
                <li>Maximum penalty: -70</li>
                <li>Final score is clamped between 0 and 100</li>
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

/**
 * Get score color category
 */
function getScoreColor(score: number): 'red' | 'yellow' | 'green' {
  if (score < 50) return 'red';
  if (score < 75) return 'yellow';
  return 'green';
}

/**
 * Get score label
 */
function getScoreLabel(score: number): string {
  if (score < 50) return 'Needs Improvement';
  if (score < 75) return 'Good';
  return 'Excellent';
}

/**
 * Get text color class for score
 */
function getScoreTextColor(color: 'red' | 'yellow' | 'green'): string {
  switch (color) {
    case 'red':
      return 'text-red-600';
    case 'yellow':
      return 'text-yellow-600';
    case 'green':
      return 'text-green-600';
  }
}

/**
 * Get bar color class for score meter
 */
function getScoreBarColor(color: 'red' | 'yellow' | 'green'): string {
  switch (color) {
    case 'red':
      return 'bg-red-500';
    case 'yellow':
      return 'bg-yellow-500';
    case 'green':
      return 'bg-green-500';
  }
}
