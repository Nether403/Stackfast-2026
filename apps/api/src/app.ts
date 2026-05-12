import { createExplainer, estimateCosts } from "@stackfast/ai";
import { generateExport, type ExportError } from "@stackfast/exporter";
import { CatalogLoader } from "@stackfast/registry";
import { evaluateRulesSync } from "@stackfast/rules-engine";
import {
  BlueprintRequestSchema,
  ScaffoldRequestSchema,
  StackAnalyzeRequestSchema,
  type CategoryId,
  type Diagnostic,
  type Tool,
} from "@stackfast/schemas";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { MiddlewareHandler } from "hono/types";
import { z } from "zod";
import { openApiDocument } from "./openapi.js";
import { getAuth, requireSession, optionalSession } from "./middleware/auth.js";

type Bindings = {
  ADMIN_API_KEY?: string;
  NODE_ENV?: string;
};

type Variables = {
  requestId: string;
};

const ToolSearchQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  capabilities: z.string().optional(),
  pricing: z.enum(["free", "free-tier", "paid"]).optional(),
  sort: z.enum(["name", "category", "confidence"]).default("name"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const MigrationParamsSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const ImportToolsSchema = z.object({
  tools: z.array(z.unknown()).min(1),
});

const EnrichToolSchema = z.object({
  toolId: z.string().min(1),
  force: z.boolean().optional(),
});

const GENERATION_LIMIT = 30;
const READ_LIMIT = 100;
const WINDOW_MS = 60_000;
export const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const catalogLoader = new CatalogLoader();
const configuredCorsOrigin = process.env.CORS_ORIGIN ?? process.env.WEB_ORIGIN ?? "http://localhost:5173";

// Initialize AI explainer from env config (defaults to heuristic if no key)
const aiProvider = (process.env.AI_PROVIDER ?? "heuristic") as "gemini" | "openai" | "heuristic";
const explainer = createExplainer({
  provider: aiProvider,
  apiKey:
    aiProvider === "gemini" ? process.env.GEMINI_API_KEY :
    aiProvider === "openai" ? process.env.OPENAI_API_KEY :
    undefined,
  model: process.env.AI_MODEL || undefined,
  maxTokens: process.env.AI_MAX_TOKENS ? Number(process.env.AI_MAX_TOKENS) : undefined,
  timeoutMs: process.env.AI_TIMEOUT_MS ? Number(process.env.AI_TIMEOUT_MS) : undefined,
});

export const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", logger());
app.use("*", cors({
  origin: configuredCorsOrigin,
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization", "X-Admin-API-Key", "X-Request-ID", "X-AI-Provider"],
}));
app.use("*", async (c, next) => {
  const requestId = c.req.header("X-Request-ID") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});

// --- Rate limiting ---
app.use("/api/v1/blueprints", rateLimit("generation", GENERATION_LIMIT));
app.use("/api/v1/scaffolds", rateLimit("generation", GENERATION_LIMIT));
app.use("/api/v1/*", rateLimit("read", READ_LIMIT));

// --- Auth middleware ---
app.use("/api/v1/blueprints", requireSession());
app.use("/api/v1/scaffolds", requireSession());
app.use("/api/v1/*", optionalSession());
app.use("/admin/*", requireAdminApiKey());
app.use("/internal/*", requireAdminApiKey());

app.onError((error, c) => {
  const status = "status" in error && typeof error.status === "number" ? error.status : 500;
  return c.json(
    {
      error: status === 500 ? "Internal server error" : error.message,
      requestId: c.get("requestId"),
    },
    status as ContentfulStatusCode,
  );
});

app.get("/health", (c) => c.text("OK"));
app.get("/openapi.json", (c) => c.json(openApiDocument));

// --- Better Auth route handler ---
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const auth = getAuth();
  if (!auth) {
    return c.json({ error: "Auth not available (no database)", requestId: c.get("requestId") }, 503);
  }
  return auth.handler(c.req.raw);
});

