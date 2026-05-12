import { describe, expect, it, vi, afterEach } from "vitest";
import type { Tool } from "@stackfast/schemas";
import { createExplainer } from "./index.js";

// ---------------------------------------------------------------------------
// createExplainer factory behavior
// ---------------------------------------------------------------------------
//
// These tests exercise the branches that don't require a live AI endpoint:
// - default fallback to heuristic
// - missing-config fallback for each AI provider
// - heuristic output shape
//
// Live provider calls are exercised separately with real keys — not here.
// ---------------------------------------------------------------------------

const sampleTools: Tool[] = [
  {
    id: "nextjs",
    name: "Next.js",
    description: "React framework for production.",
    categoryId: "frontend",
    tags: ["react", "ssr"],
    capabilities: ["ssr", "ssg"],
    languages: ["TypeScript", "JavaScript"],
    integrations: [],
    supports: { frameworks: [] },
    confidence: 0.95,
    selfHostable: false,
    homepageUrl: "https://nextjs.org",
    docsUrl: "https://nextjs.org/docs",
    sourceUrls: ["https://nextjs.org"],
    lastVerified: "2026-01-01",
    pricing: { model: "free", note: "Open source." },
    deprecated: false,
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createExplainer", () => {
  it("defaults to the heuristic explainer when no config is provided", async () => {
    const explainer = createExplainer();
    const result = await explainer.explainStack(sampleTools, "A simple blog");

    expect(result.source).toBe("heuristic");
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("falls back to heuristic for gemini when no apiKey is provided", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const explainer = createExplainer({ provider: "gemini" });
    const result = await explainer.explainStack(sampleTools, "A simple blog");

    expect(result.source).toBe("heuristic");
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to heuristic for azure-openai when resourceName is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const explainer = createExplainer({
      provider: "azure-openai",
      apiKey: "fake-key",
      model: "gpt-5.5",
    });
    const result = await explainer.explainStack(sampleTools, "A simple blog");

    expect(result.source).toBe("heuristic");
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to heuristic for azure-openai when model (deployment) is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const explainer = createExplainer({
      provider: "azure-openai",
      apiKey: "fake-key",
      azureResourceName: "resource",
    });
    const result = await explainer.explainStack(sampleTools, "A simple blog");

    expect(result.source).toBe("heuristic");
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to heuristic for an unknown provider", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const explainer = createExplainer({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provider: "totally-made-up" as any,
    });
    const result = await explainer.explainStack(sampleTools, "A simple blog");

    expect(result.source).toBe("heuristic");
    expect(warn).toHaveBeenCalled();
  });

  it("produces a valid roadmap from the heuristic path", async () => {
    const explainer = createExplainer();
    const { roadmap, source } = await explainer.generateRoadmap(sampleTools, "A simple blog");

    expect(source).toBe("heuristic");
    expect(roadmap.phases.length).toBeGreaterThanOrEqual(2);
    expect(roadmap.phases.length).toBeLessThanOrEqual(5);
    expect(roadmap.totalEstimate).toBeTruthy();
  });
});
