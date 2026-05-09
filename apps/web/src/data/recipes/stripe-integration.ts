import type { ExportRecipe, Tool } from '@/types';

/**
 * Stripe integration recipe
 * Adds Stripe payment processing with webhooks
 */
export const stripeIntegrationRecipe: ExportRecipe = {
  id: 'stripe-integration',
  version: '1.0.0',
  
  appliesWhen: (tools: Tool[]) => {
    return tools.some(t => t.id === 'stripe');
  },
  
  targets: {
    packageJson: {
      deps: {
        'stripe': '^14.21.0',
      },
      devDeps: {},
      scripts: {},
    },
    
    files: [
      {
        path: 'lib/stripe.ts',
        templateId: 'stripe-client',
        mergeStrategy: 'create',
      },
      {
        path: 'app/api/webhooks/stripe/route.ts',
        templateId: 'stripe-webhook',
        mergeStrategy: 'create',
      },
    ],
    
    env: {
      example: {
        'STRIPE_SECRET_KEY': 'sk_test_...',
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': 'pk_test_...',
        'STRIPE_WEBHOOK_SECRET': 'whsec_...',
      },
      notes: [
        'Get your Stripe API keys from https://dashboard.stripe.com/apikeys',
        'Set up webhook endpoint in Stripe dashboard for local testing use Stripe CLI',
      ],
    },
    
    postInstallSteps: [
      'Install Stripe CLI: https://stripe.com/docs/stripe-cli',
      'Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` for local testing',
    ],
    
    docsLinks: [
      'https://stripe.com/docs/api',
      'https://stripe.com/docs/webhooks',
    ],
    
    readme: {
      intro: 'This project uses Stripe for payment processing.',
    },
  },
};
