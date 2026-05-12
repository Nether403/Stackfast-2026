import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { ScaffoldResponse } from "@stackfast/schemas";
import { useGenerateBlueprint, useGenerateScaffold } from "../hooks/useApi";
import { BlueprintOutputCard } from "../components/BlueprintOutputCard";
import { Layout } from "../components/Layout";
import { downloadArchive, generateArchive } from "../lib/archive-generator";

type WizardStep = "idea" | "constraints" | "results" | "export";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "constraints", label: "Constraints" },
  { id: "results", label: "Results" },
  { id: "export", label: "Export" },
];

type BudgetOption = "low" | "medium" | "high" | "enterprise";
type TimelineOption = "prototype" | "mvp" | "production";

export function BlueprintBuilder() {
  const [step, setStep] = useState<WizardStep>("idea");
  const [idea, setIdea] = useState("");
  const [constraints, setConstraints] = useState("");
  const [budget, setBudget] = useState<BudgetOption | "">("");
  const [timeline, setTimeline] = useState<TimelineOption | "">("");
  const [teamSize, setTeamSize] = useState("");
  const [projectName, setProjectName] = useState("stackfast-app");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const {
    mutate: generateBlueprint,
    data: blueprint,
    isPending: isGenerating,
    error: generateError,
    reset: resetBlueprint,
  } = useGenerateBlueprint();

  const {
    mutate: generateScaffold,
    data: scaffold,
    isPending: isScaffolding,
    error: scaffoldError,
    reset: resetScaffold,
  } = useGenerateScaffold();

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const canGoNext = useMemo(() => {
    if (step === "idea") return idea.trim().length > 0;
    if (step === "constraints") return true;
    if (step === "results") return !!blueprint;
    return false;
  }, [step, idea, blueprint]);

  const constraintsArray = useMemo(
    () =>
      constraints
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [constraints],
  );

  const handleBack = () => {
    const previous = STEPS[stepIndex - 1];
    if (previous) setStep(previous.id);
  };

  const handleGenerate = () => {
    if (!idea.trim()) return;
    const teamSizeValue = teamSize ? Number(teamSize) : undefined;
    generateBlueprint(
      {
        idea: idea.trim(),
        ...(constraintsArray.length > 0 ? { constraints: constraintsArray } : {}),
        ...(budget ? { budget } : {}),
        ...(timeline ? { timeline } : {}),
        ...(teamSizeValue && Number.isFinite(teamSizeValue)
          ? { teamSize: teamSizeValue }
          : {}),
      },
      {
        onSuccess: () => {
          setStep("results");
        },
      },
    );
  };

  const handleGenerateScaffold = () => {
    if (!blueprint) return;
    setDownloadError(null);
    generateScaffold(
      {
        toolIds: blueprint.recommendedStack.toolIds,
        projectName: projectName.trim() || "stackfast-app",
      },
      {
        onSuccess: () => {
          setStep("export");
        },
      },
    );
  };

  const handleDownload = async () => {
    if (!scaffold) return;
    setDownloadError(null);
    try {
      const blob = await generateArchive(scaffold.files, scaffold.format, projectName);
      downloadArchive(blob, `${projectName || "stackfast-app"}.${scaffold.format}`);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Failed to download archive.",
      );
    }
  };

  const handleStartOver = () => {
    resetBlueprint();
    resetScaffold();
    setStep("idea");
    setDownloadError(null);
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out max-w-4xl mx-auto">
        <header className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Idea to Stack</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Describe your application idea, refine the constraints, and export a ready-to-clone
            starter repo.
          </p>
        </header>

        <WizardProgress currentStep={step} />

        {step === "idea" && (
          <IdeaStep idea={idea} onIdeaChange={setIdea} />
        )}

        {step === "constraints" && (
          <ConstraintsStep
            constraints={constraints}
            onConstraintsChange={setConstraints}
            budget={budget}
            onBudgetChange={setBudget}
            timeline={timeline}
            onTimelineChange={setTimeline}
            teamSize={teamSize}
            onTeamSizeChange={setTeamSize}
            isGenerating={isGenerating}
            generateError={generateError ? errorMessage(generateError) : null}
          />
        )}

        {step === "results" && blueprint && (
          <div className="space-y-6">
            <BlueprintOutputCard blueprint={blueprint} />
          </div>
        )}

        {step === "export" && (
          <ExportStep
            projectName={projectName}
            onProjectNameChange={setProjectName}
            scaffold={scaffold ?? null}
            isScaffolding={isScaffolding}
            scaffoldError={scaffoldError ? errorMessage(scaffoldError) : null}
            downloadError={downloadError}
            onDownload={handleDownload}
            onRegenerate={handleGenerateScaffold}
          />
        )}

        <WizardControls
          step={step}
          stepIndex={stepIndex}
          canGoNext={canGoNext}
          isGenerating={isGenerating}
          isScaffolding={isScaffolding}
          onBack={handleBack}
          onNext={() => {
            if (step === "idea") setStep("constraints");
            else if (step === "constraints") handleGenerate();
            else if (step === "results") handleGenerateScaffold();
          }}
          onStartOver={handleStartOver}
        />
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

function WizardProgress({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav
      aria-label="Blueprint wizard progress"
      data-testid="wizard-progress"
      className="flex items-center justify-between gap-2 md:gap-4"
    >
      {STEPS.map((s, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold border transition-colors ${
                isCompleted
                  ? "bg-primary text-primary-foreground border-primary"
                  : isActive
                    ? "bg-primary/10 text-primary border-primary"
                    : "bg-muted text-muted-foreground border-border"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            <span
              className={`text-sm font-medium hidden sm:inline ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {index < STEPS.length - 1 && (
              <div
                className={`hidden md:block flex-1 h-px ${
                  isCompleted ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Step: idea
// ---------------------------------------------------------------------------

interface IdeaStepProps {
  idea: string;
  onIdeaChange: (value: string) => void;
}

function IdeaStep({ idea, onIdeaChange }: IdeaStepProps) {
  return (
    <section className="space-y-6 bg-card p-6 md:p-8 rounded-2xl border border-border shadow-lg relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
      <div className="space-y-2">
        <label htmlFor="idea" className="text-sm font-medium">
          What are you building? <span className="text-destructive">*</span>
        </label>
        <textarea
          id="idea"
          placeholder="e.g., A real-time collaboration tool for designers with comments, version history, and a robust admin dashboard..."
          className="flex min-h-[160px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          value={idea}
          onChange={(e) => onIdeaChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Two or three sentences is usually enough. The more specific the better.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step: constraints
// ---------------------------------------------------------------------------

interface ConstraintsStepProps {
  constraints: string;
  onConstraintsChange: (value: string) => void;
  budget: BudgetOption | "";
  onBudgetChange: (value: BudgetOption | "") => void;
  timeline: TimelineOption | "";
  onTimelineChange: (value: TimelineOption | "") => void;
  teamSize: string;
  onTeamSizeChange: (value: string) => void;
  isGenerating: boolean;
  generateError: string | null;
}

function ConstraintsStep({
  constraints,
  onConstraintsChange,
  budget,
  onBudgetChange,
  timeline,
  onTimelineChange,
  teamSize,
  onTeamSizeChange,
  isGenerating,
  generateError,
}: ConstraintsStepProps) {
  return (
    <section className="space-y-6 bg-card p-6 md:p-8 rounded-2xl border border-border shadow-lg relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
      <div className="space-y-2">
        <label htmlFor="constraints" className="text-sm font-medium flex items-center justify-between">
          <span>Technical constraints & preferences</span>
          <span className="text-xs text-muted-foreground font-normal">Optional</span>
        </label>
        <textarea
          id="constraints"
          placeholder="e.g., Must use TypeScript, prefer serverless database, team is already on Postgres..."
          className="flex min-h-[120px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          value={constraints}
          onChange={(e) => onConstraintsChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">One constraint per line.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="budget" className="text-sm font-medium">Budget</label>
          <select
            id="budget"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={budget}
            onChange={(e) => onBudgetChange(e.target.value as BudgetOption | "")}
          >
            <option value="">No preference</option>
            <option value="low">Low ($0-50/mo)</option>
            <option value="medium">Medium ($50-500/mo)</option>
            <option value="high">High ($500-5k/mo)</option>
            <option value="enterprise">Enterprise ($5k+/mo)</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="timeline" className="text-sm font-medium">Timeline</label>
          <select
            id="timeline"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={timeline}
            onChange={(e) => onTimelineChange(e.target.value as TimelineOption | "")}
          >
            <option value="">No preference</option>
            <option value="prototype">Prototype (days)</option>
            <option value="mvp">MVP (weeks)</option>
            <option value="production">Production (months)</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="teamSize" className="text-sm font-medium">Team size</label>
          <input
            id="teamSize"
            type="number"
            min={1}
            placeholder="e.g., 3"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={teamSize}
            onChange={(e) => onTeamSizeChange(e.target.value)}
          />
        </div>
      </div>

      {generateError && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Generation failed</p>
            <p className="opacity-90 mt-1">{generateError}</p>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Architecting stack...</span>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step: export
// ---------------------------------------------------------------------------

interface ExportStepProps {
  projectName: string;
  onProjectNameChange: (value: string) => void;
  scaffold: ScaffoldResponse | null;
  isScaffolding: boolean;
  scaffoldError: string | null;
  downloadError: string | null;
  onDownload: () => void;
  onRegenerate: () => void;
}

function ExportStep({
  projectName,
  onProjectNameChange,
  scaffold,
  isScaffolding,
  scaffoldError,
  downloadError,
  onDownload,
  onRegenerate,
}: ExportStepProps) {
  return (
    <section
      data-testid="wizard-export-step"
      className="space-y-6 bg-card p-6 md:p-8 rounded-2xl border border-border shadow-lg relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

      <div className="space-y-2">
        <label htmlFor="projectName" className="text-sm font-medium">Project name</label>
        <input
          id="projectName"
          type="text"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Used as the archive name and written into <code>package.json</code>.
        </p>
      </div>

      {isScaffolding && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating scaffold files...</span>
        </div>
      )}

      {scaffoldError && !isScaffolding && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-medium">Scaffold generation failed</p>
            <p className="opacity-90 mt-1">{scaffoldError}</p>
            <button
              type="button"
              onClick={onRegenerate}
              className="mt-3 inline-flex items-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {scaffold && !isScaffolding && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Files</span>
              <span className="font-medium">{scaffold.files.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Applied recipes</span>
              <span className="font-medium">{scaffold.log.appliedRecipes.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Generated</span>
              <span className="font-medium">
                {new Date(scaffold.meta.generatedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <details className="rounded-lg border bg-background/40 p-4" open>
            <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              File list
            </summary>
            <ul className="mt-3 max-h-56 overflow-y-auto space-y-1 text-sm font-mono">
              {scaffold.files.map((file) => (
                <li key={file.path} className="text-muted-foreground">
                  {file.path}
                </li>
              ))}
            </ul>
          </details>

          {scaffold.log.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
              <p className="font-medium mb-2">Warnings</p>
              <ul className="space-y-1 text-yellow-200/90">
                {scaffold.log.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {downloadError && (
            <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Download failed</p>
                <p className="opacity-90 mt-1">{downloadError}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 text-sm font-medium"
            >
              <Download className="mr-2 h-4 w-4" />
              Download {scaffold.format.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 text-sm font-medium"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

interface WizardControlsProps {
  step: WizardStep;
  stepIndex: number;
  canGoNext: boolean;
  isGenerating: boolean;
  isScaffolding: boolean;
  onBack: () => void;
  onNext: () => void;
  onStartOver: () => void;
}

function WizardControls({
  step,
  stepIndex,
  canGoNext,
  isGenerating,
  isScaffolding,
  onBack,
  onNext,
  onStartOver,
}: WizardControlsProps) {
  const nextLabel =
    step === "idea"
      ? "Next: Constraints"
      : step === "constraints"
        ? isGenerating
          ? "Generating..."
          : "Generate blueprint"
        : step === "results"
          ? isScaffolding
            ? "Generating..."
            : "Continue to export"
          : "";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={stepIndex === 0 || isGenerating || isScaffolding}
        className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </button>

      <div className="flex items-center gap-3">
        {step === "export" && (
          <button
            type="button"
            onClick={onStartOver}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 text-sm font-medium"
          >
            Start over
          </button>
        )}
        {step !== "export" && (
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext || isGenerating || isScaffolding}
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
          >
            {(isGenerating || isScaffolding) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {!isGenerating && !isScaffolding && (
              <>
                {nextLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
            {(isGenerating || isScaffolding) && <span>{nextLabel}</span>}
          </button>
        )}
      </div>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}
