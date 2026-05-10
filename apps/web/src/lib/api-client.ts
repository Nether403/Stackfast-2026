import { 
  Tool, 
  Category, 
  StackAnalyzeRequest, 
  StackAnalyzeResponse, 
  ScaffoldRequest, 
  ScaffoldResponse,
  BlueprintRequest,
  BlueprintResponse,
  CompatibilityResponse,
  MigrationResponse,
} from "@stackfast/schemas";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

class ApiError extends Error {
  constructor(public status: number, public data: any) {
    super(data.error || `API Error: ${status}`);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}

export const apiClient = {
  // Tools
  searchTools: (params?: { 
    q?: string; 
    category?: string; 
    capabilities?: string; 
    pricing?: string;
    sort?: "name" | "category" | "confidence";
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const qs = searchParams.toString();
    return fetchApi<{ items: Tool[]; total: number; limit: number; offset: number }>(`/tools/search${qs ? `?${qs}` : ""}`);
  },
  
  getTool: (id: string) => fetchApi<Tool>(`/tools/${id}`),

  // Categories
  getCategories: () => fetchApi<{ items: Category[]; total: number }>("/categories"),

  // Compatibility
  getCompatibility: (a: string, b: string) => fetchApi<CompatibilityResponse>(`/compatibility/${a}/${b}`),

  // Stacks
  analyzeStack: (data: StackAnalyzeRequest) => 
    fetchApi<StackAnalyzeResponse>("/stacks/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Blueprints
  generateBlueprint: (data: BlueprintRequest) =>
    fetchApi<BlueprintResponse>("/blueprints", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Scaffolds
  generateScaffold: (data: ScaffoldRequest) =>
    fetchApi<ScaffoldResponse>("/scaffolds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Migrations
  getMigrationPath: (from: string, to: string) => fetchApi<MigrationResponse>(`/migrations/${from}/${to}`),
};
