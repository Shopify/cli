const config = {
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            useESM: true,
        },
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testEnvironment: 'jsdom',
    testPathIgnorePatterns: ['node_modules', 'dist'],
    moduleNameMapper: {
        'tests/(.*)': '<rootDir>/tests/$1',
    },
    moduleDirectories: ['node_modules', 'src'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
};
export default config;
//# sourceMappingURL=jest.config.js.map