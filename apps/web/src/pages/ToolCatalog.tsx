import { useState, useEffect } from "react";
import { useTools, useCategories } from "../hooks/useApi";
import { Search, Filter, Loader2, ArrowRight, X } from "lucide-react";
import { Layout } from "../components/Layout";

export function ToolCatalog() {
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get("q") || "";
    }
    return "";
  });
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = useTools({ 
    q: search, 
    category: selectedCategory,
    limit: 50 
  });
  
  const { data: categoriesData } = useCategories();

  // Update URL when search changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (search) {
        url.searchParams.set("q", search);
      } else {
        url.searchParams.delete("q");
      }
      window.history.replaceState({}, '', url);
    }
  }, [search]);

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-4xl font-bold tracking-tight">Tool Catalog</h1>
          <p className="text-lg text-muted-foreground">
            Explore and discover tools available for your stack.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto items-start sm:items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search tools..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input h-10 px-4 py-2 w-full sm:w-auto ${showFilters ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-accent hover:text-accent-foreground'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {(selectedCategory) && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                1
              </span>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="p-4 rounded-xl border border-border bg-card animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm">Filter by Category</h3>
            {selectedCategory && (
              <button 
                onClick={() => setSelectedCategory(undefined)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center"
              >
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(undefined)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${!selectedCategory ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'}`}
            >
              All Categories
            </button>
            {categoriesData?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${selectedCategory === cat.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive text-destructive">
          Failed to load tools. Please try again later.
        </div>
      ) : data?.items?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-medium mb-1">No tools found</h3>
          <p className="text-muted-foreground">We couldn't find any tools matching your search criteria.</p>
          {(search || selectedCategory) && (
            <button 
              onClick={() => { setSearch(""); setSelectedCategory(undefined); }}
              className="mt-4 text-sm text-primary font-medium hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data?.items.map((tool) => (
            <div 
              key={tool.id} 
              className="group relative flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="p-6 flex flex-col flex-1 relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-xl leading-none tracking-tight">{tool.name}</h3>
                    <p className="text-sm text-primary font-medium uppercase tracking-wider">{tool.categoryId}</p>
                  </div>
                  {tool.confidence > 0.8 && (
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground">
                      Verified
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-3 mb-6 flex-1">
                  {tool.description}
                </p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                  <div className="flex gap-2">
                    {tool.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground bg-muted">
                        {tag}
                      </span>
                    ))}
                    {tool.tags.length > 2 && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground bg-muted">
                        +{tool.tags.length - 2}
                      </span>
                    )}
                  </div>
                  
                  <button className="text-primary hover:text-primary/80 transition-colors">
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </Layout>
  );
}
