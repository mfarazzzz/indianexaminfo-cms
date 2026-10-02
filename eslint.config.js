// @ts-check
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * Flat ESLint config for the CMS (ESLint 9). The lint step previously used the
 * removed `--ext` flag with no config file, so CI's `npm run lint` could never
 * actually run. This wires the three rule sets the repo already depends on:
 * typescript-eslint (recommended, non-type-checked) + react-hooks + react-refresh.
 *
 * Notes on scope:
 *  - Ignores build/test artifacts and the Deno edge functions (different runtime).
 *  - Rules are attached via `files: ['**\/*.{ts,tsx}']`, so plain `.mjs` scripts
 *    and this config file are not pulled into the browser/React rule set.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      'qa/',
      'supabase/functions/', // Deno edge functions — not browser TypeScript
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ── Downgraded to warnings so the gate reports without blocking deploys ──
      // 381 findings across 116 files is far too many to mass-fix in this change
      // (owner rule: >25 ⇒ warn + list counts, defer cleanup to a hygiene pass).
      // Counts at first run: no-explicit-any 244, no-unused-vars 113,
      // no-empty-object-type 6, rules-of-hooks 4, prefer-const 2,
      // no-unused-expressions 1, no-require-imports 1, no-empty 1,
      // no-useless-escape 1. Correctness-sensitive (rules-of-hooks) is listed
      // here too only to unblock CI — flagged for the hygiene pass, not excused.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'prefer-const': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
    },
  },
)
