/**
 * Recipe registry
 * Central export point for all export recipes
 */

import type { ExportRecipe } from '@/types';
import { nextjsBaseRecipe } from './nextjs-base';
import { nextjsPrismaPostgresRecipe } from './nextjs-prisma-postgres';
import { nextjsClerkRecipe } from './nextjs-clerk';
import { stripeIntegrationRecipe } from './stripe-integration';

/**
 * All available export recipes
 * Order matters for deterministic recipe application
 */
export const recipes: ExportRecipe[] = [
  // Frontend recipes
  nextjsBaseRecipe,
  
  // Database + ORM recipes
  nextjsPrismaPostgresRecipe,
  
  // Auth recipes
  nextjsClerkRecipe,
  
  // Payment recipes
  stripeIntegrationRecipe,
];

/**
 * Get recipe by ID
 */
export function getRecipeById(id: string): ExportRecipe | undefined {
  return recipes.find(r => r.id === id);
}

/**
 * Get all recipes that apply to the given tools
 */
export function getApplicableRecipes(tools: import('@/types').Tool[]): ExportRecipe[] {
  return recipes.filter(recipe => recipe.appliesWhen(tools));
}
