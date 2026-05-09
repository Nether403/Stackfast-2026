/**
 * Package.json generator
 * Creates package.json with merged dependencies and scripts
 */

/**
 * Generate package.json content
 */
export function generatePackageJson(config: {
  name: string;
  version: string;
  engines?: {
    node?: string;
    bun?: string;
  };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}): string {
  const pkg = {
    name: config.name,
    version: config.version,
    private: true,
    ...(config.engines && { engines: config.engines }),
    scripts: config.scripts,
    dependencies: config.dependencies,
    devDependencies: config.devDependencies,
  };
  
  return JSON.stringify(pkg, null, 2) + '\n';
}
