import type { BlueprintCostEstimate } from "@stackfast/schemas";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

interface CostEstimatorProps {
  /** Structured cost estimate from the API (Phase 5). */
  costEstimate: BlueprintCostEstimate;
}

export function CostEstimator({ costEstimate }: CostEstimatorProps) {
  const freeItems = costEstimate.items.filter(
    (item) => item.pricingModel === "free" || item.pricingModel === "free-tier",
  );
  const paidItems = costEstimate.items.filter((item) => item.pricingModel === "paid");

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        Estimated Cost Impact
      </h4>

      {/* Monthly / Annual Summary */}
      <div className="flex gap-4">
        <div className="flex-1 p-4 rounded-xl border border-primary/20 bg-primary/5 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly</p>
          <p className="text-2xl font-bold text-primary mt-1">
            ${costEstimate.totalMonthlyEstimate.toLocaleString()}
          </p>
        </div>
        <div className="flex-1 p-4 rounded-xl border border-border bg-card text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Annual</p>
          <p className="text-2xl font-bold text-foreground/90 mt-1">
            ${costEstimate.totalAnnualEstimate.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Free / Generous Free Tier */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-diagnostic-success" />
            <h5 className="font-medium text-sm">Free / Generous Tier</h5>
            <span className="ml-auto text-xs bg-diagnostic-success/10 text-diagnostic-success px-2 py-0.5 rounded-full font-medium">
              {freeItems.length} tool{freeItems.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {freeItems.map((item) => (
              <div key={item.toolId} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{item.toolName}</span>
                <div className="flex items-center gap-2">
                  {item.note && (
                    <span className="text-[10px] text-muted-foreground/70 max-w-[120px] truncate" title={item.note}>
                      {item.note}
                    </span>
                  )}
                  <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">
                    {item.pricingModel === "free-tier" ? "Free Tier" : "Free"}
                  </span>
                </div>
              </div>
            ))}
            {freeItems.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No free tools in this stack.</p>
            )}
          </div>
        </div>

        {/* Paid / Commercial */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h5 className="font-medium text-sm">Paid / Usage-based</h5>
            <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {paidItems.length} tool{paidItems.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {paidItems.map((item) => (
              <div key={item.toolId} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{item.toolName}</span>
                <div className="flex items-center gap-2">
                  {item.estimatedMonthlyCost != null && (
                    <span className="text-xs font-semibold text-foreground">
                      ~${item.estimatedMonthlyCost}/mo
                    </span>
                  )}
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                    Paid
                  </span>
                </div>
              </div>
            ))}
            {paidItems.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No required paid tools.</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Note: Estimates are based on typical indie/startup usage. Exact costs depend on traffic, usage volume, and selected tiers.
      </p>
    </div>
  );
}
