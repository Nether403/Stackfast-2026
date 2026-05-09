/**
 * .env.example generator
 * Creates .env.example with all required environment variables
 */

/**
 * Generate .env.example content
 */
export function generateEnvExample(config: {
  example: Record<string, string>;
  notes: string[];
}): string {
  const lines: string[] = [];
  
  // Add header comment
  lines.push('# Environment Variables');
  lines.push('# Copy this file to .env.local and fill in your actual values');
  lines.push('');
  
  // Add notes if any
  if (config.notes.length > 0) {
    lines.push('# Notes:');
    config.notes.forEach(note => {
      lines.push(`# - ${note}`);
    });
    lines.push('');
  }
  
  // Add variables
  for (const [key, value] of Object.entries(config.example)) {
    lines.push(`${key}=${value}`);
  }
  
  return lines.join('\n') + '\n';
}
