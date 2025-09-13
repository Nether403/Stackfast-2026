import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Tool, StackTemplate, ToolCategory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, CheckCircle2, XCircle, Package, ArrowRight, Zap, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToolRecommendations } from "@/components/tool-recommendations";
import { MigrationPaths } from "@/components/migration-paths";
import { StackExport } from "@/components/stack-export";

export function StackBuilder() {
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [harmonyScore, setHarmonyScore] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch all tools
  const { data: tools = [], isLoading: toolsLoading } = useQuery<Tool[]>({
    queryKey: ["/api/tools"]
  });

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ToolCategory[]>({
    queryKey: ["/api/categories"]
  });

  // Fetch stack templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<StackTemplate[]>({
    queryKey: ["/api/stack-templates"]
  });

  // Validate stack mutation
  const validateStack = useMutation({
    mutationFn: async (toolIds: string[]) => {
      const response = await apiRequest("POST", "/api/stack/validate", { toolIds });
      return response.json();
    },
    onSuccess: (data) => {
      setValidationResult(data);
      toast({
        title: data.valid ? "Stack Valid!" : "Stack Has Issues",
        description: data.valid 
          ? "Your tech stack is compatible and ready to use."
          : "There are some conflicts or dependencies to resolve.",
        variant: data.valid ? "default" : "destructive"
      });
    }
  });

  // Calculate harmony score mutation
  const calculateHarmony = useMutation({
    mutationFn: async (toolIds: string[]) => {
      const response = await apiRequest("POST", "/api/stack/harmony-score", { toolIds });
      return response.json();
    },
    onSuccess: (data) => {
      setHarmonyScore(data.harmonyScore);
    }
  });

  // Get recommendations mutation
  const getRecommendations = useMutation({
    mutationFn: async ({ toolIds, category }: { toolIds: string[]; category?: string }) => {
      const response = await apiRequest("POST", "/api/stack/recommendations", { toolIds, category });
      return response.json();
    }
  });

  // Export stack mutation
  const exportStack = useMutation({
    mutationFn: async ({ format, toolIds }: { format: string; toolIds: string[] }) => {
      const response = await apiRequest("POST", "/api/stack/export", { format, toolIds });
      if (format === "csv") {
        return response.text();
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.format === "csv") {
        // Download CSV file
        const blob = new Blob([data as string], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "stack-compatibility.csv";
        a.click();
        window.URL.revokeObjectURL(url);
      }
      toast({
        title: "Export Successful",
        description: `Stack exported as ${variables.format.toUpperCase()}`
      });
    }
  });

  const toggleToolSelection = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
    // Clear previous validation when selection changes
    setValidationResult(null);
    setHarmonyScore(null);
  };

  const selectTemplate = (template: StackTemplate) => {
    setSelectedTools(template.toolIds);
    setValidationResult(null);
    setHarmonyScore(null);
    toast({
      title: "Template Applied",
      description: `Loaded "${template.name}" stack configuration`
    });
  };

  const validateAndScore = async () => {
    if (selectedTools.length < 2) {
      toast({
        title: "Not Enough Tools",
        description: "Please select at least 2 tools to validate a stack",
        variant: "destructive"
      });
      return;
    }
    await validateStack.mutateAsync(selectedTools);
    await calculateHarmony.mutateAsync(selectedTools);
  };

  // Create category lookup map
  const categoryMap = categories.reduce((acc: Record<string, string>, cat: ToolCategory) => {
    acc[cat.id] = cat.name;
    return acc;
  }, {});

  // Group tools by category name
  const groupedTools = tools.reduce((acc: Record<string, Tool[]>, tool: any) => {
    // If tool has multiple categories, add it to each category group
    if (tool.categories && tool.categories.length > 0) {
      tool.categories.forEach((category: any) => {
        const categoryName = category.name || "Other";
        if (!acc[categoryName]) acc[categoryName] = [];
        // Only add if not already in this category (avoid duplicates)
        if (!acc[categoryName].find(t => t.id === tool.id)) {
          acc[categoryName].push(tool);
        }
      });
    } else {
      // Fallback to single category
      const categoryName = tool.categoryId ? categoryMap[tool.categoryId] || "Other" : "Other";
      if (!acc[categoryName]) acc[categoryName] = [];
      acc[categoryName].push(tool);
    }
    return acc;
  }, {});

  if (toolsLoading || templatesLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl" data-testid="stack-builder-container">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
          Stack Builder for StackFast
        </h1>
        <p className="text-muted-foreground text-lg">
          Build, validate, and optimize your tech stack with AI-powered recommendations
        </p>
      </div>

      <Tabs defaultValue="builder" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50">
          <TabsTrigger value="builder" data-testid="tab-builder">
            <Package className="h-4 w-4 mr-2" />
            Stack Builder
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <Zap className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <ArrowRight className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="migration" data-testid="tab-migration">
            <GitBranch className="h-4 w-4 mr-2" />
            Migration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tool Selection */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Select Tools</CardTitle>
                  <CardDescription>
                    Choose tools to build your custom tech stack
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(groupedTools).map(([category, categoryTools]) => (
                    <div key={category} className="space-y-2">
                      <h3 className="font-semibold text-sm text-muted-foreground">
                        {category}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {categoryTools.map((tool) => (
                          <Badge
                            key={tool.id}
                            variant={selectedTools.includes(tool.id) ? "default" : "outline"}
                            className="cursor-pointer transition-all hover:scale-105"
                            onClick={() => toggleToolSelection(tool.id)}
                            data-testid={`tool-badge-${tool.id}`}
                          >
                            {tool.name}
                            {selectedTools.includes(tool.id) && (
                              <CheckCircle2 className="h-3 w-3 ml-1" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Validation Results */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Selected Stack</CardTitle>
                  <CardDescription>
                    {selectedTools.length} tools selected
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedTools.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        {selectedTools.map(id => {
                          const tool = tools.find((t: Tool) => t.id === id);
                          return tool ? (
                            <Badge key={id} variant="secondary" className="w-full justify-start">
                              {tool.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                      <div className="space-y-2">
                        <Button 
                          onClick={validateAndScore} 
                          className="w-full"
                          disabled={validateStack.isPending || calculateHarmony.isPending}
                          data-testid="button-validate-stack"
                        >
                          {validateStack.isPending || calculateHarmony.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Validating...
                            </>
                          ) : (
                            "Validate Stack"
                          )}
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportStack.mutate({ format: "json", toolIds: selectedTools })}
                            disabled={selectedTools.length === 0}
                            data-testid="button-export-json"
                          >
                            Export JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportStack.mutate({ format: "csv", toolIds: selectedTools })}
                            disabled={selectedTools.length === 0}
                            data-testid="button-export-csv"
                          >
                            Export CSV
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Select tools to build your stack
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Harmony Score */}
              {harmonyScore !== null && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Harmony Score
                      <span 
                        className={`text-2xl font-bold ${
                          harmonyScore >= 80 ? "text-green-500" :
                          harmonyScore >= 60 ? "text-yellow-500" :
                          "text-red-500"
                        }`}
                      >
                        {harmonyScore}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          harmonyScore >= 80 ? "bg-green-500" :
                          harmonyScore >= 60 ? "bg-yellow-500" :
                          "bg-red-500"
                        }`}
                        style={{ width: `${harmonyScore}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {harmonyScore >= 80 ? "Excellent compatibility!" :
                       harmonyScore >= 60 ? "Good compatibility with minor issues" :
                       "Low compatibility - consider alternatives"}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Validation Results */}
              {validationResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Validation Results
                      {validationResult.valid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {validationResult.conflicts.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Conflicts:</strong>
                          {validationResult.conflicts.map((c: any, i: number) => (
                            <div key={i} className="mt-1">
                              {c.reason}
                            </div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {validationResult.warnings.length > 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Warnings:</strong>
                          {validationResult.warnings.map((w: string, i: number) => (
                            <div key={i} className="mt-1">{w}</div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {validationResult.recommendations.length > 0 && (
                      <Alert className="border-blue-500 bg-blue-500/10">
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                        <AlertDescription>
                          <strong>Recommendations:</strong>
                          {validationResult.recommendations.map((r: string, i: number) => (
                            <div key={i} className="mt-1">{r}</div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tool Recommendations */}
              {selectedTools.length > 0 && (
                <ToolRecommendations 
                  selectedToolIds={selectedTools}
                  onToolSelect={(tool) => {
                    if (!selectedTools.includes(tool.id)) {
                      setSelectedTools(prev => [...prev, tool.id]);
                      toast({
                        title: "Tool Added",
                        description: `${tool.name} has been added to your stack`
                      });
                    }
                  }}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template: StackTemplate) => (
              <Card 
                key={template.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => selectTemplate(template)}
                data-testid={`template-card-${template.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.harmonyScore && (
                      <Badge variant="secondary">
                        {template.harmonyScore}% Harmony
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Use Case:</p>
                    <p className="text-sm text-muted-foreground">{template.useCase}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-1">Stack:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.toolIds.slice(0, 5).map(toolId => {
                        const tool = tools.find((t: Tool) => t.id === toolId);
                        return tool ? (
                          <Badge key={toolId} variant="outline" className="text-xs">
                            {tool.name}
                          </Badge>
                        ) : null;
                      })}
                      {template.toolIds.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.toolIds.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Complexity: {template.setupComplexity}
                    </span>
                    <span className="text-muted-foreground">
                      {template.estimatedCost}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Get Recommendations</CardTitle>
              <CardDescription>
                Based on your selected tools, we'll recommend compatible additions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTools.length > 0 ? (
                <div className="space-y-4">
                  <Button
                    onClick={() => getRecommendations.mutate({ toolIds: selectedTools })}
                    disabled={getRecommendations.isPending}
                    data-testid="button-get-recommendations"
                  >
                    {getRecommendations.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Getting Recommendations...
                      </>
                    ) : (
                      "Get Recommendations"
                    )}
                  </Button>

                  {getRecommendations.data && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Recommended Tools:</h3>
                      {getRecommendations.data.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {getRecommendations.data.map((tool: Tool) => (
                            <Card key={tool.id}>
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <CardTitle className="text-base">{tool.name}</CardTitle>
                                    <CardDescription className="text-xs mt-1">
                                      {tool.description}
                                    </CardDescription>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleToolSelection(tool.id)}
                                    data-testid={`button-add-${tool.id}`}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No additional recommendations available for this stack.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select tools first to get personalized recommendations
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration" className="space-y-6">
          <MigrationPaths />
        </TabsContent>
      </Tabs>
      <StackExport toolIds={selectedTools.map(t => t.id)} />
    </div>
  );
}