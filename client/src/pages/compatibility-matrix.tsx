import { useState } from "react";
import { CompatibilityMatrix } from "@/components/compatibility-matrix";
import { CompatibilityInsights } from "@/components/compatibility-insights";
import { CompatibilityHeatmap } from "@/components/compatibility/compatibility-heatmap";
import { MigrationWizard } from "@/components/migration/migration-wizard";
import { SearchFilters } from "@/components/search-filters";
import { ToolModal } from "@/components/tool-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cpu, Layout, Database, Zap, Grid3x3, BarChart3, Sparkles, Trash2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ToolWithCategory, CompatibilityMatrix as CompatibilityMatrixType } from "@shared/schema";

interface CompatibilityMatrixPageProps {
  searchQuery: string;
}

export default function CompatibilityMatrixPage({ searchQuery }: CompatibilityMatrixPageProps) {
  const [filters, setFilters] = useState({
    category: "all",
    compatibility: "all",
    maturity: "all",
  });
  
  const [selectedTool, setSelectedTool] = useState<ToolWithCategory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [useQualityFilter, setUseQualityFilter] = useState(true);
  const [generatingCompatibilities, setGeneratingCompatibilities] = useState(false);

  const { data: allTools = [], refetch: refetchTools } = useQuery<ToolWithCategory[]>({
    queryKey: [useQualityFilter ? "/api/tools/quality" : "/api/tools"],
  });
  
  // Limit tools to 50 for the matrix view to prevent UI overload
  const tools = allTools.slice(0, 50);

  const { data: compatibilityMatrix = [], refetch: refetchMatrix } = useQuery<CompatibilityMatrixType[]>({
    queryKey: ["/api/compatibility-matrix"],
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      category: "all",
      compatibility: "all",
      maturity: "all",
    });
  };

  const handleToolClick = (tool: ToolWithCategory) => {
    setSelectedTool(tool);
    setIsModalOpen(true);
  };

  const handleEditTool = (tool: ToolWithCategory) => {
    // TODO: Implement edit functionality
    console.log("Edit tool:", tool);
    setIsModalOpen(false);
  };

  const getCategoryStats = () => {
    const stats = tools.reduce((acc, tool) => {
      const category = tool.category.name;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: "AI Coding Tools", count: stats["AI Coding Tools"] || 0, icon: Cpu, color: "text-neon-orange" },
      { name: "Frontend/Design", count: stats["Frontend/Design"] || 0, icon: Layout, color: "text-info" },
      { name: "Backend/Database", count: stats["Backend/Database"] || 0, icon: Database, color: "text-success" },
      { name: "Payment Platforms", count: stats["Payment Platforms"] || 0, icon: Zap, color: "text-warning" },
    ];
  };

  const categoryStats = getCategoryStats();
  const totalCompatibilities = tools.length * (tools.length - 1) / 2; // Combinations without repetition
  const { toast } = useToast();

  const handleGenerateCompatibilities = async () => {
    setGeneratingCompatibilities(true);
    try {
      const response = await apiRequest("POST", "/api/compatibility/generate");
      const result = await response.json();
      
      toast({
        title: "Compatibilities Generated",
        description: `Generated ${result.generated} new compatibilities for ${result.totalTools} quality tools`,
      });
      
      await refetchMatrix();
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate compatibilities. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGeneratingCompatibilities(false);
    }
  };

  const handleCleanupTools = async () => {
    if (!confirm("This will permanently delete low-quality tools. Continue?")) return;
    
    try {
      const response = await apiRequest("POST", "/api/tools/cleanup");
      const result = await response.json();
      
      toast({
        title: "Cleanup Complete",
        description: `Removed ${result.deleted} low-quality tools`,
      });
      
      await refetchTools();
      await refetchMatrix();
    } catch (error) {
      toast({
        title: "Cleanup Failed",
        description: "Failed to cleanup tools. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Quality Controls Card */}
      <Card className="bg-github-surface border-github-border">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-github-text mb-2">Matrix Quality Controls</h3>
                <p className="text-sm text-github-text-secondary">
                  {useQualityFilter 
                    ? `Showing ${tools.length} high-quality tools with strong data`
                    : `Showing all ${tools.length} tools (may be slow)`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="quality-filter"
                    checked={useQualityFilter}
                    onCheckedChange={setUseQualityFilter}
                    data-testid="switch-quality-filter"
                  />
                  <Label htmlFor="quality-filter" className="text-sm">
                    Quality Filter
                  </Label>
                </div>
              </div>
            </div>
            
            {useQualityFilter && tools.length > 0 && (
              <Alert className="bg-info/10 border-info">
                <AlertCircle className="h-4 w-4 text-info" />
                <AlertDescription className="text-github-text">
                  Quality filter active: Showing tools with popularity ≥20, maturity ≥30, and complete metadata.
                  Matrix shows {tools.length}×{tools.length} = {tools.length * tools.length} cells.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={handleGenerateCompatibilities}
                disabled={generatingCompatibilities || tools.length === 0}
                className="bg-neon-orange hover:bg-neon-orange/90"
                data-testid="button-generate-compatibilities"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generatingCompatibilities ? "Generating..." : "Generate Smart Compatibilities"}
              </Button>
              
              <Button
                onClick={handleCleanupTools}
                variant="outline"
                className="border-github-border hover:bg-github-surface"
                data-testid="button-cleanup-tools"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Low-Quality Tools
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="matrix" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-github-surface">
          <TabsTrigger value="matrix" data-testid="tab-matrix-view">
            <Grid3x3 className="h-4 w-4 mr-2" />
            Matrix View
          </TabsTrigger>
          <TabsTrigger value="heatmap" data-testid="tab-heatmap">
            <Sparkles className="h-4 w-4 mr-2" />
            Heatmap
          </TabsTrigger>
          <TabsTrigger value="migration" data-testid="tab-migration">
            <AlertCircle className="h-4 w-4 mr-2" />
            Migration
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <BarChart3 className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-6">
          <SearchFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />

          <CompatibilityMatrix
            searchQuery={searchQuery}
            filters={filters}
            onToolClick={handleToolClick}
          />

          {/* Quick Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {categoryStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.name} className="bg-github-surface border-github-border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color.includes('neon-orange') ? 'bg-neon-orange/20' : 
                        stat.color.includes('info') ? 'bg-info/20' :
                        stat.color.includes('success') ? 'bg-success/20' : 'bg-warning/20'}`}>
                        <Icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-github-text" data-testid={`stat-count-${index}`}>
                          {stat.count}
                        </div>
                        <div className="text-sm text-github-text-secondary" data-testid={`stat-label-${index}`}>
                          {stat.name}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-6">
          <CompatibilityHeatmap
            tools={tools}
            compatibilities={compatibilityMatrix as any}
            onToolSelect={(toolId) => {
              const tool = tools.find(t => t.id === toolId);
              if (tool) handleToolClick(tool);
            }}
          />
        </TabsContent>

        <TabsContent value="migration" className="space-y-6">
          <MigrationWizard tools={tools} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <CompatibilityInsights
            tools={tools}
            compatibilityMatrix={compatibilityMatrix}
          />
        </TabsContent>
      </Tabs>

      <ToolModal
        tool={selectedTool}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEdit={handleEditTool}
      />
    </div>
  );
}
