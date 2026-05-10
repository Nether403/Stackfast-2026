import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StackBuilder } from '@/components/StackBuilder';
import { ExportDialog } from '@/components/ExportDialog';
import { SelectionsProvider } from '@/context/SelectionsContext';
import { EvaluationProvider } from '@/context/EvaluationContext';
import { SuggestionsProvider } from '@/context/SuggestionsContext';
import { ExportProvider } from '@/context/ExportContext';
import { loadCatalog, clearCatalogCache, type CatalogData } from '@/lib/catalog-loader';
import { Layout } from '@/components/Layout';

export function StackBuilderPage() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await loadCatalog();
        
        if (!cancelled) {
          setCatalog(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load catalog'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefreshCatalog = async () => {
    clearCatalogCache();
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await loadCatalog();
      setCatalog(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load catalog'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Loading StackFast</h2>
              <p className="text-sm text-muted-foreground">
                Fetching the latest tool catalog...
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !catalog) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Failed to Load Catalog</h2>
              <p className="text-muted-foreground">
                {error?.message || 'Unable to load the tool catalog. Please check your connection and try again.'}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleRefreshCatalog}>
                Retry
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ErrorBoundary>
        <SelectionsProvider>
          <EvaluationProvider>
            <SuggestionsProvider>
              <ExportProvider>
                <StackBuilder
                  tools={catalog.tools}
                  categories={catalog.categories}
                  rules={catalog.rules}
                  onExport={() => setShowExportDialog(true)}
                  catalogVersion={catalog.manifest.version}
                  catalogUpdatedAt={catalog.manifest.updatedAt}
                />
                
                <ExportDialog
                  open={showExportDialog}
                  onOpenChange={setShowExportDialog}
                />
              </ExportProvider>
            </SuggestionsProvider>
          </EvaluationProvider>
        </SelectionsProvider>
      </ErrorBoundary>
    </Layout>
  );
}
