const { defaultsESM } = require('ts-jest/presets');

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/app'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/app/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|jpe?g|png|webp|svg)$': 'jest-transform-stub',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
