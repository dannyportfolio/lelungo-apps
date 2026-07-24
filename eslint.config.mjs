import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const hydrationSafetyRestrictions = [
  {
    selector: "CallExpression[callee.property.name='toLocaleString']",
    message:
      'Do not use toLocaleString() directly as it causes hydration mismatches across different locales. Use utility formatters from src/lib/format.ts instead.',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      'Do not use Date.now() directly in components as it causes hydration mismatches. Use a hydration guard or pass it from a stable source.',
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message:
      'Do not use Math.random() directly in components as it causes hydration mismatches. Use a hydration guard or generate it after mounting.',
  },
];

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      'no-restricted-syntax': ['error', ...hydrationSafetyRestrictions],
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];

export default eslintConfig;
