import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { ExportData, ExportFormat } from '@/types';

/**
 * Export state interface
 */
export interface ExportState {
  exportData: ExportData | null;
  isExporting: boolean;
  error: Error | null;
  format: ExportFormat;
}

/**
 * Export context value interface
 */
export interface ExportContextValue {
  exportData: ExportData | null;
  isExporting: boolean;
  error: Error | null;
  format: ExportFormat;
  setExportData: (data: ExportData | null) => void;
  setIsExporting: (isExporting: boolean) => void;
  setError: (error: Error | null) => void;
  setFormat: (format: ExportFormat) => void;
  reset: () => void;
}

/**
 * Export context
 */
const ExportContext = createContext<ExportContextValue | undefined>(undefined);

/**
 * Props for ExportProvider
 */
export interface ExportProviderProps {
  children: ReactNode;
}

/**
 * ExportProvider component
 * Manages export generation state and results
 */
export function ExportProvider({ children }: ExportProviderProps) {
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [format, setFormat] = useState<ExportFormat>('zip');

  const reset = useCallback(() => {
    setExportData(null);
    setIsExporting(false);
    setError(null);
    setFormat('zip');
  }, []);

  const value = useMemo(
    () => ({
      exportData,
      isExporting,
      error,
      format,
      setExportData,
      setIsExporting,
      setError,
      setFormat,
      reset,
    }),
    [exportData, isExporting, error, format, reset]
  );

  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

/**
 * Hook to access export context
 * @throws Error if used outside ExportProvider
 */
export function useExportContext(): ExportContextValue {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExportContext must be used within ExportProvider');
  }
  return context;
}
