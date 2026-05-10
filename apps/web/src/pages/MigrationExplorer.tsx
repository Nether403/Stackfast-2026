import { useState } from "react";
import { useMigrationPath, useTools } from "../hooks/useApi";
import { Loader2, ArrowRight, Gauge, Clock, GitCommit, Search } from "lucide-react";
import { Layout } from "../components/Layout";

export function MigrationExplorer() {
  const [sourceTool, setSourceTool] = useState("");
  const [targetTool, setTargetTool] = useState("");
  
  const { data: toolsData } = useTools({ limit: 100 });
  const { data: migration, isLoading, error } = useMigrationPath(sourceTool, targetTool);

  const tools = toolsData?.items || [];
  
  // Group tools by category to make selection easier
  const categories = Array.from(new Set(tools.map(t => t.categoryId)));
  
  // Find currently selected tools to ensure they match categories
  const sourceCategory = tools.find(t => t.id === sourceTool)?.categoryId;
  const targetCategory = tools.find(t => t.id === targetTool)?.categoryId;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Migration Explorer</h1>
        <p className="text-xl text-muted-foreground">
          Plan your technology transitions. Select your current tool and where you want to go.
        </p>
      </div>

      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Current Stack Component</label>
              <select 
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={sourceTool}
                onChange={(e) => {
                  setSourceTool(e.target.value);
                  // If switching to a new category, reset target to avoid invalid migrations
                  const newCat = tools.find(t => t.id === e.target.value)?.categoryId;
                  if (targetCategory && newCat !== targetCategory) {
                    setTargetTool("");
                  }
                }}
              >
                <option value="">Select current tool...</option>
                {categories.map(cat => (
                  <optgroup key={cat} label={cat.toUpperCase()}>
                    {tools.filter(t => t.categoryId === cat).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            
            {sourceTool && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border/50 text-sm flex gap-3">
                <Search className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-muted-foreground line-clamp-2">
                  {tools.find(t => t.id === sourceTool)?.description}
                </p>
              </div>
            )}
          </div>

          <div className="hidden md:flex flex-col items-center justify-center pt-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <ArrowRight className="w-6 h-6" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Target Technology</label>
              <select 
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={targetTool}
                onChange={(e) => setTargetTool(e.target.value)}
                disabled={!sourceTool}
              >
                <option value="">Select destination...</option>
                {/* Only show tools in the same category as the source tool */}
                {tools
                  .filter(t => t.categoryId === sourceCategory && t.id !== sourceTool)
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))
                }
              </select>
            </div>

            {targetTool && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 text-sm flex gap-3">
                <Search className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-foreground/80 line-clamp-2">
                  {tools.find(t => t.id === targetTool)?.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {sourceTool && targetTool && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Generating migration path...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
              No direct migration path found between these tools. They may require an intermediate step or manual rebuild.
            </div>
          ) : migration ? (
            <div className="space-y-6">
              {/* Migration Meta */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Complexity</p>
                    <p className="text-xl font-bold capitalize">{migration.complexity}</p>
                  </div>
                </div>
                
                <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Est. Time</p>
                    <p className="text-xl font-bold">{migration.estimatedTime}</p>
                  </div>
                </div>
              </div>

              {/* Migration Steps */}
              <div className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-sm">
                <h3 className="text-xl font-semibold mb-6">Migration Strategy</h3>
                
                <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {migration.steps.map((step, i) => (
                    <div key={i} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group">
                      {/* Icon */}
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 transition-all shadow-sm z-10 shrink-0 md:order-1 md:group-odd:-ml-5 md:group-even:-mr-5">
                        <span className="font-bold text-sm">{i + 1}</span>
                      </div>
                      
                      {/* Content */}
                      <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-background shadow-sm group-hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <GitCommit className="w-4 h-4 text-primary" />
                          <h4 className="font-medium">Phase {i + 1}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {step}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
    </Layout>
  );
}
