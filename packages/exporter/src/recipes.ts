import type { ExportRecipe, Tool } from "@stackfast/schemas";

export const nextjsBaseRecipe: ExportRecipe = {
  id: "nextjs-base",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => tools.some((tool) => tool.id === "nextjs"),
  targets: {
    packageJson: {
      nameGenerator: (tools: Tool[]) => {
        const frontend = tools.find((tool) => tool.categoryId === "frontend");
        return frontend ? `${frontend.id}-app` : "stackfast-app";
      },
      engines: { node: ">=18.0.0" },
      deps: {
        next: "^14.2.0",
        react: "^18.3.0",
        "react-dom": "^18.3.0",
      },
      devDeps: {
        "@types/node": "^20.0.0",
        "@types/react": "^18.3.0",
        "@types/react-dom": "^18.3.0",
        typescript: "^5.4.0",
        eslint: "^8.57.0",
        "eslint-config-next": "^14.2.0",
      },
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
    },
    files: [
      { path: "next.config.ts", templateId: "next-config", mergeStrategy: "create" },
      { path: "tsconfig.json", templateId: "tsconfig-nextjs", mergeStrategy: "create" },
      { path: ".eslintrc.json", templateId: "eslint-nextjs", mergeStrategy: "create" },
      { path: "app/layout.tsx", templateId: "nextjs-root-layout", mergeStrategy: "create" },
      { path: "app/page.tsx", templateId: "nextjs-home-page", mergeStrategy: "create" },
    ],
    env: { example: {}, notes: [] },
    postInstallSteps: ["npm install", "npm run dev"],
    docsLinks: ["https://nextjs.org/docs"],
    readme: {
      title: "Next.js Application",
      intro: "A modern Next.js application with TypeScript.",
      includeCaveats: true,
    },
  },
};

export const nextjsPrismaPostgresRecipe: ExportRecipe = {
  id: "nextjs-prisma-postgres",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) =>
    hasTool(tools, "nextjs") && hasTool(tools, "prisma") && hasTool(tools, "postgres"),
  targets: {
    packageJson: {
      deps: { "@prisma/client": "^5.10.0" },
      devDeps: { prisma: "^5.10.0" },
      scripts: {
        "db:generate": "prisma generate",
        "db:push": "prisma db push",
        "db:migrate": "prisma migrate dev",
        "db:studio": "prisma studio",
      },
    },
    files: [
      { path: "prisma/schema.prisma", templateId: "prisma-schema-postgres", mergeStrategy: "create" },
      { path: "lib/prisma.ts", templateId: "prisma-client", mergeStrategy: "create" },
    ],
    env: {
      example: { DATABASE_URL: "postgresql://user:password@localhost:5432/mydb?schema=public" },
      notes: ["Replace DATABASE_URL with your actual PostgreSQL connection string"],
    },
    postInstallSteps: ["npm run db:generate", "npm run db:push"],
    docsLinks: ["https://www.prisma.io/docs", "https://www.postgresql.org/docs/"],
    readme: {
      intro: "This project uses Prisma ORM with PostgreSQL for database management.",
    },
  },
};

export const nextjsClerkRecipe: ExportRecipe = {
  id: "nextjs-clerk",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => hasTool(tools, "nextjs") && hasTool(tools, "clerk"),
  targets: {
    packageJson: {
      deps: { "@clerk/nextjs": "^5.0.0" },
      devDeps: {},
      scripts: {},
    },
    files: [
      { path: "middleware.ts", templateId: "clerk-middleware", mergeStrategy: "create" },
      { path: "app/sign-in/[[...sign-in]]/page.tsx", templateId: "clerk-signin-page", mergeStrategy: "create" },
      { path: "app/sign-up/[[...sign-up]]/page.tsx", templateId: "clerk-signup-page", mergeStrategy: "create" },
    ],
    env: {
      example: {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_...",
        CLERK_SECRET_KEY: "sk_test_...",
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "/",
      },
      notes: [
        "Get your Clerk API keys from https://dashboard.clerk.com",
        "Create a new application in Clerk dashboard if you haven't already",
      ],
    },
    postInstallSteps: [
      "Set up your Clerk application at https://dashboard.clerk.com",
      "Copy your API keys to .env.local",
    ],
    docsLinks: ["https://clerk.com/docs/quickstarts/nextjs"],
    readme: { intro: "This project uses Clerk for authentication and user management." },
  },
};

export const stripeIntegrationRecipe: ExportRecipe = {
  id: "stripe-integration",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => hasTool(tools, "stripe"),
  targets: {
    packageJson: {
      deps: { stripe: "^14.21.0" },
      devDeps: {},
      scripts: {},
    },
    files: [
      { path: "lib/stripe.ts", templateId: "stripe-client", mergeStrategy: "create" },
      { path: "app/api/webhooks/stripe/route.ts", templateId: "stripe-webhook", mergeStrategy: "create" },
    ],
    env: {
      example: {
        STRIPE_SECRET_KEY: "sk_test_...",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_...",
        STRIPE_WEBHOOK_SECRET: "whsec_...",
      },
      notes: [
        "Get your Stripe API keys from https://dashboard.stripe.com/apikeys",
        "Set up webhook endpoint in Stripe dashboard; for local testing use Stripe CLI",
      ],
    },
    postInstallSteps: [
      "Install Stripe CLI: https://stripe.com/docs/stripe-cli",
      "Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` for local testing",
    ],
    docsLinks: ["https://stripe.com/docs/api", "https://stripe.com/docs/webhooks"],
    readme: { intro: "This project uses Stripe for payment processing." },
  },
};

export const recipes: ExportRecipe[] = [
  nextjsBaseRecipe,
  nextjsPrismaPostgresRecipe,
  nextjsClerkRecipe,
  stripeIntegrationRecipe,
];

export function getRecipeById(id: string): ExportRecipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}

export function getApplicableRecipes(tools: Tool[]): ExportRecipe[] {
  return recipes.filter((recipe) => recipe.appliesWhen(tools));
}

function hasTool(tools: Tool[], id: string): boolean {
  return tools.some((tool) => tool.id === id);
}
