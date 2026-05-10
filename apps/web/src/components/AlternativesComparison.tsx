import { BlueprintAlternative } from "@stackfast/schemas";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

interface AlternativesComparisonProps {
  alternatives: BlueprintAlternative[];
}

export function AlternativesComparison({ alternatives }: AlternativesComparisonProps) {
  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold tracking-tight">Alternative Options</h3>
      <p className="text-sm text-muted-foreground">Compare different approaches that also fit your requirements.</p>
      
      <div className="grid gap-6 md:grid-cols-2">
        {alternatives.map((alt) => (
          <div key={alt.id} className="flex flex-col p-6 rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-lg">{alt.name}</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {alt.tools.map(t => (
                    <span key={t.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border border-border bg-background shadow-sm">
                <span className="text-xs font-medium text-muted-foreground">Score</span>
                <span className="font-bold text-sm leading-none">{alt.score}</span>
              </div>
            </div>
            
            <div className="mt-auto pt-6 border-t border-border space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Tradeoffs
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
