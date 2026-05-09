import type { ExportRecipe, Tool } from '@/types';

/**
 * Base Next.js recipe
 * Provides core Next.js setup with TypeScript and essential dependencies
 */
export const nextjsBaseRecipe: ExportRecipe = {
  id: 'nextjs-base',
  version: '1.0.0',
  
  appliesWhen: (tools: Tool[]) => {
    return tools.some(t => t.id === 'nextjs');
  },
  
  targets: {
    packageJson: {
      nameGenerator: (tools: Tool[]) => {
        const frontend = tools.find(t => t.categoryId === 'frontend');
        return frontend ? `${frontend.id}-app` : 'stackfast-app';
      },
      engines: {
        node: '>=18.0.0',
      },
      deps: {
        'next': '^14.2.0',
        'react': '^18.3.0',
        'react-dom': '^18.3.0',
      },
      devDeps: {
        '@types/node': '^20.0.0',
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        'typescript': '^5.4.0',
        'eslint': '^8.57.0',
        'eslint-config-next': '^14.2.0',
      },
      scripts: {
        'dev': 'next dev',
        'build': 'next build',
        'start': 'next start',
        'lint': 'next lint',
      },
    },
    
    files: [
      {
        path: 'next.config.ts',
        templateId: 'next-config',
        mergeStrategy: 'create',
      },
      {
        path: 'tsconfig.json',
        templateId: 'tsconfig-nextjs',
        mergeStrategy: 'create',
      },
      {
        path: '.eslintrc.json',
        templateId: 'eslint-nextjs',
        mergeStrategy: 'create',
      },
      {
        path: 'app/layout.tsx',
        templateId: 'nextjs-root-layout',
        mergeStrategy: 'create',
      },
      {
        path: 'app/page.tsx',
        templateId: 'nextjs-home-page',
        mergeStrategy: 'create',
      },
    ],
    
    env: {
      example: {},
      notes: [],
    },
    
    postInstallSteps: [
      'npm install',
      'npm run dev',
    ],
    
    docsLinks: [
      'https://nextjs.org/docs',
    ],
    
    readme: {
      title: 'Next.js Application',
      intro: 'A modern Next.js application with TypeScript.',
      includeCaveats: true,
    },
  },
};
