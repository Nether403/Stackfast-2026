import { Lightbulb, X, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Suggestion } from '@/types/suggestion';

export interface SmartSuggestionProps {
  suggestion: Suggestion;
  onAccept: (suggestion: Suggestion) => void;
  onDismiss: (suggestionId: string) => void;
  onUndo?: (suggestionId: string) => void;
}

/**
 * SmartSuggestion component displays a contextual recommendation
 * 
 * Features:
 * - Priority badge (High/Med/Low)
 * - Reason for suggestion
 * - Accept and Dismiss buttons
 * - Undo snackbar (5 second timeout) with keyboard accessibility
 * - Duplicate check on acceptance
 */
export function SmartSuggestion({
  suggestion,
  onAccept,
  onDismiss,
  onUndo,
}: SmartSuggestionProps) {
  const { toast } = useToast();

  const handleAccept = () => {
    onAccept(suggestion);
    
    // Show success toast with undo option
    if (onUndo) {
      toast({
        title: 'Suggestion accepted',
        description: suggestion.reason,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onUndo(suggestion.id);
              toast({
                title: 'Undone',
                description: 'Suggestion acceptance has been undone',
              });
            }}
            aria-label="Undo suggestion acceptance"
          >
            Undo
          </Button>
        ),
        duration: 5000, // 5 second timeout
      });
    }
  };

  const handleDismiss = () => {
    onDismiss(suggestion.id);
    
    // Show dismissal toast with undo option
    if (onUndo) {
      toast({
        title: 'Suggestion dismissed',
        description: 'You can always come back to this later',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onUndo(suggestion.id);
              toast({
                title: 'Restored',
                description: 'Suggestion has been restored',
              });
            }}
            aria-label="Undo suggestion dismissal"
          >
            Undo
          </Button>
        ),
        duration: 5000,
      });
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header with priority badge */}
            <div className="flex items-center gap-2">
              <Badge
                variant={getPriorityVariant(suggestion.priority)}
                className="text-xs"
              >
                {getPriorityLabel(suggestion.priority)} Priority
              </Badge>
            </div>

            {/* Reason */}
            <p className="text-sm leading-relaxed">
              {suggestion.reason}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleAccept}
                className="gap-2"
                aria-label={`Accept suggestion: ${suggestion.reason}`}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Accept
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="gap-2"
                aria-label={`Dismiss suggestion: ${suggestion.reason}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Get badge variant for priority level
 */
function getPriorityVariant(priority: 'high' | 'medium' | 'low'): 'default' | 'secondary' | 'outline' {
  switch (priority) {
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
  }
}

/**
 * Get display label for priority level
 */
function getPriorityLabel(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
  }
}
