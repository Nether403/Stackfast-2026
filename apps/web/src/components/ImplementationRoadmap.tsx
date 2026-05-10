import type { ImplementationRoadmap as RoadmapType } from "@stackfast/schemas";
import { Clock, CheckCircle2, ArrowRight } from "lucide-react";

interface ImplementationRoadmapProps {
  roadmap: RoadmapType;
}

export function ImplementationRoadmap({ roadmap }: ImplementationRoadmapProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Implementation Roadmap
        </h4>
        <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
          Est. {roadmap.totalEstimate}
        </span>
      </div>

      <div className="relative">
        {/* Timeline connector line */}
        <div className="absolute left-[17px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />

        <div className="space-y-4">
          {roadmap.phases.map((phase, index) => (
            <div key={index} className="relative flex gap-4">
              {/* Phase indicator */}
              <div className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 border-primary/30 bg-background shrink-0">
                <span className="text-xs font-bold text-primary">{index + 1}</span>
              </div>

              {/* Phase content */}
              <div className="flex-1 p-4 rounded-xl border border-border bg-card/80 hover:bg-card transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-sm">{phase.name}</h5>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {phase.duration}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {phase.tasks.map((task, taskIndex) => (
                    <li key={taskIndex} className="text-sm flex items-start gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/50" />
                      <span className="leading-relaxed">{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
