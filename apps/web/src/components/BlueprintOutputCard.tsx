import { BlueprintResponse } from "@stackfast/schemas";
import { Check, Info, AlertTriangle, XCircle, ArrowRight, Download, Server, Cpu, Database, Globe } from "lucide-react";
import { AlternativesComparison } from "./AlternativesComparison";
import { CostEstimator } from "./CostEstimator";
import { ArchitecturePreview } from "./ArchitecturePreview";

interface BlueprintOutputCardProps {
  blueprint: BlueprintResponse;
}

export function BlueprintOutputCard({ blueprint }: BlueprintOutputCardProps) {
  const { primaryStack, alternatives, rationale } = blueprint;

  // Helper to categorize tools by type
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Recommended Architecture</h2>
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          <Download className="mr-2 h-4 w-4" />
          Export Scaffold
        </button>
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
              primaryStack.score >= 80 ? "text-diagnostic-success" :
              primaryStack.score >= 50 ? "text-diagnostic-warning" : "text-destructive"
            }`}>
              {primaryStack.score}
            </span>
          </div>
        </div>

        <div className="p-6 grid gap-6 md:grid-cols-2">
          {/* Rationale */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Why this stack?</h4>
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
              {rationale}
            </div>
          </div>

          {/* Tools Grid */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Technologies</h4>
            <div className="grid grid-cols-1 gap-3">
              {primaryStack.tools.map((tool) => (
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
              {primaryStack.diagnostics.length > 0 ? (
                primaryStack.diagnostics.map((diag, i) => (
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

        {/* Additional Previews */}
        <div className="p-6 border-t border-primary/10 grid gap-6 md:grid-cols-2 bg-muted/5">
          <ArchitecturePreview tools={primaryStack.tools} />
          <CostEstimator tools={primaryStack.tools} />
        </div>
      </div>

      {/* Alternatives */}
      <AlternativesComparison alternatives={alternatives} />
    </div>
  );
}
