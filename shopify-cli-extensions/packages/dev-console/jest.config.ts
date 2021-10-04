import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',

  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true,
    },
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  testEnvironment: 'jsdom',

  moduleNameMapper: {
    'tests/(.*)': '<rootDir>/tests/$1',
  },

  moduleDirectories: ['node_modules', 'src'],

  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};

export default config;
