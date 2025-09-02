# Figure Collector Services - Integration Test Architecture

## Overview

This document outlines the comprehensive inter-service integration test architecture for the Figure Collector Services project. Unlike unit tests that mock dependencies, these integration tests start all services in containers and test real HTTP communication patterns.

## Architecture Components

### Service Communication Patterns

The following inter-service communication patterns are tested:

1. **Backend → Scraper Service**
   - `POST /scrape/mfc` - MFC data scraping requests
   - Response: Scraped figure data (manufacturer, name, scale, imageUrl)

2. **Backend → Version Service** 
   - `GET /app-version` - Application version information
   - `GET /validate-versions` - Service version compatibility validation

3. **Frontend → Backend**
   - All business logic via `/api/*` routes
   - Authentication: `/api/users/login`, `/api/users/register`
   - Figure management: `/api/figures/*` endpoints
   - Search and filtering: `/api/figures/search`, `/api/figures/filter`

4. **Frontend → Backend (Service Registration)**
   - `POST /register-service` - Frontend self-registration with version info

## Test Environment Architecture

### Container Network

```
┌─────────────────────────────────────────────────────────────┐
│                    integration-network                      │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ mongodb-test │  │ version-    │  │ page-scraper     │   │
│  │ :27017       │  │ service     │  │ :3000            │   │
│  │              │  │ :3001       │  │                  │   │
│  └──────────────┘  └─────────────┘  └──────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ backend      │  │ frontend    │  │ integration-     │   │
│  │ :5050        │  │ :5051       │  │ tests            │   │
│  │              │  │             │  │                  │   │
│  └──────────────┘  └─────────────┘  └──────────────────┘   │
│                                                             │
│  ┌──────────────┐                                          │
│  │ coverage-    │                                          │
│  │ collector    │                                          │
│  │              │                                          │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
```

### Service Dependencies & Startup Order

1. **mongodb-test** - Primary database (starts first)
2. **mongodb-init** - Replica set initialization and test data
3. **version-manager** - Independent service (parallel with scraper)
4. **page-scraper** - Independent service (parallel with version-manager)
5. **backend** - Depends on: mongodb, version-manager, page-scraper
6. **frontend** - Depends on: backend
7. **integration-tests** - Depends on: all services healthy
8. **coverage-collector** - Depends on: integration-tests completion

## Test Scenarios

### 1. Service Health & Connectivity Tests

**Objective**: Verify all services start correctly and can communicate

**Test Cases**:
- Health endpoint accessibility for all services
- Network connectivity between containers
- Database connection and initialization
- Service registration completion

### 2. Backend → Scraper Integration Tests

**Objective**: Test real MFC scraping workflow

**Test Scenarios**:
```javascript
describe('Backend → Scraper Integration', () => {
  test('Complete MFC scraping workflow', async () => {
    // 1. Backend receives figure creation request with MFC URL
    // 2. Backend calls scraper service at /scrape/mfc
    // 3. Scraper returns structured data
    // 4. Backend saves figure with scraped data
    // 5. Verify figure was created with correct scraped fields
  });

  test('Scraper service error handling', async () => {
    // 1. Backend calls scraper with invalid MFC URL
    // 2. Scraper returns error response
    // 3. Backend handles error gracefully
    // 4. Verify appropriate error response to client
  });

  test('Scraper timeout handling', async () => {
    // 1. Simulate slow scraper response
    // 2. Verify backend timeout behavior
    // 3. Check fallback to manual data entry
  });
});
```

### 3. Backend → Version Service Integration Tests

**Objective**: Test version management and validation

**Test Scenarios**:
```javascript
describe('Backend → Version Service Integration', () => {
  test('Application version retrieval', async () => {
    // 1. Backend calls version-manager /app-version
    // 2. Version service returns application metadata
    // 3. Backend includes version in /version endpoint response
    // 4. Verify version information accuracy
  });

  test('Service version validation', async () => {
    // 1. Backend collects all service versions
    // 2. Backend calls version-manager /validate-versions
    // 3. Version service validates compatibility matrix
    // 4. Backend returns validation status
    // 5. Verify correct compatibility assessment
  });

  test('Version service unavailable handling', async () => {
    // 1. Stop version service container
    // 2. Backend attempts version operations
    // 3. Verify graceful degradation
    // 4. Check fallback version behavior
  });
});
```

### 4. Frontend → Backend Integration Tests

**Objective**: Test complete user workflows through UI and API

**Test Scenarios**:
```javascript
describe('Frontend → Backend Integration', () => {
  test('Complete user authentication workflow', async () => {
    // 1. Frontend sends registration request
    // 2. Backend creates user account
    // 3. Frontend sends login request
    // 4. Backend returns JWT token
    // 5. Frontend stores token and updates UI
    // 6. Verify authenticated state persistence
  });

  test('Figure management workflow', async () => {
    // 1. User authenticates via frontend
    // 2. Frontend fetches figure list from backend
    // 3. User creates new figure via frontend form
    // 4. Backend processes figure creation
    // 5. Frontend refreshes and shows new figure
    // 6. Verify complete CRUD operations
  });

  test('Atlas search integration', async () => {
    // 1. Frontend sends search request
    // 2. Backend executes Atlas Search query
    // 3. Backend returns structured results
    // 4. Frontend displays search results
    // 5. Verify search accuracy and performance
  });
});
```

### 5. Service Registration Integration Tests

**Objective**: Test frontend self-registration mechanism

