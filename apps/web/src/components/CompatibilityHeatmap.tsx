import { useMemo, useState } from "react";
import type { Tool, Rule, CategoryId } from "@stackfast/schemas";
import { evaluateRulesSync } from "../engine";

export interface CompatibilityHeatmapProps {
  tools: Tool[];
  rules: Rule[];
  categories: { id: CategoryId; name: string }[];
}

interface HeatmapCell {
  rowTool: Tool;
  colTool: Tool;
  score: number;
  hasError: boolean;
  hasSynergy: boolean;
}

const DEFAULT_ROW: CategoryId = "frontend";
const DEFAULT_COL: CategoryId = "hosting";

export function CompatibilityHeatmap({ tools, rules, categories }: CompatibilityHeatmapProps) {
  const [rowCategory, setRowCategory] = useState<CategoryId>(DEFAULT_ROW);
  const [colCategory, setColCategory] = useState<CategoryId>(DEFAULT_COL);

  const rowTools = useMemo(
    () => tools.filter((tool) => tool.categoryId === rowCategory && !tool.deprecated),
    [tools, rowCategory],
  );
  const colTools = useMemo(
    () => tools.filter((tool) => tool.categoryId === colCategory && !tool.deprecated),
    [tools, colCategory],
  );

  const cells = useMemo<HeatmapCell[][]>(() => {
    return rowTools.map((rowTool) =>
      colTools.map((colTool): HeatmapCell => {
        if (rowTool.id === colTool.id) {
          return {
            rowTool,
            colTool,
            score: 100,
            hasError: false,
            hasSynergy: false,
          };
        }
        const evaluation = evaluateRulesSync([rowTool, colTool], rules);
        return {
          rowTool,
          colTool,
          score: Math.round(evaluation.score),
          hasError: evaluation.diagnostics.some((d) => d.level === "error"),
          hasSynergy: evaluation.diagnostics.some((d) => d.category === "synergy"),
        };
      }),
    );
  }, [rowTools, colTools, rules]);

  const hasData = rowTools.length > 0 && colTools.length > 0;

  return (
    <section
      data-testid="compatibility-heatmap"
      className="space-y-6 bg-card p-6 md:p-8 rounded-2xl border border-border shadow-sm"
    >
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Compatibility Matrix</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Pick two categories to see how every tool in one pairs with every tool in the other. Cells
          are color-coded by harmony score; red badges mark hard conflicts and green dots mark known
          synergies.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="heatmap-row" className="text-sm font-medium">Rows</label>
          <select
            id="heatmap-row"
            data-testid="heatmap-row-select"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={rowCategory}
            onChange={(e) => setRowCategory(e.target.value as CategoryId)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="heatmap-col" className="text-sm font-medium">Columns</label>
          <select
            id="heatmap-col"
            data-testid="heatmap-col-select"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={colCategory}
            onChange={(e) => setColCategory(e.target.value as CategoryId)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <HeatmapLegend />

      {!hasData ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No active tools found for the selected categories.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-collapse text-sm" data-testid="heatmap-table">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card p-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground" />
                {colTools.map((tool) => (
                  <th
                    key={tool.id}
                    className="p-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    scope="col"
                  >
                    <div
                      className="max-w-[8rem] truncate"
                      title={tool.name}
                    >
                      {tool.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.map((row, rowIndex) => {
                const rowTool = rowTools[rowIndex];
                return (
                  <tr key={rowTool.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card p-2 text-left text-xs font-medium text-foreground/90"
                    >
                      <div className="max-w-[10rem] truncate" title={rowTool.name}>
                        {rowTool.name}
                      </div>
                    </th>
                    {row.map((cell) => (
                      <HeatmapCellView
                        key={`${cell.rowTool.id}-${cell.colTool.id}`}
                        cell={cell}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HeatmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">Legend:</span>
      <LegendSwatch label="Excellent (80-100)" className="bg-emerald-500/30 border-emerald-400/60 text-emerald-200" />
      <LegendSwatch label="Good (60-79)" className="bg-lime-500/30 border-lime-400/50 text-lime-100" />
      <LegendSwatch label="Moderate (40-59)" className="bg-amber-500/30 border-amber-400/50 text-amber-100" />
      <LegendSwatch label="Weak (20-39)" className="bg-orange-500/30 border-orange-400/50 text-orange-100" />
      <LegendSwatch label="Conflict / 0-19" className="bg-destructive/30 border-destructive/50 text-destructive-foreground" />
    </div>
  );
}

function LegendSwatch({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-4 w-6 rounded-sm border ${className}`} />
      <span>{label}</span>
    </span>
  );
}

function HeatmapCellView({ cell }: { cell: HeatmapCell }) {
  const { score, hasError, hasSynergy, rowTool, colTool } = cell;
  const className = scoreToClass(score, hasError);
  const title =
    rowTool.id === colTool.id
      ? `${rowTool.name} (same tool)`
      : `${rowTool.name} × ${colTool.name} — score ${score}${hasError ? " (conflict)" : ""}${
          hasSynergy ? " (synergy)" : ""
        }`;

  return (
    <td
      className={`relative h-10 min-w-[4rem] p-0 text-center align-middle border border-border/60 ${className}`}
      title={title}
      data-score={score}
      data-conflict={hasError}
      data-synergy={hasSynergy}
    >
      <span className="text-xs font-semibold">{score}</span>
      {hasSynergy && !hasError && (
        <span
          aria-hidden
          className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400"
        />
      )}
      {hasError && (
        <span
          aria-hidden
          className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive"
        />
      )}
    </td>
  );
}

function scoreToClass(score: number, hasError: boolean): string {
  if (hasError) return "bg-destructive/30 text-destructive-foreground";
  if (score >= 80) return "bg-emerald-500/30 text-emerald-100";
  if (score >= 60) return "bg-lime-500/25 text-lime-100";
  if (score >= 40) return "bg-amber-500/25 text-amber-100";
  if (score >= 20) return "bg-orange-500/25 text-orange-100";
  return "bg-destructive/25 text-destructive-foreground";
}