app.post("/api/v1/blueprints", async (c) => {
  const body = await parseJson(c.req.raw, BlueprintRequestSchema);
  const primaryToolIds = chooseBlueprintTools(body.idea, body.preferredTools ?? [], body.constraints ?? []);
  const primaryTools = resolveTools(primaryToolIds);
  const primaryEvaluation = evaluateRulesSync(primaryTools, catalogLoader.getRules());
  const primaryExport = await generateSafeExport(primaryTools, primaryEvaluation.diagnostics, "blueprint-app");

  // AI explainer — uses configured provider with automatic heuristic fallback.
  // explainStack, generateRoadmap, per-alternative tradeoffs and whyNot are
  // all issued in parallel so a blueprint request does not fan out serially.
  const [explanation, roadmapResult] = await Promise.all([
    explainer.explainStack(primaryTools, body.idea),
    explainer.generateRoadmap(primaryTools, body.idea),
  ]);

  // Static cost estimation from registry pricing data
  const costEstimate = estimateCosts(primaryTools);

  const alternatives = await Promise.all(
    buildAlternatives(primaryToolIds).map(async (toolIds) => {
      const tools = resolveTools(toolIds);
      const evaluation = evaluateRulesSync(tools, catalogLoader.getRules());
      const [tradeoffResult, whyNotResult] = await Promise.all([
        explainer.summarizeTradeoffs(tools, evaluation.diagnostics),
        explainer.explainWhyNot(primaryTools, tools, body.idea),
      ]);
      return {
        id: toolIds.join("-"),
        name: tools.map((tool) => tool.name).join(" + "),
        toolIds,
        harmonyScore: evaluation.score,
        tradeoffs: tradeoffResult.tradeoffs,
        tradeoffSource: tradeoffResult.source,
        whyNot: whyNotResult.whyNot,
      };
    }),
  );

  return c.json({
    idea: body.idea,
    recommendedStack: {
      toolIds: primaryToolIds,
      tools: primaryTools,
      harmonyScore: primaryEvaluation.score,
      diagnostics: primaryEvaluation.diagnostics,
      rationale: explanation.text,
      explanationSource: explanation.source,
      keyReasons: explanation.keyReasons,
      confidence: explanation.confidence,
    },
    alternatives,
    risks: primaryEvaluation.diagnostics
      .filter((diagnostic) => diagnostic.level === "error" || diagnostic.level === "warning")
      .map((diagnostic) => diagnostic.message),
    costEstimate,
    roadmap: roadmapResult.roadmap,
    files: primaryExport.files,
    export: primaryExport,
  });
});

app.post("/api/v1/stacks/analyze", async (c) => {
  const body = await parseJson(c.req.raw, StackAnalyzeRequestSchema);
  const tools = resolveTools(body.toolIds);
  const evaluation = evaluateRulesSync(tools, catalogLoader.getRules());
  const conflicts = evaluation.diagnostics.filter((diagnostic) => diagnostic.category === "conflict");
  const warnings = evaluation.diagnostics.filter((diagnostic) => diagnostic.level === "warning");
  const synergies = evaluation.diagnostics.filter((diagnostic) => diagnostic.category === "synergy");

  return c.json({
    harmonyScore: evaluation.score,
    conflicts,
    warnings,
    synergies,
    recommendations: buildRecommendations(tools, evaluation.diagnostics),
  });
});

app.get("/api/v1/tools/search", (c) => {
  const query = ToolSearchQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  const capabilityFilters = query.capabilities?.split(",").map((capability) => capability.trim()).filter(Boolean) ?? [];
  let tools = query.q ? catalogLoader.searchTools(query.q) : catalogLoader.getTools();

  if (query.category) {
    tools = tools.filter((tool) => tool.categoryId === query.category);
  }
  if (query.pricing) {
    tools = tools.filter((tool) => tool.pricing?.model === query.pricing);
  }
  if (capabilityFilters.length > 0) {
    tools = tools.filter((tool) => capabilityFilters.every((capability) => tool.capabilities.includes(capability)));
  }

  tools = sortTools(tools, query.sort);
  const total = tools.length;
  const items = tools.slice(query.offset, query.offset + query.limit);

  return c.json({ items, total, limit: query.limit, offset: query.offset });
});

app.get("/api/v1/tools/:id", (c) => {
  const tool = catalogLoader.getTool(c.req.param("id"));
  if (!tool) {
    return c.json({ error: "Tool not found", requestId: c.get("requestId") }, 404);
  }
  return c.json(tool);
});

