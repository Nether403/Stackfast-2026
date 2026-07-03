import { defineConfig } from 'vite';
import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'node:path';

// Register the Sentry source-map upload plugin only when all four build-time
// credentials are present (R7.2, R7.6). When any are missing the plugin is
// omitted entirely so local/CI builds run cleanly without Sentry config —
// source maps are still emitted locally via `build.sourcemap: true` below.
function sentryPlugins(): PluginOption[] {
  const dsn = process.env.SENTRY_DSN;
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT_WEB;

  if (!dsn || !authToken || !org || !project) {
    return [];
  }

  // `@sentry/vite-plugin` is built against its own pinned Vite types, which
  // can skew from the workspace Vite's `Plugin` type under pnpm. The plugin is
  // runtime-compatible, so cast to the local `PluginOption` to keep tsc happy.
  const plugin = sentryVitePlugin({
    org,
    project,
    authToken,
    release: {
      name: process.env.VITE_APP_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA,
    },
  }) as unknown as PluginOption;

  return [plugin];
}

export default defineConfig({
  plugins: [react(), ...sentryPlugins()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Proxy API calls during dev so the browser sees a same-origin request
    // and cookies from /api/auth/* flow naturally without CORS round-trips.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
  },
  worker: {
    format: 'es',
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
