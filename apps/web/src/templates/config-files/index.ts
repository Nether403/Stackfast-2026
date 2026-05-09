/**
 * Config file templates registry
 */

import { generateNextConfig } from './next-config';
import { generateTsConfigNextjs } from './tsconfig-nextjs';
import { generateEslintNextjs } from './eslint-nextjs';
import { generatePrismaSchemaPostgres } from './prisma-schema-postgres';
import { generatePrismaClient } from './prisma-client';
import { generateClerkMiddleware } from './clerk-middleware';
import { generateClerkSignInPage } from './clerk-signin-page';
import { generateClerkSignUpPage } from './clerk-signup-page';
import { generateStripeClient } from './stripe-client';
import { generateStripeWebhook } from './stripe-webhook';
import { generateNextjsRootLayout } from './nextjs-root-layout';
import { generateNextjsHomePage } from './nextjs-home-page';

/**
 * Template generator functions mapped by template ID
 */
export const templateGenerators: Record<string, () => string> = {
  'next-config': generateNextConfig,
  'tsconfig-nextjs': generateTsConfigNextjs,
  'eslint-nextjs': generateEslintNextjs,
  'prisma-schema-postgres': generatePrismaSchemaPostgres,
  'prisma-client': generatePrismaClient,
  'clerk-middleware': generateClerkMiddleware,
  'clerk-signin-page': generateClerkSignInPage,
  'clerk-signup-page': generateClerkSignUpPage,
  'stripe-client': generateStripeClient,
  'stripe-webhook': generateStripeWebhook,
  'nextjs-root-layout': generateNextjsRootLayout,
  'nextjs-home-page': generateNextjsHomePage,
};

/**
 * Get template content by ID
 */
export function getTemplateContent(templateId: string): string {
  const generator = templateGenerators[templateId];
  if (!generator) {
    throw new Error(`Template not found: ${templateId}`);
  }
  return generator();
}
