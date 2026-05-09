export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Stackfast API",
    version: "1.0.0",
    description: "Clean API surface for Stackfast stack analysis, catalog search, blueprint generation, and scaffold export.",
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: { "200": { description: "API is healthy" } },
      },
    },
    "/api/v1/blueprints": {
      post: {
        summary: "Generate an idea-to-stack blueprint",
        responses: { "200": { description: "Blueprint generated" }, "400": { description: "Invalid request" }, "429": { description: "Rate limited" } },
      },
    },
    "/api/v1/stacks/analyze": {
      post: {
        summary: "Analyze a selected stack",
        responses: { "200": { description: "Stack analysis" }, "400": { description: "Invalid tool IDs" } },
      },
    },
    "/api/v1/tools/search": {
      get: {
        summary: "Search registry tools",
        parameters: [
          { name: "q", in: "query", required: false, schema: { type: "string" } },
          { name: "category", in: "query", required: false, schema: { type: "string" } },
          { name: "capabilities", in: "query", required: false, schema: { type: "string" } },
          { name: "pricing", in: "query", required: false, schema: { type: "string", enum: ["free", "free-tier", "paid"] } },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["name", "category", "confidence"] } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0 } },
        ],
        responses: { "200": { description: "Tool search results" } },
      },
    },
    "/api/v1/tools/{id}": {
      get: {
        summary: "Get a single tool",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Tool details" }, "404": { description: "Tool not found" } },
      },
    },
    "/api/v1/categories": {
      get: {
        summary: "List categories with tool counts",
        responses: { "200": { description: "Category list" } },
      },
    },
    "/api/v1/compatibility/{a}/{b}": {
      get: {
        summary: "Get pairwise tool compatibility",
        parameters: [
          { name: "a", in: "path", required: true, schema: { type: "string" } },
          { name: "b", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Compatibility result" }, "404": { description: "Tool not found" } },
      },
    },
    "/api/v1/scaffolds": {
      post: {
        summary: "Generate starter scaffold files",
        responses: { "200": { description: "Generated file list" }, "400": { description: "Invalid request" }, "429": { description: "Rate limited" } },
      },
    },
    "/api/v1/migrations/{from}/{to}": {
      get: {
        summary: "Get a migration path between tools",
        parameters: [
          { name: "from", in: "path", required: true, schema: { type: "string" } },
          { name: "to", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Migration path" }, "404": { description: "Tool not found" } },
      },
    },
    "/admin/tools/import": {
      post: {
        summary: "Protected bulk tool import",
        security: [{ adminApiKey: [] }],
        responses: { "202": { description: "Import queued" }, "401": { description: "Unauthorized" } },
      },
    },
    "/admin/compatibility/recompute": {
      post: {
        summary: "Protected compatibility recompute job",
        security: [{ adminApiKey: [] }],
        responses: { "202": { description: "Recompute queued" }, "401": { description: "Unauthorized" } },
      },
    },
    "/internal/enrich-tool": {
      post: {
        summary: "Protected tool metadata refresh job",
        security: [{ adminApiKey: [] }],
        responses: { "202": { description: "Refresh queued" }, "401": { description: "Unauthorized" } },
      },
    },
  },
  components: {
    securitySchemes: {
      adminApiKey: { type: "apiKey", in: "header", name: "X-Admin-API-Key" },
    },
  },
} as const;