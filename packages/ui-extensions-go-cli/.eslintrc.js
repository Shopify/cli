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
  },
};
