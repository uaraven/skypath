import js from '@eslint/js'
import ts from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'

export default ts.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'screenshots',
      'src/lib/catalog/data/**',
      '.svelte-kit',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // Defined via `define` in vite.config.ts, replaced at build time.
        __APP_VERSION__: 'readonly',
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    rules: {
      // Prefixing with `_` is the established way to mark an intentionally
      // unused parameter (e.g. event handlers that ignore their argument).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Formatting is Prettier's job, not the linter's.
      'no-mixed-spaces-and-tabs': 'off',
    },
  },
)
