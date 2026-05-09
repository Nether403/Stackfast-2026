import type { ExportRecipe, Tool } from '@/types';

/**
 * Next.js + Clerk authentication recipe
 * Adds Clerk authentication with middleware and protected routes
 */
export const nextjsClerkRecipe: ExportRecipe = {
  id: 'nextjs-clerk',
  version: '1.0.0',
  
  appliesWhen: (tools: Tool[]) => {
    const hasNextjs = tools.some(t => t.id === 'nextjs');
    const hasClerk = tools.some(t => t.id === 'clerk');
    return hasNextjs && hasClerk;
  },
  
  targets: {
    packageJson: {
      deps: {
        '@clerk/nextjs': '^5.0.0',
      },
      devDeps: {},
      scripts: {},
    },
    
    files: [
      {
        path: 'middleware.ts',
        templateId: 'clerk-middleware',
        mergeStrategy: 'create',
      },
      {
        path: 'app/sign-in/[[...sign-in]]/page.tsx',
        templateId: 'clerk-signin-page',
        mergeStrategy: 'create',
      },
      {
        path: 'app/sign-up/[[...sign-up]]/page.tsx',
        templateId: 'clerk-signup-page',
        mergeStrategy: 'create',
      },
    ],
    
    env: {
      example: {
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': 'pk_test_...',
        'CLERK_SECRET_KEY': 'sk_test_...',
        'NEXT_PUBLIC_CLERK_SIGN_IN_URL': '/sign-in',
        'NEXT_PUBLIC_CLERK_SIGN_UP_URL': '/sign-up',
        'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL': '/',
        'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL': '/',
      },
      notes: [
        'Get your Clerk API keys from https://dashboard.clerk.com',
        'Create a new application in Clerk dashboard if you haven\'t already',
      ],
    },
    
    postInstallSteps: [
      'Set up your Clerk application at https://dashboard.clerk.com',
      'Copy your API keys to .env.local',
    ],
    
    docsLinks: [
      'https://clerk.com/docs/quickstarts/nextjs',
    ],
    
    readme: {
      intro: 'This project uses Clerk for authentication and user management.',
    },
  },
};
