/**
 * useExport hook
 * Handles export generation and download
 */

import { useState, useCallback } from 'react';
import type { Tool, Diagnostic, ExportData, ExportFormat } from '@/types';
import { generateExport } from '@/lib/export-generator';
import { generateArchive, downloadArchive } from '@/lib/archive-generator';

export interface UseExportResult {
  exportData: ExportData | null;
  isGenerating: boolean;
  error: string | null;
  generateExportData: (
    tools: Tool[],
    diagnostics: Diagnostic[],
    format?: ExportFormat
  ) => Promise<void>;
  downloadExport: (projectName?: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing export generation and download
 */
export function useExport(): UseExportResult {
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateExportData = useCallback(
    async (
      tools: Tool[],
      diagnostics: Diagnostic[],
      format: ExportFormat = 'zip'
    ) => {
      setIsGenerating(true);
      setError(null);

      try {
        const data = await generateExport(tools, diagnostics, format);
        setExportData(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate export';
        setError(errorMessage);
        setExportData(null);
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const downloadExport = useCallback(
    async (projectName?: string) => {
      if (!exportData) {
        setError('No export data available');
        return;
      }

      setIsGenerating(true);
      setError(null);

      try {
        // Extract project name from package.json if not provided
        const name =
          projectName ||
          (() => {
            const pkgFile = exportData.files.find(f => f.path === 'package.json');
            if (pkgFile) {
              try {
                const pkg = JSON.parse(pkgFile.content);
                return pkg.name;
              } catch {
                return 'stackfast-app';
              }
            }
            return 'stackfast-app';
          })();

        const blob = await generateArchive(exportData.files, exportData.format, name);
        downloadArchive(blob, `${name}.${exportData.format}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to download export';
        setError(errorMessage);
      } finally {
        setIsGenerating(false);
      }
    },
    [exportData]
  );

  const reset = useCallback(() => {
    setExportData(null);
    setIsGenerating(false);
    setError(null);
  }, []);

  return {
    exportData,
    isGenerating,
    error,
    generateExportData,
    downloadExport,
    reset,
  };
}
