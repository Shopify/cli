/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  resetMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testRegex: ['(\\.|/).+\\.test\\.[jt]sx?$'],
  transform: {},
  globals: {
    'ts-jest': {
      useESM: true,
      isolatedModules: true,
    },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.ts$': '$1',
    '@shopify/(.*)': '<rootDir>/../$1/src/index.ts',
  },
  moduleDirectories: [
    'node_modules',
    '<rootDir>/src',
    '<rootDir>/node_modules',
  ],
  testPathIgnorePatterns: ['dist/'],
};
export default config;
