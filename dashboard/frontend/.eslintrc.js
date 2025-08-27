module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-var-requires': 'error',
    
    // React rules
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    
    // General rules
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  },
};
