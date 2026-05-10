import type { EnhancedAlternative } from "@stackfast/schemas";
import { useState } from "react";
import { ArrowRight, AlertCircle, Sparkles, Brain, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

interface AlternativesComparisonProps {
  alternatives: EnhancedAlternative[];
}

export function AlternativesComparison({ alternatives }: AlternativesComparisonProps) {
  const [expandedWhyNot, setExpandedWhyNot] = useState<string | null>(null);

  if (!alternatives || alternatives.length === 0) return null;

  const toggleWhyNot = (id: string) => {
    setExpandedWhyNot((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold tracking-tight">Alternative Options</h3>
      <p className="text-sm text-muted-foreground">Compare different approaches that also fit your requirements.</p>

      <div className="grid gap-6 md:grid-cols-2">
        {alternatives.map((alt) => (
          <div
            key={alt.id}
            className="flex flex-col p-6 rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-lg">{alt.name}</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {alt.toolIds.map((toolId) => (
                    <span
                      key={toolId}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground"
                    >
                      {toolId}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border border-border bg-background shadow-sm">
                <span className="text-xs font-medium text-muted-foreground">Score</span>
                <span className="font-bold text-sm leading-none">{alt.harmonyScore}</span>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-border space-y-4">
              {/* Tradeoffs with source badge */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Tradeoffs
                  <span
                    className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      alt.tradeoffSource === "ai"
                        ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {alt.tradeoffSource === "ai" ? (
                      <Sparkles className="w-2.5 h-2.5" />
                    ) : (
                      <Brain className="w-2.5 h-2.5" />
                    )}
                    {alt.tradeoffSource === "ai" ? "AI" : "Heuristic"}
                  </span>
                </p>
                <ul className="space-y-2">
                  {alt.tradeoffs.map((tradeoff, i) => (
                    <li key={i} className="text-sm flex items-start gap-2 text-muted-foreground">
                      <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                      <span className="leading-relaxed">{tradeoff}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Why Not? disclosure */}
              {alt.whyNot && (
                <div className="border-t border-dashed border-border pt-3">
                  <button
                    type="button"
                    onClick={() => toggleWhyNot(alt.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors w-full"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Why wasn't this recommended?
                    {expandedWhyNot === alt.id ? (
                      <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                    )}
                  </button>
                  {expandedWhyNot === alt.id && (
                    <div className="mt-2 p-3 rounded-lg bg-muted/50 text-sm space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-foreground/80">{alt.whyNot.reason}</p>
                      {alt.whyNot.betterFor && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Better for:</span> {alt.whyNot.betterFor}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