app.get("/api/v1/categories", (c) => {
  const categories = catalogLoader.getCategories().map((category) => ({
    ...category,
    toolCount: catalogLoader.getToolsByCategory(category.id).length,
  }));
  return c.json({ items: categories, total: categories.length });
});

app.get("/api/v1/catalog", (c) => {
  const catalog = catalogLoader.getCatalog();
  return c.json({
    version: catalog.version,
    updatedAt: catalog.updatedAt,
    manifest: catalog.manifest,
    categories: catalog.categories,
    tools: catalog.tools,
    rules: catalog.rules,
  });
});

app.get("/api/v1/compatibility/:a/:b", (c) => {
  const toolA = catalogLoader.getTool(c.req.param("a"));
  const toolB = catalogLoader.getTool(c.req.param("b"));
  if (!toolA || !toolB) {
    return c.json({ error: "One or both tools were not found", requestId: c.get("requestId") }, 404);
  }

  const evaluation = evaluateRulesSync([toolA, toolB], catalogLoader.getRules());
  return c.json({
    toolA: toolA.id,
    toolB: toolB.id,
    harmonyScore: evaluation.score,
    compatible: !evaluation.diagnostics.some((diagnostic) => diagnostic.level === "error"),
    diagnostics: evaluation.diagnostics,
  });
});

app.post("/api/v1/scaffolds", async (c) => {
  const body = await parseJson(c.req.raw, ScaffoldRequestSchema);
  const tools = resolveTools(body.toolIds);
  const evaluation = evaluateRulesSync(tools, catalogLoader.getRules());
  const exportData = await generateExport(tools, evaluation.diagnostics, "zip", catalogLoader.getCatalog().version, body.projectName);
  return c.json({ ...exportData, delivery: "file-list" });
});

app.get("/api/v1/migrations/:from/:to", (c) => {
  const params = MigrationParamsSchema.parse(c.req.param());
  const from = catalogLoader.getTool(params.from);
  const to = catalogLoader.getTool(params.to);
  if (!from || !to) {
    return c.json({ error: "One or both tools were not found", requestId: c.get("requestId") }, 404);
  }

  return c.json({
    from: from.id,
    to: to.id,
    complexity: from.categoryId === to.categoryId ? "medium" : "high",
    estimatedTime: from.categoryId === to.categoryId ? "1-3 days" : "1-2 weeks",
    steps: [
      `Inventory current ${from.name} usage and configuration`,
      `Create equivalent ${to.name} configuration in a branch`,
      "Migrate environment variables and secrets",
      "Run compatibility tests and deploy behind a rollback plan",
      ...(from.categoryId === to.categoryId ? [] : ["Schedule a manual architecture review for this cross-category migration"]),
    ],
  });
});

app.post("/admin/tools/import", async (c) => {
  const body = await parseJson(c.req.raw, ImportToolsSchema);
  return c.json({ accepted: body.tools.length, status: "queued", requestId: c.get("requestId") }, 202);
});

app.post("/admin/compatibility/recompute", (c) => {
  return c.json({ status: "queued", ruleCount: catalogLoader.getRules().length, requestId: c.get("requestId") }, 202);
});

app.post("/internal/enrich-tool", async (c) => {
  const body = await parseJson(c.req.raw, EnrichToolSchema);
  const tool = catalogLoader.getTool(body.toolId);
  if (!tool) {
    return c.json({ error: "Tool not found", requestId: c.get("requestId") }, 404);
  }
  return c.json({ status: "queued", toolId: tool.id, force: body.force ?? false, requestId: c.get("requestId") }, 202);
});

async function parseJson<T>(request: Request, schema: z.ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw Object.assign(new Error(JSON.stringify(result.error.format())), { status: 400 });
  }
  return result.data;
}

function resolveTools(toolIds: string[]): Tool[] {
  const tools = toolIds.map((toolId) => catalogLoader.getTool(toolId));
  const missing = toolIds.filter((_, index) => !tools[index]);
  if (missing.length > 0) {
    throw Object.assign(new Error(`Unknown tool ids: ${missing.join(", ")}`), { status: 400 });
  }
  return tools as Tool[];
}

