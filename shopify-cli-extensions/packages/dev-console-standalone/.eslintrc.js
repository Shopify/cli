module.exports = {
  rules: {
    // Be careful using {}. We need it because it's common to do React.PropsWithChildren<{}>
    // https://github.com/typescript-eslint/typescript-eslint/issues/2063#issuecomment-675156492
    '@typescript-eslint/ban-types': [
      'error',
      {
        extendDefaults: true,
        types: {
          '{}': false,
        },
      },
    ],
  },
};
