import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import localRules from './eslint-rules/chapter-boundary.js';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      // Animation must run on the engine clock (ARCHITECTURE §3) — wall-clock timers break QA determinism.
      'no-restricted-globals': [
        'error',
        { name: 'setInterval', message: 'Use the engine clock (ctx.clock / ctx.tweens), not timers.' },
      ],
    },
  },
  {
    // Chapters may only talk to the engine through ChapterContext and the public libraries.
    files: ['src/volumes/*/chapters/**/*.ts'],
    plugins: { local: localRules },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/engine/*', '!@/engine/api'],
              message: 'Chapters import engine types from "@/engine/api" and use ChapterContext services.',
            },
            { group: ['gsap', 'gsap/*'], message: 'Use ctx.tweens (engine clock bound).' },
          ],
        },
      ],
      // Replaces the old `'../*/**'` pattern, which also rejected `steps/x.ts → ../parts/y` inside one chapter.
      'local/chapter-boundary': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Use the engine clock (ctx.clock.time).' },
        { object: 'performance', property: 'now', message: 'Use the engine clock (ctx.clock.time).' },
        { object: 'window', property: 'setTimeout', message: 'Use ctx.tweens.delay().' },
        { object: 'Math', property: 'random', message: 'Use ctx.random (seeded) for deterministic QA.' },
      ],
    },
  },
  {
    // Volumes are independent of each other; platform libraries never name a volume (ARCHITECTURE §2).
    files: ['src/**/*.ts'],
    plugins: { local: localRules },
    rules: { 'local/volume-boundary': 'error' },
  },
  prettier,
);
