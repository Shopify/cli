export default {
  preset: 'vite-jest',

  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true,
    },
  },

  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  testEnvironment: 'jsdom',

  moduleNameMapper: {
    'tests/(.*)': '<rootDir>/tests/$1',
  },

  moduleDirectories: ['node_modules', 'src'],

  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  }
};
