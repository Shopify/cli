import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',

  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true,
    },
  },

  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  testEnvironment: 'jsdom',

  moduleNameMapper: {
    'tests/(.*)': '<rootDir>/tests/$1',
    '^@/(.*)': '<rootDir>/src/$1',
    '^@shopify/ui-extensions-server-kit/testing$':
      '<rootDir>/../ui-extensions-server-kit/src/testing',
    '^@shopify/ui-extensions-server-kit': '<rootDir>/../ui-extensions-server-kit/src',
  },

  moduleDirectories: ['node_modules', 'src'],

  transform: {
    '^.+\\.scss$': '<rootDir>/tests/css-transform.js',
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};

export default config;