function rateLimit(bucket: string, limit: number): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> {
  return async (c, next) => {
    const clientId = c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip") ?? "local";
    const key = `${bucket}:${clientId}`;
    const now = Date.now();
    const current = rateLimitBuckets.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      await next();
      return;
    }

    if (current.count >= limit) {
      c.header("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return c.json({ error: "Rate limit exceeded", requestId: c.get("requestId") }, 429);
    }

    current.count += 1;
    await next();
  };
}

function requireAdminApiKey(): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> {
  return async (c, next) => {
    const configuredKey = c.env?.ADMIN_API_KEY ?? process.env.ADMIN_API_KEY;
    const providedKey = c.req.header("X-Admin-API-Key") ?? c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");

    if (!configuredKey || providedKey !== configuredKey) {
      return c.json({ error: "Unauthorized", requestId: c.get("requestId") }, 401);
    }

    await next();
  };
}

function sortTools(tools: Tool[], sort: "name" | "category" | "confidence"): Tool[] {
  return [...tools].sort((a, b) => {
    if (sort === "confidence") {
      return b.confidence - a.confidence || a.name.localeCompare(b.name);
    }
    if (sort === "category") {
      return a.categoryId.localeCompare(b.categoryId) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}

function chooseBlueprintTools(idea: string, preferredTools: string[], constraints: string[]): string[] {
  const text = `${idea} ${constraints.join(" ")}`.toLowerCase();
  const ids = new Set(["nextjs", "node", text.includes("railway") ? "railway" : "vercel", "tailwind"]);

  if (text.includes("database") || text.includes("data") || text.includes("dashboard") || text.includes("user")) {
    ids.add("postgres");
    ids.add(text.includes("drizzle") ? "drizzle" : "prisma");
  }
  if (text.includes("auth") || text.includes("login") || text.includes("user")) {
    ids.add("clerk");
  }
  if (text.includes("payment") || text.includes("subscription") || text.includes("billing")) {
    ids.add("stripe");
  }
  if (text.includes("email") || text.includes("notification")) {
    ids.add("resend");
  }
  if (text.includes("file") || text.includes("upload") || text.includes("image")) {
    ids.add("s3");
  }

  for (const preferred of preferredTools) {
    if (catalogLoader.getTool(preferred)) {
      ids.add(preferred);
    }
  }

  return Array.from(ids);
}

function buildAlternatives(primaryToolIds: string[]): string[][] {
  const alternatives = [replaceTool(primaryToolIds, "vercel", "railway"), replaceTool(primaryToolIds, "prisma", "drizzle")];
  return alternatives.filter((ids, index, all) => ids.length > 0 && all.findIndex((other) => other.join("|") === ids.join("|")) === index);
}

function replaceTool(toolIds: string[], from: string, to: string): string[] {
  if (!toolIds.includes(from) || !catalogLoader.getTool(to)) {
    return [];
  }
  return toolIds.map((toolId) => (toolId === from ? to : toolId));
}

async function generateSafeExport(tools: Tool[], diagnostics: Diagnostic[], projectName: string) {
  try {
    return await generateExport(tools, diagnostics, "zip", catalogLoader.getCatalog().version, projectName);
  } catch (error) {
    const exportError = error as ExportError;
    return { files: [], log: { appliedRecipes: [], skippedRecipes: [], warnings: [exportError.message] }, meta: { recipeOrder: [], version: catalogLoader.getCatalog().version, generatedAt: new Date().toISOString() } };
  }
}

// explainStack and summarizeTradeoffs now handled by @stackfast/ai BlueprintExplainer

function buildRecommendations(tools: Tool[], diagnostics: Diagnostic[]): string[] {
  const selectedCategories = new Set<CategoryId>(tools.map((tool) => tool.categoryId));
  const recommendations = diagnostics
    .filter((diagnostic) => diagnostic.level === "warning" || diagnostic.level === "error")
    .map((diagnostic) => diagnostic.message);

  for (const category of catalogLoader.getCategories()) {
    if (category.required && !selectedCategories.has(category.id)) {
      recommendations.push(`Select one ${category.name} tool.`);
    }
  }

  return Array.from(new Set(recommendations));
}

export default app;