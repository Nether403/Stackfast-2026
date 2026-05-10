import { useState } from "react";
import { useGenerateBlueprint } from "../hooks/useApi";
import { Loader2, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { BlueprintOutputCard } from "../components/BlueprintOutputCard";
import { Layout } from "../components/Layout";

export function BlueprintBuilder() {
  const [idea, setIdea] = useState("");
  const [constraints, setConstraints] = useState("");
  const { mutate: generateBlueprint, data: blueprint, isPending, error } = useGenerateBlueprint();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea) return;
    
    const constraintsArray = constraints
      .split('\n')
      .map(c => c.trim())
      .filter(Boolean);

    generateBlueprint({ 
      idea, 
      constraints: constraintsArray.length > 0 ? constraintsArray : undefined 
    });
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out max-w-4xl mx-auto">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Idea to Stack</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Describe your application idea, and we'll architect the perfect modern tech stack for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 md:p-8 rounded-2xl border border-border shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="idea" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              What are you building? <span className="text-destructive">*</span>
            </label>
            <textarea
              id="idea"
              placeholder="e.g., A real-time collaboration tool for designers with comments, version history, and a robust admin dashboard..."
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="constraints" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center justify-between">
              <span>Technical Constraints & Preferences</span>
              <span className="text-xs text-muted-foreground font-normal">Optional</span>
            </label>
            <textarea
              id="constraints"
              placeholder="e.g., Must use TypeScript, prefer serverless database, budget is <$50/mo..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Generation failed</p>
              <p className="opacity-90 mt-1">{error.message || "An unexpected error occurred. Please try again."}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!idea || isPending}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Architecting Stack...
              </>
            ) : (
              <>
                Generate Blueprint
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {blueprint && (
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <BlueprintOutputCard blueprint={blueprint} />
        </div>
      )}
    </div>
    </Layout>
  );
}
