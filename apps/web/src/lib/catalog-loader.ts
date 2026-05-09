import { z } from 'zod';
import { CategorySchema, type Category } from '@/types/category';
import { ToolSchema, type Tool } from '@/types/tool';
import { RuleSchema, type Rule } from '@/types/rule';

/**
 * Manifest schema for catalog metadata
 */
const ManifestSchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  files: z.object({
    categories: z.string(),
    tools: z.string(),
    rules: z.string(),
  }),
  etag: z.string(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Complete catalog data structure
 */
export interface CatalogData {
  categories: Category[];
  tools: Tool[];
  rules: Rule[];
  manifest: Manifest;
}

/**
 * Cache key for localStorage
 */
const CACHE_KEY = 'stackfast-catalog-cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cached catalog data with timestamp
 */
interface CachedCatalog {
  data: CatalogData;
  timestamp: number;
  etag: string;
}

/**
 * Load the catalog manifest
 */
async function loadManifest(): Promise<Manifest> {
  const response = await fetch('/catalog/v1/manifest.json');
  
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.statusText}`);
  }
  
  const data = await response.json();
  const manifest = ManifestSchema.parse(data);
  
  return manifest;
}

/**
 * Load a catalog file with validation
 */
async function loadCatalogFile<T>(
  url: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return schema.parse(data);
}

/**
 * Get cached catalog data if valid
 */
function getCachedCatalog(): CatalogData | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return null;
    }
    
    const parsed: CachedCatalog = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - parsed.timestamp > CACHE_DURATION_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    console.warn('Failed to read catalog cache:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Save catalog data to cache
 */
function setCachedCatalog(data: CatalogData): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const cached: CachedCatalog = {
      data,
      timestamp: Date.now(),
      etag: data.manifest.etag,
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.warn('Failed to cache catalog:', error);
  }
}

/**
 * Load the complete catalog with caching
 * 
 * This function:
 * 1. Checks localStorage for cached data (24-hour TTL)
 * 2. If cache is valid, returns cached data
 * 3. Otherwise, fetches manifest and all catalog files in parallel
 * 4. Validates all data with Zod schemas
 * 5. Caches the result in localStorage
 * 
 * @returns Promise resolving to complete catalog data
 * @throws Error if any catalog file fails to load or validate
 */
export async function loadCatalog(): Promise<CatalogData> {
  // Try to get cached data first
  const cached = getCachedCatalog();
  if (cached) {
    console.log('Using cached catalog data');
    return cached;
  }
  
  console.log('Loading fresh catalog data');
  
  // Load manifest first
  const manifest = await loadManifest();
  
  // Load all catalog files in parallel
  const [categories, tools, rules] = await Promise.all([
    loadCatalogFile(manifest.files.categories, z.array(CategorySchema)),
    loadCatalogFile(manifest.files.tools, z.array(ToolSchema)),
    loadCatalogFile(manifest.files.rules, z.array(RuleSchema)),
  ]);
  
  const catalogData: CatalogData = {
    categories,
    tools,
    rules,
    manifest,
  };
  
  // Cache the data
  setCachedCatalog(catalogData);
  
  return catalogData;
}

/**
 * Clear the catalog cache
 * Useful for forcing a refresh or during development
 */
export function clearCatalogCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHE_KEY);
    console.log('Catalog cache cleared');
  }
}

/**
 * Check if catalog cache exists and is valid
 */
export function hasCachedCatalog(): boolean {
  return getCachedCatalog() !== null;
}
