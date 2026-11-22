import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
      'eqeqeq': ['error', 'always'],
    },
    ignores: ['dist/', 'scripts/', 'smoke/', 'tests/'],
  }
);
