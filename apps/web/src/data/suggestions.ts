import type { Tool, Suggestion, CategoryId } from '@/types';

/**
 * Suggestion rule interface
 * Each rule has a condition function and a generate function
 */
export interface SuggestionRule {
  id: string;
  condition: (selections: Tool[]) => boolean;
  generate: (selections: Tool[], allTools: Tool[]) => Suggestion | null;
}

/**
 * Helper function to check if a tool with given category is selected
 */
function hasToolInCategory(selections: Tool[], categoryId: CategoryId): boolean {
  return selections.some((t) => t.categoryId === categoryId);
}

/**
 * Helper function to find a tool by ID
 */
function findToolById(tools: Tool[], toolId: string): Tool | undefined {
  return tools.find((t) => t.id === toolId);
}



/**
 * Rule 1: Frontend → Database
 * When user selects a frontend framework, suggest adding a database
 */
const frontendToDatabaseRule: SuggestionRule = {
  id: 'frontend-to-database',
  condition: (selections) => {
    return (
      hasToolInCategory(selections, 'frontend') &&
      !hasToolInCategory(selections, 'database')
    );
  },
  generate: (_selections, allTools) => {
    // Suggest Postgres as the default database
    const postgres = findToolById(allTools, 'postgres');
    
    return {
      id: 'suggest-database',
      priority: 'high',
      reason: 'Most web applications need data storage',
      targetCategoryId: 'database',
      suggestedToolId: postgres?.id,
      action: 'select-tool',
    };
  },
};

/**
 * Rule 2: Database → ORM
 * When user selects a database, suggest adding a matching ORM
 */
const databaseToOrmRule: SuggestionRule = {
  id: 'database-to-orm',
  condition: (selections) => {
    return (
      hasToolInCategory(selections, 'database') &&
      !hasToolInCategory(selections, 'orm')
    );
  },
  generate: (selections, allTools) => {
    const db = selections.find((t) => t.categoryId === 'database');
    if (!db) return null;

    // Find an ORM that supports this database
    // Safety check: ensure supports.dbs exists and is an array
    const matchingOrm = allTools.find((t) => {
      if (t.categoryId !== 'orm') return false;
      if (!t.supports?.dbs || !Array.isArray(t.supports.dbs)) return false;
      return t.supports.dbs.includes(db.id as 'postgres' | 'mysql' | 'sqlite' | 'mongodb');
    });

    // Default to Prisma if no specific match found
    const suggestedOrm = matchingOrm || findToolById(allTools, 'prisma');

    return {
      id: 'suggest-orm',
      priority: 'high',
      reason: `You need an ORM to work with ${db.name}`,
      targetCategoryId: 'orm',
      suggestedToolId: suggestedOrm?.id,
      action: 'select-tool',
    };
  },
};

/**
 * Rule 3: Next.js → Vercel
 * When user selects Next.js, suggest Vercel for hosting
 */
const nextjsToVercelRule: SuggestionRule = {
  id: 'nextjs-to-vercel',
  condition: (selections) => {
    return (
      selections.some((t) => t.id === 'nextjs') &&
      !hasToolInCategory(selections, 'hosting')
    );
  },
  generate: (_selections, allTools) => {
    const vercel = findToolById(allTools, 'vercel');

    return {
      id: 'suggest-vercel',
      priority: 'high',
      reason: 'First-class adapter and build pipeline',
      targetCategoryId: 'hosting',
      suggestedToolId: vercel?.id,
      action: 'select-tool',
    };
  },
};

/**
 * Rule 4: Next.js → Tailwind
 * When user selects Next.js, suggest Tailwind CSS for styling
 */
const nextjsToTailwindRule: SuggestionRule = {
  id: 'nextjs-to-tailwind',
  condition: (selections) => {
    return (
      selections.some((t) => t.id === 'nextjs') &&
      !hasToolInCategory(selections, 'styling')
    );
  },
  generate: (_selections, allTools) => {
    const tailwind = findToolById(allTools, 'tailwind');

    return {
      id: 'suggest-tailwind',
      priority: 'medium',
      reason: 'Next.js works great with Tailwind CSS',
      targetCategoryId: 'styling',
      suggestedToolId: tailwind?.id,
      action: 'select-tool',
    };
  },
};

/**
 * Rule 5: Auth + Database → Payments
 * When user has both auth and database, suggest adding payments
 */
const authDatabaseToPaymentsRule: SuggestionRule = {
  id: 'auth-database-to-payments',
  condition: (selections) => {
    return (
      hasToolInCategory(selections, 'auth') &&
      hasToolInCategory(selections, 'database') &&
      !hasToolInCategory(selections, 'payments')
    );
  },
  generate: () => {
    return {
      id: 'suggest-payments',
      priority: 'medium',
      reason: 'Most apps with user accounts monetize through payments',
      targetCategoryId: 'payments',
      action: 'expand-category',
    };
  },
};

/**
 * All suggestion rules in priority order
 * Rules are evaluated in order, and all matching rules generate suggestions
 */
export const suggestionRules: SuggestionRule[] = [
  frontendToDatabaseRule,
  databaseToOrmRule,
  nextjsToVercelRule,
  nextjsToTailwindRule,
  authDatabaseToPaymentsRule,
];

/**
 * Generate suggestions based on current tool selections
 * @param selections - Currently selected tools
 * @param allTools - All available tools from catalog
 * @returns Array of suggestions
 */
export function generateSuggestions(
  selections: Tool[],
  allTools: Tool[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const rule of suggestionRules) {
    try {
      // Check if rule condition is met
      if (rule.condition(selections)) {
        // Generate suggestion
        const suggestion = rule.generate(selections, allTools);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    } catch (error) {
      // Log error but continue with other rules
      console.error(`Error in suggestion rule ${rule.id}:`, error);
    }
  }

  return suggestions;
}
