import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow underscore-prefixed args/vars to be intentionally unused. This
      // is the common TS convention for "I know I'm not using this, but the
      // signature requires it" — e.g., interface implementations.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/.svelte-kit/**',
      '**/.output/**',
      '**/.nuxt/**'
    ]
  }
);
