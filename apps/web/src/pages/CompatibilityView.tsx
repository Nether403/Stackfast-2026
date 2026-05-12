import { useState } from "react";
import { useCatalog, useCompatibility, useTools } from "../hooks/useApi";
import {
  ArrowRightLeft,
  CheckCircle2,
  Grid3x3,
  Info,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { CompatibilityHeatmap } from "../components/CompatibilityHeatmap";

type Mode = "pairwise" | "matrix";

export function CompatibilityView() {
  const [mode, setMode] = useState<Mode>("pairwise");

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out max-w-6xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Compatibility Analyzer</h1>
          <p className="text-xl text-muted-foreground">
            Inspect how two tools pair together, or survey an entire category pairing at a glance.
          </p>
        </div>

        <ModeTabs mode={mode} onModeChange={setMode} />

        {mode === "pairwise" ? <PairwiseAnalyzer /> : <MatrixAnalyzer />}
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Mode switcher
// ---------------------------------------------------------------------------

function ModeTabs({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) {
  const tabs: { id: Mode; label: string; icon: typeof ArrowRightLeft }[] = [
    { id: "pairwise", label: "Pairwise", icon: ArrowRightLeft },
    { id: "matrix", label: "Matrix", icon: Grid3x3 },
  ];

  return (
    <nav
      role="tablist"
      aria-label="Compatibility view mode"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1"
    >
      {tabs.map((tab) => {
        const isActive = mode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`compat-tab-${tab.id}`}
            onClick={() => onModeChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Pairwise analyzer (unchanged behavior)
// ---------------------------------------------------------------------------

function PairwiseAnalyzer() {
  const [toolA, setToolA] = useState("");
  const [toolB, setToolB] = useState("");
  const { data: toolsData } = useTools({ limit: 100 });
  const { data: compatibility, isLoading, error } = useCompatibility(toolA, toolB);

  const tools = toolsData?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center p-6 bg-card border border-border rounded-2xl shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium">First Tool</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={toolA}
            onChange={(e) => setToolA(e.target.value)}
          >
            <option value="">Select a tool...</option>
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden md:flex items-center justify-center pt-6">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Second Tool</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={toolB}
            onChange={(e) => setToolB(e.target.value)}
          >
            <option value="">Select a tool...</option>
            {tools.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === toolA}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {toolA && toolB && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Analyzing integration patterns...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
              Failed to analyze compatibility. Please try again.
            </div>
          ) : compatibility ? (
            <PairwiseResult compatibility={compatibility} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function PairwiseResult({
  compatibility,
}: {
  compatibility: {
    harmonyScore: number;
    diagnostics: { level: string; message: string }[];
  };
}) {
  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-8">
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-card border border-border text-center space-y-4 shadow-sm relative overflow-hidden">
        <div
          className={`absolute top-0 w-full h-2 ${
            compatibility.harmonyScore >= 80
              ? "bg-diagnostic-success"
              : compatibility.harmonyScore >= 50
                ? "bg-diagnostic-warning"
                : "bg-destructive"
          }`}
        />
        <h3 className="text-lg font-medium text-muted-foreground">Harmony Score</h3>
        <div
          className={`text-7xl font-bold tracking-tighter ${
            compatibility.harmonyScore >= 80
              ? "text-diagnostic-success"
              : compatibility.harmonyScore >= 50
                ? "text-diagnostic-warning"
                : "text-destructive"
          }`}
        >
          {compatibility.harmonyScore}
        </div>
        <div className="text-sm text-muted-foreground max-w-[200px]">
          {compatibility.harmonyScore >= 80
            ? "Excellent compatibility. These tools are often used together."
            : compatibility.harmonyScore >= 50
              ? "Moderate compatibility. May require custom configuration."
              : "Poor compatibility. Significant friction expected."}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Integration Analysis</h3>
        <div className="space-y-3">
          {compatibility.diagnostics.length > 0 ? (
            compatibility.diagnostics.map((diag, i) => (
              <div
                key={i}
                className="flex gap-4 p-4 rounded-xl bg-card border border-border shadow-sm"
              >
                <div className="shrink-0 mt-0.5">{diagnosticIcon(diag.level)}</div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    {diag.level}
                  </p>
                  <p className="text-foreground/90 leading-relaxed">{diag.message}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 p-6 rounded-xl bg-diagnostic-success/10 text-diagnostic-success border border-diagnostic-success/20">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <p className="font-medium text-lg">
                No significant issues detected when combining these tools.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function diagnosticIcon(level: string) {
  switch (level) {
    case "error":
      return <ShieldAlert className="w-5 h-5 text-destructive" />;
    case "warning":
      return <ShieldAlert className="w-5 h-5 text-diagnostic-warning" />;
    case "info":
      return <Info className="w-5 h-5 text-diagnostic-info" />;
    case "success":
      return <CheckCircle2 className="w-5 h-5 text-diagnostic-success" />;
    default:
      return <Info className="w-5 h-5" />;
  }
}

// ---------------------------------------------------------------------------
// Matrix analyzer (new)
// ---------------------------------------------------------------------------

function MatrixAnalyzer() {
  const { data: catalog, isLoading, error } = useCatalog();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading catalog...</p>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
        Failed to load the catalog. Please try refreshing.
      </div>
    );
  }

  return (
    <CompatibilityHeatmap
      tools={catalog.tools}
      rules={catalog.rules}
      categories={catalog.categories}
    />
  );
}
