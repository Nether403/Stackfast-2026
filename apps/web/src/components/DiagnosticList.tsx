import { AlertCircle, AlertTriangle, Info, CheckCircle, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Diagnostic } from '@/types/diagnostic';

export interface DiagnosticListProps {
  diagnostics: Diagnostic[];
  onFixIt?: (diagnostic: Diagnostic) => void;
}

/**
 * DiagnosticList component displays conflicts, synergies, requirements, and coverage diagnostics
 * 
 * Features:
 * - Display all diagnostic types
 * - "Fix it" button for requirement errors
 * - Color-coded by diagnostic level
 * - Rule provenance display (ruleId, ruleVersion)
 */
export function DiagnosticList({
  diagnostics,
  onFixIt,
}: DiagnosticListProps) {
  // Group diagnostics by category
  const conflicts = diagnostics.filter(d => d.category === 'conflict');
  const synergies = diagnostics.filter(d => d.category === 'synergy');
  const requirements = diagnostics.filter(d => d.category === 'requirement');
  const coverage = diagnostics.filter(d => d.category === 'coverage');

  // If no diagnostics, show empty state
  if (diagnostics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No diagnostics to display</p>
            <p className="text-sm mt-1">Select tools to see compatibility information</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Conflicts ({conflicts.length})
            </h4>
            <div className="space-y-2">
              {conflicts.map(diagnostic => (
                <DiagnosticItem
                  key={diagnostic.id}
                  diagnostic={diagnostic}
                  onFixIt={onFixIt}
                />
              ))}
            </div>
          </div>
        )}

        {/* Requirements */}
        {requirements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-yellow-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Requirements ({requirements.length})
            </h4>
            <div className="space-y-2">
              {requirements.map(diagnostic => (
                <DiagnosticItem
                  key={diagnostic.id}
                  diagnostic={diagnostic}
                  onFixIt={onFixIt}
                />
              ))}
            </div>
          </div>
        )}

        {/* Synergies */}
        {synergies.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Synergies ({synergies.length})
            </h4>
            <div className="space-y-2">
              {synergies.map(diagnostic => (
                <DiagnosticItem
                  key={diagnostic.id}
                  diagnostic={diagnostic}
                  onFixIt={onFixIt}
                />
              ))}
            </div>
          </div>
        )}

        {/* Coverage */}
        {coverage.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Coverage ({coverage.length})
            </h4>
            <div className="space-y-2">
              {coverage.map(diagnostic => (
                <DiagnosticItem
                  key={diagnostic.id}
                  diagnostic={diagnostic}
                  onFixIt={onFixIt}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Individual diagnostic item component
 */
function DiagnosticItem({
  diagnostic,
  onFixIt,
}: {
  diagnostic: Diagnostic;
  onFixIt?: (diagnostic: Diagnostic) => void;
}) {
  const showFixItButton = 
    diagnostic.level === 'error' && 
    diagnostic.category === 'requirement' &&
    diagnostic.cta &&
    onFixIt;

  return (
    <div
      className={`
        p-3 rounded-md border
        ${getLevelStyles(diagnostic.level)}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Message */}
          <div className="flex items-start gap-2">
            {getLevelIcon(diagnostic.level)}
            <p className="text-sm flex-1">{diagnostic.message}</p>
          </div>

          {/* Rule provenance */}
          {(diagnostic.ruleId || diagnostic.ruleVersion) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
              {diagnostic.ruleId && (
                <Badge variant="outline" className="text-xs">
                  {diagnostic.ruleId}
                </Badge>
              )}
              {diagnostic.ruleVersion && (
                <span>v{diagnostic.ruleVersion}</span>
              )}
            </div>
          )}

          {/* Weight display (for transparency) */}
          {diagnostic.weight !== undefined && diagnostic.weight !== 0 && (
            <div className="text-xs text-muted-foreground ml-6">
              Score impact: {diagnostic.weight > 0 ? '+' : ''}{diagnostic.weight}
            </div>
          )}
        </div>

        {/* Fix it button */}
        {showFixItButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onFixIt(diagnostic)}
            className="flex-shrink-0 gap-2"
            aria-label={`Fix requirement: ${diagnostic.message}`}
          >
            <Wrench className="h-4 w-4" />
            Fix it
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Get icon for diagnostic level
 */
function getLevelIcon(level: 'error' | 'warning' | 'info' | 'success') {
  switch (level) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />;
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />;
  }
}

/**
 * Get styling classes for diagnostic level
 */
function getLevelStyles(level: 'error' | 'warning' | 'info' | 'success'): string {
  switch (level) {
    case 'error':
      return 'bg-red-50 border-red-200 text-red-900';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200 text-yellow-900';
    case 'success':
      return 'bg-green-50 border-green-200 text-green-900';
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-900';
  }
}
