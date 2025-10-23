module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test patterns - only this specific test
  testMatch: [
    '<rootDir>/docker-compose-config.test.ts'
  ],

  // NO setup files - we don't need service coordination for config validation

  // Test timeout
  testTimeout: 10000,

  // No coverage needed for config validation
  collectCoverage: false,

  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.test.json'
    }]
  },

  // Test execution
  verbose: true,
  clearMocks: true,
};
