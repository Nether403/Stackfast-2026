import type { EnhancedBlueprintResponse } from "@stackfast/schemas";
import {
  Check,
  Info,
  AlertTriangle,
  XCircle,
  Download,
  Server,
  Cpu,
  Database,
  Globe,
  Sparkles,
  Brain,
} from "lucide-react";
import { AlternativesComparison } from "./AlternativesComparison";
import { CostEstimator } from "./CostEstimator";
import { ArchitecturePreview } from "./ArchitecturePreview";
import { ImplementationRoadmap } from "./ImplementationRoadmap";

interface BlueprintOutputCardProps {
  blueprint: EnhancedBlueprintResponse;
}

export function BlueprintOutputCard({ blueprint }: BlueprintOutputCardProps) {
  const { recommendedStack, alternatives, costEstimate, roadmap, risks } = blueprint;

  const getToolIcon = (categoryId: string) => {
    switch (categoryId) {
      case "framework": return <Globe className="w-5 h-5" />;
      case "database": return <Database className="w-5 h-5" />;
      case "auth": return <Server className="w-5 h-5" />;
      default: return <Cpu className="w-5 h-5" />;
    }
  };

  const getDiagnosticIcon = (level: string) => {
    switch (level) {
      case "error": return <XCircle className="w-5 h-5 text-destructive" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-diagnostic-warning" />;
      case "info": return <Info className="w-5 h-5 text-diagnostic-info" />;
      case "success": return <Check className="w-5 h-5 text-diagnostic-success" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const isAi = recommendedStack.explanationSource === "ai";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Recommended Architecture</h2>
        <div className="flex items-center gap-3">
          {/* AI Source Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              isAi
                ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {isAi ? (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                AI-Powered
              </>
            ) : (
              <>
                <Brain className="w-3.5 h-3.5" />
                Heuristic
              </>
            )}
            {isAi && recommendedStack.confidence != null && (
              <span className="ml-1 opacity-70">
                ({Math.round(recommendedStack.confidence * 100)}%)
              </span>
            )}
          </div>

          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
            <Download className="mr-2 h-4 w-4" />
            Export Scaffold
          </button>
        </div>
      </div>

      {/* Primary Stack */}
      <div className="rounded-xl border border-primary/20 bg-card overflow-hidden shadow-lg shadow-primary/5">
        <div className="bg-primary/5 border-b border-primary/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              Primary Stack
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Optimal combination for your specific requirements.</p>
          </div>
          <div className="flex items-center gap-4 bg-background px-4 py-2 rounded-lg border border-border">
            <span className="text-sm font-medium text-muted-foreground">Harmony Score</span>
            <span className={`text-2xl font-bold ${
              recommendedStack.harmonyScore >= 80 ? "text-diagnostic-success" :
              recommendedStack.harmonyScore >= 50 ? "text-diagnostic-warning" : "text-destructive"
            }`}>
              {recommendedStack.harmonyScore}
            </span>
          </div>
        </div>

        <div className="p-6 grid gap-6 md:grid-cols-2">
          {/* Rationale */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Why this stack?</h4>
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
              {recommendedStack.rationale}
            </div>
            {/* Key Reasons (AI-powered) */}
            {recommendedStack.keyReasons && recommendedStack.keyReasons.length > 0 && (
              <div className="grid gap-2 mt-4">
                {recommendedStack.keyReasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                    <span className="leading-relaxed">{reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tools Grid */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Technologies</h4>
            <div className="grid grid-cols-1 gap-3">
              {recommendedStack.tools.map((tool) => (
                <div key={tool.id} className="flex items-start gap-4 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="p-2 rounded-md bg-background border border-border text-primary">
                    {getToolIcon(tool.categoryId)}
                  </div>
                  <div>
                    <h5 className="font-medium leading-none mb-1">{tool.name}</h5>
                    <p className="text-xs text-muted-foreground line-clamp-1">{tool.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostics */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Stack Analysis</h4>
            <div className="space-y-3">
              {recommendedStack.diagnostics.length > 0 ? (
                recommendedStack.diagnostics.map((diag, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="shrink-0 mt-0.5">{getDiagnosticIcon(diag.level)}</div>
                    <p className="leading-relaxed">{diag.message}</p>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-diagnostic-success/10 text-diagnostic-success text-sm border border-diagnostic-success/20">
                  <Check className="w-5 h-5 shrink-0" />
                  <p className="font-medium">Perfect harmony detected. No conflicts or warnings.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Risks */}
        {risks.length > 0 && (
          <div className="p-6 border-t border-destructive/10 bg-destructive/5">
            <h4 className="text-sm font-medium uppercase tracking-wider text-destructive/80 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Identified Risks
            </h4>
            <ul className="space-y-2">
              {risks.map((risk, i) => (
                <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive/60" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Additional Previews */}
        <div className="p-6 border-t border-primary/10 grid gap-6 md:grid-cols-2 bg-muted/5">
          <ArchitecturePreview tools={recommendedStack.tools} />
          <CostEstimator costEstimate={costEstimate} />
        </div>

        {/* Implementation Roadmap */}
        {roadmap && (
          <div className="p-6 border-t border-primary/10 bg-muted/5">
            <ImplementationRoadmap roadmap={roadmap} />
          </div>
        )}
      </div>

      {/* Alternatives */}
      <AlternativesComparison alternatives={alternatives} />
    </div>
  );
}
