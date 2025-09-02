module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test patterns
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.test.js',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/setup.ts'
  ],
  
  // Test timeout for integration tests (longer than unit tests)
  testTimeout: 180000, // 3 minutes for service coordination
  
  // Coverage configuration
  collectCoverage: false, // Collected separately from running services
  collectCoverageFrom: [
    'tests/**/*.{ts,js}',
    '!tests/**/*.d.ts',
    '!tests/node_modules/**',
    '!tests/coverage/**'
  ],
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/tests/$1',
    '^@fixtures/(.*)$': '<rootDir>/test-fixtures/$1',
    '^@utils/(.*)$': '<rootDir>/test-utilities/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.test.json'
    }]
  },
  
  // Test execution
  maxWorkers: 1, // Run tests sequentially to avoid conflicts
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  bail: 0, // Don't stop on first failure
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  
  // Timeouts optimized for Docker service startup
  slowTestThreshold: 30,
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'integration-test-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],
  
  // Environment variables for tests
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};