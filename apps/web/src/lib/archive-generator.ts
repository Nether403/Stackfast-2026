/**
 * Archive generation for exports
 * Handles ZIP creation with lazy loading
 */

import type { ExportFile, ExportFormat } from '@/types';

/**
 * Error thrown when export fails due to missing recipes
 */
export class ExportError extends Error {
  constructor(
    message: string,
    public missingRecipes?: string[],
    public suggestion?: string
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

/**
 * Generate ZIP archive from files
 * Uses lazy-loaded JSZip to reduce initial bundle size
 */
export async function generateZipArchive(
  files: ExportFile[],
  projectName: string = 'stackfast-app'
): Promise<Blob> {
  void projectName;

  try {
    // Lazy load JSZip
    const JSZip = (await import('jszip')).default;
    
    const zip = new JSZip();
    
    // Add all files to zip
    for (const file of files) {
      zip.file(file.path, file.content);
    }
    
    // Generate zip blob
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    });
    
    return blob;
  } catch (error) {
    throw new ExportError(
      `Failed to generate ZIP archive: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate TAR archive from files (fallback)
 * For MVP, we'll just throw an error and suggest ZIP
 */
export async function generateTarArchive(
  _files: ExportFile[],
  projectName: string = 'stackfast-app'
): Promise<Blob> {
  void projectName;

  throw new ExportError(
    'TAR format is not yet supported. Please use ZIP format instead.'
  );
}

/**
 * Generate archive based on format
 */
export async function generateArchive(
  files: ExportFile[],
  format: ExportFormat,
  projectName: string = 'stackfast-app'
): Promise<Blob> {
  if (format === 'zip') {
    return generateZipArchive(files, projectName);
  } else if (format === 'tar') {
    return generateTarArchive(files, projectName);
  } else {
    throw new ExportError(`Unsupported archive format: ${format}`);
  }
}

/**
 * Download archive to user's computer
 */
export function downloadArchive(
  blob: Blob,
  filename: string
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Suggest nearest supported combination when recipes are missing
 */
export function suggestNearestCombination(
  _missingRecipes: string[],
  availableRecipes: string[]
): string {
  // For MVP, just list what's available
  if (availableRecipes.length === 0) {
    return 'No recipes are currently available. Please check the catalog.';
  }
  
  return `The following recipes are available: ${availableRecipes.join(', ')}. ` +
    `Consider selecting tools that match these recipes.`;
}
