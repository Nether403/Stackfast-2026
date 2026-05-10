import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { BlueprintRequest, ScaffoldRequest, StackAnalyzeRequest } from "@stackfast/schemas";

export const useTools = (params?: { 
  q?: string; 
  category?: string; 
  capabilities?: string; 
  pricing?: string;
  sort?: "name" | "category" | "confidence";
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: ["tools", params],
    queryFn: () => apiClient.searchTools(params),
  });
};

export const useTool = (id: string) => {
  return useQuery({
    queryKey: ["tool", id],
    queryFn: () => apiClient.getTool(id),
    enabled: !!id,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.getCategories(),
  });
};

export const useCompatibility = (a: string, b: string) => {
  return useQuery({
    queryKey: ["compatibility", a, b],
    queryFn: () => apiClient.getCompatibility(a, b),
    enabled: !!a && !!b,
  });
};

export const useAnalyzeStack = () => {
  return useMutation({
    mutationFn: (data: StackAnalyzeRequest) => apiClient.analyzeStack(data),
  });
};

export const useGenerateBlueprint = () => {
  return useMutation({
    mutationFn: (data: BlueprintRequest) => apiClient.generateBlueprint(data),
  });
};

export const useGenerateScaffold = () => {
  return useMutation({
    mutationFn: (data: ScaffoldRequest) => apiClient.generateScaffold(data),
  });
};

export const useMigrationPath = (from: string, to: string) => {
  return useQuery({
    queryKey: ["migration", from, to],
    queryFn: () => apiClient.getMigrationPath(from, to),
    enabled: !!from && !!to,
  });
};
