import { Route, Switch } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StackBuilderPage } from '@/pages/StackBuilderPage';
import { BlueprintBuilder } from '@/pages/BlueprintBuilder';
import { ToolCatalog } from '@/pages/ToolCatalog';
import { CompatibilityView } from '@/pages/CompatibilityView';
import { MigrationExplorer } from '@/pages/MigrationExplorer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={StackBuilderPage} />
        <Route path="/stack-builder" component={StackBuilderPage} />
        <Route path="/blueprint" component={BlueprintBuilder} />
        <Route path="/catalog" component={ToolCatalog} />
        <Route path="/compatibility" component={CompatibilityView} />
        <Route path="/migration" component={MigrationExplorer} />
        <Route>
          <div className="flex h-screen items-center justify-center">
            <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
          </div>
        </Route>
      </Switch>
    </QueryClientProvider>
  );
}
