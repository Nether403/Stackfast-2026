/**
 * OpenAPI 3.1.0 specification for the Stackfast API.
 *
 * Includes full request body schemas, response schemas with $ref components,
 * error shapes, and security scheme definitions for both admin API key
 * and Better Auth bearer session authentication.
 */

const ErrorResponse = {
  type: "object" as const,
  required: ["error", "requestId"],
  properties: {
    error: { type: "string", description: "Human-readable error message" },
    requestId: { type: "string", format: "uuid", description: "Unique request identifier for debugging" },
  },
};

const ToolPricing = {
  type: "object" as const,
  properties: {
    model: { type: "string", enum: ["free", "free-tier", "paid"] },
    note: { type: "string" },
    url: { type: "string", format: "uri" },
    lastVerified: { type: "string" },
  },
};

const ToolSupports = {
  type: "object" as const,
  properties: {
    runtime: { type: "array", items: { type: "string" } },
    dbs: { type: "array", items: { type: "string" } },
    frameworks: { type: "array", items: { type: "string" } },
  },
};

const ToolDetail = {
  type: "object" as const,
  required: ["id", "name", "categoryId", "description", "tags", "languages", "supports", "integrations", "lastVerified", "sourceUrls", "confidence", "capabilities", "deprecated"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    categoryId: { type: "string" },
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    hosted: { type: "boolean" },
    selfHostable: { type: "boolean" },
    languages: { type: "array", items: { type: "string" } },
    supports: { $ref: "#/components/schemas/ToolSupports" },
    integrations: { type: "array", items: { type: "string" } },
    pricing: { $ref: "#/components/schemas/ToolPricing" },
    docsUrl: { type: "string", format: "uri" },
    homepageUrl: { type: "string", format: "uri" },
    lastVerified: { type: "string" },
    sourceUrls: { type: "array", items: { type: "string", format: "uri" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    capabilities: { type: "array", items: { type: "string" } },
    deprecated: { type: "boolean" },
  },
};

const Diagnostic = {
  type: "object" as const,
  required: ["id", "level", "category", "message"],
  properties: {
    id: { type: "string" },
    ruleId: { type: "string" },
    ruleVersion: { type: "string" },
    level: { type: "string", enum: ["error", "warning", "info", "success"] },
    category: { type: "string", enum: ["conflict", "synergy", "requirement", "coverage"] },
    message: { type: "string" },
    toolIds: { type: "array", items: { type: "string" } },
    weight: { type: "number" },
  },
};

const Category = {
  type: "object" as const,
  required: ["id", "name", "description", "required", "cardinality", "order"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    required: { type: "boolean" },
    cardinality: { type: "string", enum: ["exactly-one", "at-most-one", "zero-or-one", "zero-to-many"] },
    order: { type: "integer" },
    toolCount: { type: "integer", description: "Number of tools in this category" },
  },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Stackfast API",
    version: "1.0.0",
    description:
      "Stack analysis, catalog search, blueprint generation, and scaffold export for the Stackfast platform. " +
      "Read-only endpoints are public. Generation endpoints require a Better Auth session. " +
      "Admin endpoints require an X-Admin-API-Key header.",
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        operationId: "healthCheck",
        tags: ["system"],
        responses: {
          "200": { description: "API is healthy", content: { "text/plain": { schema: { type: "string", example: "OK" } } } },
        },
      },
    },

    // ── Blueprints ───────────────────────────────────────────────────
    "/api/v1/blueprints": {
      post: {
        summary: "Generate an idea-to-stack blueprint",
        operationId: "generateBlueprint",
        tags: ["blueprints"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BlueprintRequest" } } },
        },
        responses: {
          "200": { description: "Blueprint generated", content: { "application/json": { schema: { $ref: "#/components/schemas/BlueprintResponse" } } } },
          "400": { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Authentication required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },

    // ── Stacks ────────────────────────────────────────────────────────
    "/api/v1/stacks/analyze": {
      post: {
        summary: "Analyze a selected stack for compatibility",
        operationId: "analyzeStack",
        tags: ["stacks"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/StackAnalyzeRequest" } } },
        },
        responses: {
          "200": { description: "Stack analysis result", content: { "application/json": { schema: { $ref: "#/components/schemas/StackAnalyzeResponse" } } } },
          "400": { description: "Invalid tool IDs", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },

    // ── Tools ─────────────────────────────────────────────────────────
    "/api/v1/tools/search": {
      get: {
        summary: "Search and filter registry tools",
        operationId: "searchTools",
        tags: ["tools"],
        parameters: [
          { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Free-text search query" },
          { name: "category", in: "query", required: false, schema: { type: "string" }, description: "Filter by category ID" },
          { name: "capabilities", in: "query", required: false, schema: { type: "string" }, description: "Comma-separated capability filter" },
          { name: "pricing", in: "query", required: false, schema: { type: "string", enum: ["free", "free-tier", "paid"] }, description: "Filter by pricing model" },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["name", "category", "confidence"], default: "name" }, description: "Sort field" },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 25 }, description: "Page size" },
          { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 }, description: "Pagination offset" },
        ],
        responses: {
          "200": { description: "Tool search results", content: { "application/json": { schema: { $ref: "#/components/schemas/ToolSearchResponse" } } } },
        },
      },
    },
    "/api/v1/tools/{id}": {
      get: {
        summary: "Get a single tool by ID",
        operationId: "getToolById",
        tags: ["tools"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Tool slug ID" }],
        responses: {
          "200": { description: "Tool details", content: { "application/json": { schema: { $ref: "#/components/schemas/ToolDetail" } } } },
          "404": { description: "Tool not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },

    // ── Categories ────────────────────────────────────────────────────
    "/api/v1/categories": {
      get: {
        summary: "List categories with tool counts",
        operationId: "listCategories",
        tags: ["categories"],
        responses: {
          "200": { description: "Category list", content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryListResponse" } } } },
        },
      },
    },

    // ── Compatibility ─────────────────────────────────────────────────
    "/api/v1/compatibility/{a}/{b}": {
      get: {
        summary: "Get pairwise tool compatibility",
        operationId: "getCompatibility",
        tags: ["compatibility"],
        parameters: [
          { name: "a", in: "path", required: true, schema: { type: "string" }, description: "First tool ID" },
          { name: "b", in: "path", required: true, schema: { type: "string" }, description: "Second tool ID" },
        ],
        responses: {
          "200": { description: "Compatibility result", content: { "application/json": { schema: { $ref: "#/components/schemas/CompatibilityResponse" } } } },
          "404": { description: "Tool not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },

    // ── Scaffolds ─────────────────────────────────────────────────────
    "/api/v1/scaffolds": {
      post: {
        summary: "Generate starter scaffold files",
        operationId: "generateScaffold",
        tags: ["scaffolds"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ScaffoldRequest" } } },
        },
        responses: {
          "200": { description: "Generated file list", content: { "application/json": { schema: { $ref: "#/components/schemas/ScaffoldResponse" } } } },
          "400": { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Authentication required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "429": { description: "Rate limited", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },

    // ── Migrations ────────────────────────────────────────────────────
    "/api/v1/migrations/{from}/{to}": {
      get: {
        summary: "Get a migration path between tools",
        operationId: "getMigrationPath",
        tags: ["migrations"],
        parameters: [
          { name: "from", in: "path", required: true, schema: { type: "string" }, description: "Source tool ID" },
          { name: "to", in: "path", required: true, schema: { type: "string" }, description: "Target tool ID" },
        ],
        responses: {
          "200": { description: "Migration path", content: { "application/json": { schema: { $ref: "#/components/schemas/MigrationResponse" } } } },
          "404": { description: "Tool not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },

    // ── Auth ──────────────────────────────────────────────────────────
    "/api/auth/{...path}": {
      get: {
        summary: "Better Auth handler (login, callback, session, logout)",
        operationId: "authHandler",
        tags: ["auth"],
        parameters: [{ name: "path", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Auth response (varies by path)" } },
      },
    },

    // ── Admin ─────────────────────────────────────────────────────────
    "/admin/tools/import": {
      post: {
        summary: "Protected bulk tool import",
        operationId: "adminImportTools",
        tags: ["admin"],
        security: [{ adminApiKey: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["tools"], properties: { tools: { type: "array", items: {}, minItems: 1 } } } } },
        },
        responses: {
          "202": { description: "Import queued", content: { "application/json": { schema: { type: "object", properties: { accepted: { type: "integer" }, status: { type: "string" }, requestId: { type: "string" } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/admin/compatibility/recompute": {
      post: {
        summary: "Protected compatibility recompute job",
        operationId: "adminRecomputeCompatibility",
        tags: ["admin"],
        security: [{ adminApiKey: [] }],
        responses: {
          "202": { description: "Recompute queued", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, ruleCount: { type: "integer" }, requestId: { type: "string" } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/internal/enrich-tool": {
      post: {
        summary: "Protected tool metadata refresh job",
        operationId: "internalEnrichTool",
        tags: ["admin"],
        security: [{ adminApiKey: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["toolId"], properties: { toolId: { type: "string" }, force: { type: "boolean" } } } } },
        },
        responses: {
          "202": { description: "Refresh queued", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, toolId: { type: "string" }, force: { type: "boolean" }, requestId: { type: "string" } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Tool not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
  },

  components: {
    schemas: {
      ErrorResponse,
      ToolPricing,
      ToolSupports,
      ToolDetail,
      Diagnostic,
      Category,

      // ── Request schemas ──────────────────────────────────────────
      BlueprintRequest: {
        type: "object" as const,
        required: ["idea"],
        properties: {
          idea: { type: "string", minLength: 1, description: "Natural-language description of the project idea" },
          constraints: { type: "array", items: { type: "string" }, description: "Optional constraints" },
          preferredTools: { type: "array", items: { type: "string" }, description: "Tool IDs the user prefers" },
          budget: { type: "string", enum: ["low", "medium", "high", "enterprise"] },
          timeline: { type: "string", enum: ["prototype", "mvp", "production"] },
          teamSize: { type: "integer", minimum: 1 },
        },
      },
      StackAnalyzeRequest: {
        type: "object" as const,
        required: ["toolIds"],
        properties: {
          toolIds: { type: "array", items: { type: "string" }, minItems: 1, description: "Tool IDs to analyze" },
        },
      },
      ScaffoldRequest: {
        type: "object" as const,
        required: ["toolIds", "projectName"],
        properties: {
          toolIds: { type: "array", items: { type: "string" }, minItems: 1 },
          projectName: { type: "string", minLength: 1 },
        },
      },

      // ── Response schemas ─────────────────────────────────────────
      BlueprintResponse: {
        type: "object" as const,
        required: ["idea", "recommendedStack", "alternatives", "risks", "files", "export"],
        properties: {
          idea: { type: "string" },
          recommendedStack: {
            type: "object",
            properties: {
              toolIds: { type: "array", items: { type: "string" } },
              tools: { type: "array", items: { $ref: "#/components/schemas/ToolDetail" } },
              harmonyScore: { type: "number" },
              diagnostics: { type: "array", items: { $ref: "#/components/schemas/Diagnostic" } },
              rationale: { type: "string" },
              explanationSource: { type: "string", enum: ["heuristic", "ai"] },
            },
          },
          alternatives: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, toolIds: { type: "array", items: { type: "string" } }, harmonyScore: { type: "number" }, tradeoffs: { type: "array", items: { type: "string" } }, tradeoffSource: { type: "string", enum: ["heuristic", "ai"] } } } },
          risks: { type: "array", items: { type: "string" } },
          files: { type: "array", items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } } },
          export: { type: "object", description: "Full export data including log and metadata" },
        },
      },
      StackAnalyzeResponse: {
        type: "object" as const,
        required: ["harmonyScore", "conflicts", "warnings", "synergies", "recommendations"],
        properties: {
          harmonyScore: { type: "number" },
          conflicts: { type: "array", items: { $ref: "#/components/schemas/Diagnostic" } },
          warnings: { type: "array", items: { $ref: "#/components/schemas/Diagnostic" } },
          synergies: { type: "array", items: { $ref: "#/components/schemas/Diagnostic" } },
          recommendations: { type: "array", items: { type: "string" } },
        },
      },
      ToolSearchResponse: {
        type: "object" as const,
        required: ["items", "total", "limit", "offset"],
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/ToolDetail" } },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
      },
      CategoryListResponse: {
        type: "object" as const,
        required: ["items", "total"],
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/Category" } },
          total: { type: "integer" },
        },
      },
      CompatibilityResponse: {
        type: "object" as const,
        required: ["toolA", "toolB", "harmonyScore", "compatible", "diagnostics"],
        properties: {
          toolA: { type: "string" },
          toolB: { type: "string" },
          harmonyScore: { type: "number" },
          compatible: { type: "boolean" },
          diagnostics: { type: "array", items: { $ref: "#/components/schemas/Diagnostic" } },
        },
      },
      ScaffoldResponse: {
        type: "object" as const,
        properties: {
          files: { type: "array", items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } } },
          log: { type: "object" },
          meta: { type: "object" },
          delivery: { type: "string", enum: ["file-list"] },
        },
      },
      MigrationResponse: {
        type: "object" as const,
        required: ["from", "to", "difficulty", "steps"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          difficulty: { type: "string", enum: ["moderate", "high"] },
          steps: { type: "array", items: { type: "string" } },
          caveats: { type: "array", items: { type: "string" } },
        },
      },
    },

    securitySchemes: {
      adminApiKey: {
        type: "apiKey" as const,
        in: "header" as const,
        name: "X-Admin-API-Key",
        description: "Admin API key for protected mutation endpoints",
      },
      bearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        description: "Better Auth session token (via cookie or Authorization header)",
      },
    },
  },
} as const;