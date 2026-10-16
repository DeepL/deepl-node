const common = {
    preset: 'ts-jest/presets/default-esm',
    moduleNameMapper: {
        'deepl-node(.*)': '<rootDir>/src$1',
        axios: 'axios/dist/node/axios.cjs',
    },
};

const config = {
    collectCoverageFrom: ['src/*.ts', '!**/node_modules/**', '!**/tests/**'],
    projects: [
        {
            ...common,
            displayName: 'offline',
            testMatch: ['<rootDir>/tests/offline/**/*.test.ts'],
            setupFilesAfterEnv: ['<rootDir>/tests/offline/setup.ts'],
        },
        {
            ...common,
            displayName: 'realApi',
            testMatch: ['<rootDir>/tests/realApi/**/*.test.ts'],
            setupFiles: ['<rootDir>/jest.setup.js'],
        },
    ],
};
module.exports = config;
