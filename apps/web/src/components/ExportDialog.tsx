/**
 * ExportDialog component
 * Modal for exporting stack configuration with preview and download
 */

import { useState } from 'react';
import type { ExportData, ExportFormat } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSelectionsContext } from '@/context/SelectionsContext';
import { useEvaluationContext } from '@/context/EvaluationContext';
import { generateExport, generateExportAsText } from '@/lib/export-generator';
import { generateArchive, downloadArchive } from '@/lib/archive-generator';

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({
  open,
  onOpenChange,
}: ExportDialogProps) {
  // Get data from context
  const { getAllSelectedTools } = useSelectionsContext();
  const { result } = useEvaluationContext();
  
  const selectedTools = getAllSelectedTools();
  const diagnostics = result?.diagnostics ?? [];
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('zip');

  // Generate export when dialog opens
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const data = await generateExport(
        selectedTools,
        diagnostics,
        selectedFormat
      );
      setExportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate export');
    } finally {
      setIsGenerating(false);
    }
  };

  // Download as archive
  const handleDownload = async () => {
    if (!exportData) return;
    
    setIsGenerating(true);
    try {
      const projectName = exportData.files.find(f => f.path === 'package.json')
        ? JSON.parse(exportData.files.find(f => f.path === 'package.json')!.content).name
        : 'stackfast-app';
      
      const blob = await generateArchive(
        exportData.files,
        exportData.format,
        projectName
      );
      
      downloadArchive(blob, `${projectName}.${exportData.format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download archive');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy as text
  const handleCopyText = () => {
    if (!exportData) return;
    
    const text = generateExportAsText(exportData);
    navigator.clipboard.writeText(text);
  };

  // Generate on open
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen && !exportData) {
      handleGenerate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Stack Configuration</DialogTitle>
          <DialogDescription>
            Download your stack configuration as a ready-to-use project
          </DialogDescription>
        </DialogHeader>

        {isGenerating && !exportData && (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Generating export...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
            <p className="font-semibold">Export Failed</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {exportData && !error && (
          <div className="space-y-4">
            {/* Export Preview */}
            <div>
              <h3 className="font-semibold mb-2">Export Preview</h3>
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Files:</span>
                  <Badge variant="secondary">{exportData.files.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recipes:</span>
                  <Badge variant="secondary">
                    {exportData.log.appliedRecipes.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Generated:</span>
                  <span className="text-sm">
                    {new Date(exportData.meta.generatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Applied Recipes */}
            <div>
              <h3 className="font-semibold mb-2">Applied Recipes</h3>
              <div className="rounded-lg border p-4">
                <ul className="space-y-1">
                  {exportData.log.appliedRecipes.map((recipe) => (
                    <li key={recipe.id} className="text-sm">
                      <span className="font-medium">{recipe.id}</span>
                      <span className="text-muted-foreground ml-2">
                        v{recipe.version}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Warnings */}
            {exportData.log.warnings.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Warnings</h3>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <ul className="space-y-1">
                    {exportData.log.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-yellow-800">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* File List */}
            <div>
              <h3 className="font-semibold mb-2">Files</h3>
              <div className="rounded-lg border p-4 max-h-48 overflow-y-auto">
                <ul className="space-y-1">
                  {exportData.files.map((file) => (
                    <li key={file.path} className="text-sm font-mono">
                      {file.path}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <h3 className="font-semibold mb-2">Export Format</h3>
              <div className="flex gap-2">
                <Button
                  variant={selectedFormat === 'zip' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFormat('zip')}
                >
                  ZIP
                </Button>
                <Button
                  variant={selectedFormat === 'tar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFormat('tar')}
                  disabled
                >
                  TAR (Coming Soon)
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCopyText}
            disabled={!exportData || isGenerating}
          >
            Copy as Text
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!exportData || isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
