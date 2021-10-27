module.exports = {
  ignorePatterns: ['.eslintrc.js', '*.d.ts'],
  extends: [
    'plugin:@shopify/typescript',
    'plugin:@shopify/react',
    'plugin:@shopify/prettier',
    'plugin:@shopify/jest',
  ],
  rules: {
    // Conflicts with prettier rule
    'lines-around-comment': 'off',

    '@shopify/jsx-no-complex-expressions': 'off',

    // this is the same as in @shopify/eslint-plugins
    // except no typeParameter
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      {
        selector: 'default',
        filter: {
          match: true,
          // Allow double underscores and React UNSAFE_ (for lifecycle hooks that are to be deprecated)
          regex: '^(__|UNSAFE_).+$',
        },
        format: null,
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'interface',
        format: ['PascalCase'],
        custom: {
          regex: '^I[A-Z]',
          match: false,
        },
      },
    ],
  },
};
