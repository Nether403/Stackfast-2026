import { useState, useEffect } from "react";
import { ToolCard } from "@/components/tool-card";
import { ToolModal } from "@/components/tool-modal";
import { SearchFilters } from "@/components/search-filters";
import { AdvancedSearch, type SearchFilters as AdvancedFilters } from "@/components/advanced-search";
import { ApiIntegrationPanel } from "@/components/api-integration-panel";
import { ExternalDataSources } from "@/components/external-data-sources";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Zap, Download, Trash2, Upload, AlertTriangle, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ToolWithCategory, ToolCategory } from "@shared/schema";
import { EditToolDialog } from "@/components/edit-tool-dialog";
import { usePaginatedTools } from "@/hooks/use-paginated-tools";
import Fuse from 'fuse.js';

interface ToolDatabasePageProps {
  searchQuery: string;
  categoryFilter: string;
}

export default function ToolDatabasePage({ searchQuery, categoryFilter }: ToolDatabasePageProps) {
  const [filters, setFilters] = useState({
    category: "all",
    compatibility: "all",
    maturity: "all",
  });

  // Initialize filters from URL parameters
  useEffect(() => {
    if (categoryFilter && categoryFilter !== "") {
      setFilters(prev => ({ ...prev, category: categoryFilter }));
    }
  }, [categoryFilter]);
  
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolWithCategory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolWithCategory | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tools = [], isLoading } = useQuery<ToolWithCategory[]>({
    queryKey: ["/api/tools"],
  });

  const { data: categories = [] } = useQuery<ToolCategory[]>({
    queryKey: ["/api/categories"],
  });

  // Clear all tools mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/tools");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      setOperationStatus("All tools cleared successfully");
      toast({
        title: "Database Cleared",
        description: "All tools have been removed from the database.",
      });
    },
    onError: () => {
      setOperationStatus("Failed to clear tools");
      toast({
        title: "Error",
        description: "Failed to clear tools from database.",
        variant: "destructive",
      });
    },
  });

  // Import CSV mutation
  const importCSVMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tools/import-csv");
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      setOperationStatus(`Successfully imported ${data?.importedCount || 'tools'} from CSV`);
      toast({
        title: "Import Complete",
        description: "Clean tool data imported successfully.",
      });
    },
    onError: () => {
      setOperationStatus("Failed to import CSV data");
      toast({
        title: "Import Error",
        description: "Failed to import tools from CSV.",
        variant: "destructive",
      });
    },
  });

  // Delete individual tool mutation
  const deleteToolMutation = useMutation({
    mutationFn: async (toolId: string) => {
      return apiRequest("DELETE", `/api/tools/${toolId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      toast({
        title: "Tool Deleted",
        description: "Tool removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete tool.",
        variant: "destructive",
      });
    },
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
    setAdvancedFilters(null);
  };

  const handleAdvancedSearch = (filters: AdvancedFilters) => {
    setAdvancedFilters(filters);
  };

  const handleResetAdvancedSearch = () => {
    setAdvancedFilters(null);
  };

  const handleViewDetails = (tool: ToolWithCategory) => {
    setSelectedTool(tool);
    setIsModalOpen(true);
  };

  const handleEditTool = (tool: ToolWithCategory) => {
    setEditingTool(tool);
    setIsEditOpen(true);
    setIsModalOpen(false);
  };

  const handleDeleteTool = (toolId: string) => {
    if (confirm("Are you sure you want to delete this tool?")) {
      deleteToolMutation.mutate(toolId);
    }
  };

  const handleClearAll = () => {
    if (confirm("This will permanently delete ALL tools from the database. Are you sure?")) {
      clearAllMutation.mutate();
    }
  };

  const handleImportCSV = () => {
    if (confirm("This will import clean tool data from CSV. Continue?")) {
      importCSVMutation.mutate();
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const res = await fetch("/api/tools/export-csv");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tools.length > 0 ? "tools.csv" : "tools-template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOperationStatus("CSV downloaded successfully");
    } catch (e) {
      setOperationStatus("Failed to download CSV");
      toast({ title: "Download Error", description: "Unable to download CSV.", variant: "destructive" });
    }
  };

  const fuse = new Fuse(tools, {
    keys: ['name', 'description', 'features'],
    threshold: 0.3, // Adjust for fuzziness
  });

  const filteredTools = tools.filter((tool) => {
    if (searchQuery || (advancedFilters?.query)) {
      const query = searchQuery || advancedFilters?.query || '';
      const fuseResults = fuse.search(query);
      const fuzzyTools = fuseResults.map(result => result.item);
      // Then apply other filters to fuzzyTools instead of tools
      // Replace tools.filter with fuzzyTools.filter for remaining conditions
    }

    // Use basic filters if advanced filters not set
    // Search filter
    if (searchQuery && !tool.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !tool.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Category filter - check if tool has matching category
    if (filters.category !== "all") {
      const hasMatchingCategory = (tool as any).categories ? 
        (tool as any).categories.some((cat: any) => 
          cat.name === filters.category || 
          cat.name.toLowerCase().replace(/[^a-z]/g, "-") === filters.category.toLowerCase().replace(/[^a-z]/g, "-")
        ) :
        tool.category && (tool.category.name === filters.category || 
          tool.category.name.toLowerCase().replace(/[^a-z]/g, "-") === filters.category.toLowerCase().replace(/[^a-z]/g, "-"));
        
      if (!hasMatchingCategory) return false;
    }

    // Maturity filter
    if (filters.maturity !== "all") {
      if (filters.maturity === "mature" && tool.maturityScore < 8.0) return false;
      if (filters.maturity === "stable" && (tool.maturityScore < 6.0 || tool.maturityScore >= 8.0)) return false;
      if (filters.maturity === "beta" && tool.maturityScore >= 6.0) return false;
    }

    return true;
  });

  // Apply sorting if advanced filters are set
  const sortedTools = advancedFilters 
    ? [...filteredTools].sort((a, b) => {
        switch (advancedFilters.sortBy) {
          case "popularity":
            return b.popularityScore - a.popularityScore;
          case "maturity":
            return b.maturityScore - a.maturityScore;
          case "name":
            return a.name.localeCompare(b.name);
          case "recent":
            const dateA = a.apiLastSync ? new Date(a.apiLastSync).getTime() : 0;
            const dateB = b.apiLastSync ? new Date(b.apiLastSync).getTime() : 0;
            return dateB - dateA;
          default:
            return 0;
        }
      })
    : filteredTools;

  const { tools: paginatedTools, currentPage, totalPages, setCurrentPage } = usePaginatedTools(sortedTools, 9); // 9 per page for 3x3 grid

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-github-surface border-github-border">
          <CardHeader>
            <CardTitle className="text-github-text">Loading Tools...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="loading-shimmer h-64 rounded bg-github-border" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="database" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-github-surface">
          <TabsTrigger value="database" data-testid="tab-database">
            <Database className="h-4 w-4 mr-2" />
            Tool Database
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-search">
            <Search className="h-4 w-4 mr-2" />
            Advanced Search
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <Zap className="h-4 w-4 mr-2" />
            API Integrations
          </TabsTrigger>
          <TabsTrigger value="external" data-testid="tab-external">
            <Download className="h-4 w-4 mr-2" />
            External Sources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-6">
          {/* Database Management Section */}
          <Card className="bg-github-surface border-github-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-github-text flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Database Management
              </CardTitle>
              <p className="text-sm text-github-text-secondary">
                Clear existing data and import clean, curated development tools
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {operationStatus && (
                <Alert>
                  <AlertDescription>{operationStatus}</AlertDescription>
                </Alert>
              )}
              
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleClearAll}
                  disabled={clearAllMutation.isPending}
                  variant="destructive"
                  className="flex items-center gap-2"
                  data-testid="button-clear-all"
                >
                  <Trash2 className="h-4 w-4" />
                  {clearAllMutation.isPending ? "Clearing..." : "Clear All Tools"}
                </Button>
                
                <Button
                  onClick={handleImportCSV}
                  disabled={importCSVMutation.isPending}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  data-testid="button-import-csv"
                >
                  <Upload className="h-4 w-4" />
                  {importCSVMutation.isPending ? "Importing..." : "Import Clean CSV Data"}
                </Button>

                <Button
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-2"
                  variant="secondary"
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4" />
                  Download CSV Data
                </Button>
              </div>
              
              <p className="text-xs text-github-text-secondary">
                Current database contains {tools.length} tools. Use "Clear All" to remove
                languages/books/resources, then "Import CSV" for curated development tools only.
              </p>
            </CardContent>
          </Card>

          <SearchFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />

          <Card className="bg-github-surface border-github-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-github-text" data-testid="database-title">
                    Tool Database
                  </CardTitle>
                  <p className="text-sm text-github-text-secondary mt-1">
                    Browse and manage the complete collection of development tools
                  </p>
                </div>
                <div className="text-sm text-github-text-secondary" data-testid="tool-count">
                  {sortedTools.length} of {tools.length} tools
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sortedTools.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-github-text-secondary">
                    {searchQuery || filters.category !== "all" || filters.maturity !== "all" 
                      ? "No tools match your current filters" 
                      : "No tools available"}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedTools.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      onEdit={handleEditTool}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <AdvancedSearch 
            categories={categories}
            onSearch={handleAdvancedSearch}
            onReset={handleResetAdvancedSearch}
          />
          
          {advancedFilters && (
            <Card className="bg-github-surface border-github-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-github-text">
                    Search Results
                  </CardTitle>
                  <div className="text-sm text-github-text-secondary">
                    {sortedTools.length} tools found
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sortedTools.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-github-text-secondary">
                      No tools match your search criteria
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedTools.map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        onEdit={handleEditTool}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="integrations">
          <ApiIntegrationPanel tools={tools} />
        </TabsContent>

        <TabsContent value="external">
          <ExternalDataSources />
        </TabsContent>
      </Tabs>

      <ToolModal
        tool={selectedTool}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEdit={handleEditTool}
      />

      <EditToolDialog 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        tool={editingTool!} 
      />
    </div>
  );
}
