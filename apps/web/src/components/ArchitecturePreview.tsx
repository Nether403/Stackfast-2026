import { Tool } from "@stackfast/schemas";
import { Server, Database, Globe, Cpu, ArrowDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ArchitecturePreviewProps {
  tools: Tool[];
}

export function ArchitecturePreview({ tools }: ArchitecturePreviewProps) {
  // Organize tools by loose logical tiers based on categoryId
  const getTier = (tool: Tool) => {
    if (["frontend", "styling"].includes(tool.categoryId)) return "presentation";
    if (["runtime", "hosting"].includes(tool.categoryId)) return "infrastructure";
    if (["database", "storage", "orm"].includes(tool.categoryId)) return "data";
    return "services";
  };

  const tiers = {
    presentation: tools.filter(t => getTier(t) === "presentation"),
    infrastructure: tools.filter(t => getTier(t) === "infrastructure"),
    services: tools.filter(t => getTier(t) === "services"),
    data: tools.filter(t => getTier(t) === "data"),
  };

  const TierBlock = ({ title, icon: Icon, items }: { title: string, icon: LucideIcon, items: Tool[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="p-4 rounded-xl border border-border bg-card/50 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {items.map(t => (
            <div key={t.id} className="px-3 py-1.5 bg-background border border-border rounded-md text-sm font-medium shadow-sm">
              {t.name}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Architecture Topology
      </h4>
      <div className="relative p-6 rounded-xl border border-border bg-muted/20 flex flex-col items-center gap-2">
        <TierBlock title="Presentation Layer" icon={Globe} items={tiers.presentation} />
        
        {tiers.presentation.length > 0 && (tiers.infrastructure.length > 0 || tiers.services.length > 0) && (
          <ArrowDown className="w-4 h-4 text-muted-foreground opacity-50" />
        )}

        <TierBlock title="Infrastructure / Hosting" icon={Server} items={tiers.infrastructure} />

        {tiers.infrastructure.length > 0 && tiers.services.length > 0 && (
          <ArrowDown className="w-4 h-4 text-muted-foreground opacity-50" />
        )}

        <TierBlock title="API & Services" icon={Cpu} items={tiers.services} />

        {(tiers.services.length > 0 || tiers.infrastructure.length > 0) && tiers.data.length > 0 && (
          <ArrowDown className="w-4 h-4 text-muted-foreground opacity-50" />
        )}

        <TierBlock title="Data Layer" icon={Database} items={tiers.data} />
      </div>
    </div>
  );
}
