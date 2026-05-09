import type { ExportRecipe, Tool } from '@/types';

/**
 * Next.js + Prisma + Postgres recipe
 * Adds Prisma ORM with PostgreSQL database configuration
 */
export const nextjsPrismaPostgresRecipe: ExportRecipe = {
  id: 'nextjs-prisma-postgres',
  version: '1.0.0',
  
  appliesWhen: (tools: Tool[]) => {
    const hasNextjs = tools.some(t => t.id === 'nextjs');
    const hasPrisma = tools.some(t => t.id === 'prisma');
    const hasPostgres = tools.some(t => t.id === 'postgres');
    return hasNextjs && hasPrisma && hasPostgres;
  },
  
  targets: {
    packageJson: {
      deps: {
        '@prisma/client': '^5.10.0',
      },
      devDeps: {
        'prisma': '^5.10.0',
      },
      scripts: {
        'db:generate': 'prisma generate',
        'db:push': 'prisma db push',
        'db:migrate': 'prisma migrate dev',
        'db:studio': 'prisma studio',
      },
    },
    
    files: [
      {
        path: 'prisma/schema.prisma',
        templateId: 'prisma-schema-postgres',
        mergeStrategy: 'create',
      },
      {
        path: 'lib/prisma.ts',
        templateId: 'prisma-client',
        mergeStrategy: 'create',
      },
    ],
    
    env: {
      example: {
        'DATABASE_URL': 'postgresql://user:password@localhost:5432/mydb?schema=public',
      },
      notes: [
        'Replace DATABASE_URL with your actual PostgreSQL connection string',
      ],
    },
    
    postInstallSteps: [
      'npm run db:generate',
      'npm run db:push',
    ],
    
    docsLinks: [
      'https://www.prisma.io/docs',
      'https://www.postgresql.org/docs/',
    ],
    
    readme: {
      intro: 'This project uses Prisma ORM with PostgreSQL for database management.',
    },
  },
};
