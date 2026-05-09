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

export const nextjsDrizzlePostgresRecipe: ExportRecipe = {
  id: "nextjs-drizzle-postgres",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) =>
    hasTool(tools, "nextjs") && hasTool(tools, "drizzle") && hasTool(tools, "postgres"),
  targets: {
    packageJson: {
      deps: {
        "@neondatabase/serverless": "^0.10.4",
        "drizzle-orm": "^0.39.3",
      },
      devDeps: { "drizzle-kit": "^0.30.4" },
      scripts: {
        "db:generate": "drizzle-kit generate",
        "db:migrate": "drizzle-kit migrate",
        "db:studio": "drizzle-kit studio",
      },
    },
    files: [
      { path: "drizzle.config.ts", templateId: "drizzle-config-postgres", mergeStrategy: "create" },
      { path: "src/db/schema.ts", templateId: "drizzle-schema", mergeStrategy: "create" },
      { path: "src/db/client.ts", templateId: "drizzle-client", mergeStrategy: "create" },
    ],
    env: {
      example: { DATABASE_URL: "postgresql://user:password@localhost:5432/mydb?sslmode=require" },
      notes: ["Use a pooled Postgres connection string for serverless deployments when available"],
    },
    postInstallSteps: ["npm run db:generate", "npm run db:migrate"],
    docsLinks: ["https://orm.drizzle.team/docs", "https://neon.tech/docs"],
    readme: { intro: "This project uses Drizzle ORM with PostgreSQL." },
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

export const nextjsNextAuthPrismaRecipe: ExportRecipe = {
  id: "nextjs-nextauth-prisma",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => hasTool(tools, "nextjs") && hasTool(tools, "nextauth") && hasTool(tools, "prisma"),
  targets: {
    packageJson: {
      deps: { "next-auth": "^4.24.11", "@auth/prisma-adapter": "^2.7.4" },
      devDeps: {},
      scripts: {},
    },
    files: [
      { path: "app/api/auth/[...nextauth]/route.ts", templateId: "nextauth-route", mergeStrategy: "create" },
      { path: "src/auth/options.ts", templateId: "nextauth-options", mergeStrategy: "create" },
    ],
    env: {
      example: {
        NEXTAUTH_URL: "http://localhost:3000",
        NEXTAUTH_SECRET: "change-me",
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
      },
      notes: ["Generate NEXTAUTH_SECRET with `openssl rand -base64 32` before production"],
    },
    postInstallSteps: ["Create a GitHub OAuth app and copy credentials into .env.local"],
    docsLinks: ["https://next-auth.js.org/getting-started/introduction"],
    readme: { intro: "This project uses NextAuth.js with a Prisma adapter." },
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

export const tailwindRecipe: ExportRecipe = {
  id: "tailwind-nextjs",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => hasTool(tools, "nextjs") && hasTool(tools, "tailwind"),
  targets: {
    packageJson: {
      deps: {},
      devDeps: {
        autoprefixer: "^10.4.20",
        postcss: "^8.4.49",
        tailwindcss: "^3.4.17",
      },
      scripts: {},
    },
    files: [
      { path: "tailwind.config.ts", templateId: "tailwind-config-nextjs", mergeStrategy: "create" },
      { path: "postcss.config.js", templateId: "postcss-config", mergeStrategy: "create" },
      { path: "app/globals.css", templateId: "tailwind-globals", mergeStrategy: "create" },
    ],
    env: { example: {}, notes: [] },
    postInstallSteps: ["Customize app/globals.css and tailwind.config.ts for your design system"],
    docsLinks: ["https://tailwindcss.com/docs/guides/nextjs"],
    readme: { intro: "This project uses Tailwind CSS for styling." },
  },
};

export const vercelRecipe: ExportRecipe = {
  id: "vercel-deployment",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => hasTool(tools, "vercel"),
  targets: {
    packageJson: { deps: {}, devDeps: {}, scripts: {} },
    files: [{ path: "vercel.json", templateId: "vercel-json", mergeStrategy: "create" }],
    env: { example: {}, notes: ["Configure production environment variables in Vercel project settings"] },
    postInstallSteps: ["Deploy with `npx vercel` or connect the repository in Vercel"],
    docsLinks: ["https://vercel.com/docs"],
    readme: { intro: "This project includes Vercel deployment defaults." },
  },
};

export const railwayRecipe: ExportRecipe = {
  id: "railway-deployment",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => hasTool(tools, "railway"),
  targets: {
    packageJson: { deps: {}, devDeps: {}, scripts: {} },
    files: [{ path: "railway.json", templateId: "railway-json", mergeStrategy: "create" }],
    env: { example: {}, notes: ["Configure service variables in Railway before deploying"] },
    postInstallSteps: ["Deploy with Railway from the dashboard or Railway CLI"],
    docsLinks: ["https://docs.railway.com"],
    readme: { intro: "This project includes Railway deployment defaults." },
  },
};

export const resendRecipe: ExportRecipe = {
  id: "resend-email",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => hasTool(tools, "resend"),
  targets: {
    packageJson: { deps: { resend: "^4.0.1" }, devDeps: {}, scripts: {} },
    files: [
      { path: "src/email/resend.ts", templateId: "resend-client", mergeStrategy: "create" },
      { path: "app/api/email/route.ts", templateId: "resend-route", mergeStrategy: "create" },
    ],
    env: {
      example: { RESEND_API_KEY: "re_...", EMAIL_FROM: "onboarding@example.com" },
      notes: ["Verify a sending domain in Resend before production use"],
    },
    postInstallSteps: ["Create a Resend API key and add it to .env.local"],
    docsLinks: ["https://resend.com/docs"],
    readme: { intro: "This project uses Resend for transactional email." },
  },
};

export const s3StorageRecipe: ExportRecipe = {
  id: "s3-storage",
  version: "1.0.0",
  appliesWhen: (tools: Tool[]) => hasTool(tools, "s3"),
  targets: {
    packageJson: { deps: { "@aws-sdk/client-s3": "^3.717.0", "@aws-sdk/s3-request-presigner": "^3.717.0" }, devDeps: {}, scripts: {} },
    files: [
      { path: "src/storage/s3.ts", templateId: "s3-client", mergeStrategy: "create" },
      { path: "app/api/uploads/presign/route.ts", templateId: "s3-presign-route", mergeStrategy: "create" },
    ],
    env: {
      example: {
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "access-key-id",
        AWS_SECRET_ACCESS_KEY: "secret-access-key",
        S3_BUCKET_NAME: "my-bucket",
      },
      notes: ["Prefer IAM roles or workload identity over long-lived AWS keys in production"],
    },
    postInstallSteps: ["Create an S3 bucket and configure CORS for browser uploads"],
    docsLinks: ["https://docs.aws.amazon.com/s3"],
    readme: { intro: "This project uses AWS S3 for object storage." },
  },
};

export const recipes: ExportRecipe[] = [
  nextjsBaseRecipe,
  nextjsPrismaPostgresRecipe,
  nextjsDrizzlePostgresRecipe,
  nextjsClerkRecipe,
  nextjsNextAuthPrismaRecipe,
  stripeIntegrationRecipe,
  tailwindRecipe,
  vercelRecipe,
  railwayRecipe,
  resendRecipe,
  s3StorageRecipe,
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
