// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**', 'coverage/**', 'uploads/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        // Use explicit project for type-aware rules; disable projectService to avoid
        // "not found by the project service" parsing errors on unmatched files.
        projectService: false,
        project: ['./tsconfig.json'],
        // If a file isn't matched to a specific tsconfig project, fall back to the default
        // instead of throwing a parsing error. This keeps linting productive for isolated files.
        allowDefaultProject: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Ensure spec and e2e test files are attached to a TS project that includes tests
    files: ['src/**/*.spec.ts', 'src/**/*.e2e-spec.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Use explicit project for tests instead of projectService
        projectService: false,
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Mocking/spies commonly reference unbound methods in Jest tests
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  {
    rules: {
      // Pragmatic TypeScript/NestJS defaults: keep developer velocity while staying safe
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // Disable unbound-method across the codebase; NestJS patterns often pass class methods into frameworks safely
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-misused-promises': [
        'warn',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // Allow intentionally empty catch blocks (non-blocking logging/swallow)
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Make Prettier issues warnings (still auto-fixable with --fix)
      'prettier/prettier': 'warn',
    },
  },
);