import { Tool } from "@stackfast/schemas";
import { DollarSign, Check, Info } from "lucide-react";

interface CostEstimatorProps {
  tools: Tool[];
}

export function CostEstimator({ tools }: CostEstimatorProps) {
  const freeTools = tools.filter(t => !t.pricing || t.pricing.model === "free" || t.pricing.model === "free-tier");
  const paidTools = tools.filter(t => t.pricing?.model === "paid");

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        Estimated Cost Impact
      </h4>
      
      <div className="grid gap-4 md:grid-cols-2">
        {/* Free / Generous Free Tier */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-4 h-4 text-diagnostic-success" />
            <h5 className="font-medium text-sm">Free / Generous Tier</h5>
          </div>
          <div className="space-y-2">
            {freeTools.map(tool => (
              <div key={tool.id} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{tool.name}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">
                  {tool.pricing?.model === "free-tier" ? "Free Tier" : "Free"}
                </span>
              </div>
            ))}
            {freeTools.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No free tools in this stack.</p>
            )}
          </div>
        </div>

        {/* Paid / Commercial */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <h5 className="font-medium text-sm">Paid / Usage-based</h5>
          </div>
          <div className="space-y-2">
            {paidTools.map(tool => (
              <div key={tool.id} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{tool.name}</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                  Paid
                </span>
              </div>
            ))}
            {paidTools.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No required paid tools.</p>
            )}
          </div>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Note: Exact costs depend on traffic, usage volume, and selected tiers. Check individual tool pricing pages for accurate estimates.
      </p>
    </div>
  );
}