**Test Scenarios**:
```javascript
describe('Service Registration Integration', () => {
  test('Frontend startup registration', async () => {
    // 1. Frontend container starts
    // 2. Frontend calls backend /register-service
    // 3. Backend records frontend version info
    // 4. Backend /version endpoint includes frontend
    // 5. Verify registration completion
  });

  test('Service version aggregation', async () => {
    // 1. All services start and register
    // 2. Backend collects versions from all sources
    // 3. Backend calls version-manager for validation
    // 4. Backend returns complete service matrix
    // 5. Verify all service versions included
  });
});
```

### 6. End-to-End Workflow Tests

**Objective**: Test complete user scenarios across all services

**Test Scenarios**:
```javascript
describe('End-to-End Workflows', () => {
  test('Complete figure collection workflow', async () => {
    // 1. User logs in via frontend
    // 2. User submits figure with MFC URL
    // 3. Backend triggers scraper service
    // 4. Scraper extracts figure data
    // 5. Backend saves figure with scraped data
    // 6. Frontend displays updated figure list
    // 7. User searches for figure
    // 8. Atlas Search returns results
    // 9. Verify complete workflow success
  });

  test('Multi-user data isolation', async () => {
    // 1. Create multiple user accounts
    // 2. Each user adds private figures
    // 3. Verify data isolation between users
    // 4. Test search scope limitation
    // 5. Verify authorization boundaries
  });
});
```

## Test Data Management

### Database Initialization

The MongoDB container includes initialization scripts:

```javascript
// /test-fixtures/mongodb-init/01-test-data.js
db = db.getSiblingDB('figure_collector_test');

// Create test users
db.users.insertMany([
  {
    username: 'testuser1',
    email: 'test1@example.com',
    password: 'hashedpassword1',
    createdAt: new Date()
  },
  {
    username: 'testuser2', 
    email: 'test2@example.com',
    password: 'hashedpassword2',
    createdAt: new Date()
  }
]);

// Create test figures for search testing
db.figures.insertMany([
  {
    manufacturer: 'Good Smile Company',
    name: 'Hatsune Miku Racing Ver.',
    scale: '1/8',
    location: 'Shelf A',
    boxNumber: 'BOX001',
    userId: ObjectId(),
    createdAt: new Date()
  }
  // ... more test data
]);
```

### Test Fixtures

Shared test data and configurations:

```
/test-fixtures/
├── mongodb-init/           # Database initialization scripts
├── mock-responses/         # HTTP response mocks for external services
├── test-users.json        # Predefined test user accounts
├── test-figures.json      # Sample figure data
├── mfc-sample-pages/      # Sample MFC HTML for scraper testing
└── version-configs/       # Version compatibility test data
```

## Error Scenarios & Resilience Testing

### Service Failure Simulation

1. **Database Connection Loss**
   - Stop MongoDB container during tests
   - Verify backend graceful handling
   - Test connection recovery

2. **Scraper Service Unavailable**
   - Stop scraper container
   - Backend should fallback to manual entry
   - Verify error messaging to frontend

3. **Version Service Outage**
   - Stop version service
   - Backend should continue with cached versions
   - Verify degraded mode operation

4. **Network Partitioning**
   - Simulate network isolation between services
   - Test timeout handling and retries
   - Verify circuit breaker patterns

## Performance & Load Testing

### Service Communication Load

```javascript
describe('Performance Integration', () => {
  test('Concurrent scraping requests', async () => {
    // 1. Submit 10 concurrent MFC scraping requests
    // 2. Verify all complete within timeout
    // 3. Check scraper service resource usage
    // 4. Validate no data corruption
  });

  test('High-frequency search operations', async () => {
    // 1. Execute 100 search requests rapidly
    // 2. Verify Atlas Search performance
    // 3. Check backend response times
    // 4. Validate search result accuracy
  });
});
```

## Security Integration Testing

### Authentication & Authorization

```javascript
describe('Security Integration', () => {
  test('JWT token propagation', async () => {
    // 1. Frontend obtains JWT from backend
    // 2. Frontend includes token in API requests
    // 3. Backend validates token for protected routes
    // 4. Verify proper authorization across services
  });

  test('Cross-service authorization', async () => {
    // 1. Test unauthorized access to service endpoints
    // 2. Verify proper 401/403 responses
    // 3. Check token expiration handling
    // 4. Test privilege escalation prevention
  });
});
```

## Test Execution Strategy

### Parallel vs Sequential Testing

- **Parallel**: Service health checks, independent feature tests
- **Sequential**: Database state-dependent tests, cleanup operations
- **Isolated**: User account creation, figure management workflows

### Test Environment Cleanup

Each test scenario includes:
1. **Setup**: Initialize required test data
2. **Execution**: Run test scenario
3. **Cleanup**: Remove test artifacts
4. **Verification**: Confirm clean state for next test

## Monitoring & Observability

### Test Execution Metrics

- Service startup times
- HTTP response times for inter-service calls
- Database operation performance
- Resource utilization during tests

### Logging Strategy

```javascript
// Centralized logging from all services
const testLogger = {
  service: 'integration-test-runner',
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'Starting backend->scraper workflow test',
  metadata: {
    testCase: 'complete-mfc-scraping-workflow',
    services: ['backend', 'scraper'],
    expectedDuration: '30s'
  }
};
```

## Coverage Collection Strategy

Coverage is collected from all services running in containers and aggregated into a comprehensive report showing inter-service integration coverage.

See [Coverage Collection Strategy](#coverage-collection-strategy) section for detailed implementation.