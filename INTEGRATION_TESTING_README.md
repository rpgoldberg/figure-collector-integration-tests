# Figure Collector Services - Integration Testing

This repository contains a comprehensive inter-service integration test architecture that tests real HTTP communication between all services without mocking external calls between our own services.

## Overview

The integration test suite validates:
- **Backend → Scraper Service** communication (MFC data scraping)
- **Backend → Version Service** communication (version management and validation)
- **Frontend → Backend** communication (all business logic via API)
- **Frontend → Backend** service registration workflow
- **End-to-end user workflows** across all services
- **Error handling and resilience** across service boundaries

## Architecture

### Service Communication Patterns

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
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
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Run All Integration Tests

```bash
# Make the script executable (first time only)
chmod +x integration-test-runner.sh

# Run complete integration test suite
./integration-test-runner.sh run
```

### Development Mode

```bash
# Start all services without running tests (for manual testing)
./integration-test-runner.sh debug

# Services will be available at:
# - Frontend: http://localhost:5051
# - Backend API: http://localhost:5050
# - Scraper Service: http://localhost:3000
# - Version Service: http://localhost:3001
# - MongoDB: mongodb://localhost:27018
```

### Run Specific Tests

```bash
# Run tests matching a specific pattern
./integration-test-runner.sh test "Backend.*Scraper"

# Run only health and connectivity tests
./integration-test-runner.sh test "Health"

# Run end-to-end workflow tests
./integration-test-runner.sh test "End-to-End"
```

### View Logs and Status

```bash
# Show current service status
./integration-test-runner.sh status

# View logs for a specific service
./integration-test-runner.sh logs backend 100

# Clean up everything
./integration-test-runner.sh clean
```

## Test Suites

### 1. Health & Connectivity Tests
- Service health endpoint accessibility
- Network connectivity between containers
- Database connection and initialization
- Service registration completion

### 2. Backend → Scraper Integration
- Complete MFC scraping workflow
- Error handling for invalid URLs
- Timeout and performance testing
- Data validation and consistency

### 3. Backend → Version Service Integration
- Application version retrieval
- Service version validation
- Compatibility matrix testing
- Error resilience

### 4. Frontend → Backend Integration
- User authentication workflows
- Figure CRUD operations
- Atlas Search functionality
- Frontend service registration

### 5. End-to-End Workflows
- Complete figure collection scenarios
- Multi-user data isolation
- Service dependency chains
- Performance under load

## Test Data

### Database Initialization

The test environment includes pre-populated test data:

- **3 test users** with known credentials
- **9 test figures** with various manufacturers and scales
- **Search indices** for Atlas Search simulation
- **Database relationships** properly configured

### Test User Accounts

```javascript
const TEST_USERS = {
  USER1: {
    username: 'testuser1',
    email: 'test1@example.com',
    password: 'testpass123'
  },
  USER2: {
    username: 'testuser2', 
    email: 'test2@example.com',
    password: 'testpass123'
  },
  SEARCH_USER: {
    username: 'searchuser',
    email: 'search@example.com',
    password: 'testpass123'
  }
};
```

## Coverage Collection

Integration tests collect code coverage from all running services and generate consolidated reports.

### Coverage Reports

After running tests, coverage reports are available in:
- `./integration-test-results/coverage/index.html` - HTML report
- `./integration-test-results/coverage/lcov.info` - LCOV format
- `./integration-test-results/COVERAGE_SUMMARY.md` - Human-readable summary

### Coverage Collection Process

1. **Service Instrumentation** - Each service runs with coverage collection enabled
2. **Real-time Collection** - Coverage data collected during test execution
3. **Aggregation** - Coverage from all services merged into unified report
4. **Reporting** - Multiple report formats generated automatically

## Configuration

### Environment Variables

The integration tests can be configured via environment variables:

```bash
export BACKEND_URL=http://localhost:5050
export FRONTEND_URL=http://localhost:5051
export SCRAPER_URL=http://localhost:3000
export VERSION_SERVICE_URL=http://localhost:3001
export MONGODB_URI=mongodb://localhost:27018/figure_collector_test
export TEST_TIMEOUT=120000
export COVERAGE_ENABLED=true
```

### Docker Compose Profiles

Different testing scenarios can be run using Docker Compose profiles:

```bash
# Full integration environment
docker-compose -f docker-compose.integration.yml up

# Development environment (no tests)
docker-compose -f docker-compose.integration.yml up mongodb-test version-manager page-scraper backend frontend

# Test runner only (assumes services running)
docker-compose -f docker-compose.integration.yml up integration-tests
```

## Troubleshooting

### Common Issues

1. **Services fail to start**
   ```bash
   # Check Docker resources
   docker system df
   docker system prune
   
   # View service logs
   ./integration-test-runner.sh logs [service-name]
   ```

2. **Tests timeout**
   ```bash
   # Increase timeout in jest.integration.config.js
   testTimeout: 180000  // 3 minutes
   
   # Or set environment variable
   export TEST_TIMEOUT=180000
   ```

3. **MongoDB connection issues**
   ```bash
   # Verify MongoDB is running and accessible
   docker exec -it mongodb-integration-test mongosh --eval "db.adminCommand('ping')"
   
   # Check replica set status
   docker exec -it mongodb-integration-test mongosh --eval "rs.status()"
   ```

4. **Coverage collection fails**
   ```bash
   # Verify Docker has access to copy files
   docker cp backend-integration:/app/coverage ./test-coverage-debug/
   
   # Check coverage directory exists in containers
   docker exec -it backend-integration ls -la /app/coverage/
   ```

### Debug Mode

For debugging test failures:

```bash
# Start services in debug mode
./integration-test-runner.sh debug

# Run specific tests with verbose output
npm run test:integration -- --testNamePattern="specific test" --verbose

# Connect to running containers
docker exec -it backend-integration bash
docker exec -it mongodb-integration-test mongosh
```

### Performance Tuning

For better performance:

1. **Increase Docker resources** (Memory: 8GB+, CPU: 4+ cores)
2. **Use SSD storage** for Docker volumes
3. **Adjust test timeouts** based on hardware capabilities
4. **Run tests sequentially** to avoid resource conflicts

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
      
    - name: Run Integration Tests
      run: |
        chmod +x integration-test-runner.sh
        ./integration-test-runner.sh run
        
    - name: Upload Coverage Reports
      uses: actions/upload-artifact@v3
      with:
        name: integration-coverage
        path: integration-test-results/coverage/
        
    - name: Upload Test Results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: integration-test-results
        path: integration-test-results/
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    
    stages {
        stage('Integration Tests') {
            steps {
                sh 'chmod +x integration-test-runner.sh'
                sh './integration-test-runner.sh run'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'integration-test-results/**/*', fingerprint: true
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'integration-test-results/coverage',
                        reportFiles: 'index.html',
                        reportName: 'Integration Coverage Report'
                    ])
                }
            }
        }
    }
}
```

## Best Practices

### Test Design

1. **Atomic Tests** - Each test should be independent and cleanable
2. **Real Data Flow** - Test actual HTTP communication, not mocks
3. **User Scenarios** - Focus on complete user workflows
4. **Error Conditions** - Test error handling and recovery
5. **Performance** - Validate response times and resource usage

### Maintenance

1. **Regular Updates** - Keep test data fresh and relevant
2. **Coverage Monitoring** - Maintain high integration coverage (>80%)
3. **Performance Baselines** - Track test execution times
4. **Service Evolution** - Update tests when APIs change
5. **Documentation** - Keep test scenarios documented

### Monitoring

1. **Test Results** - Track test success rates over time
2. **Coverage Trends** - Monitor coverage improvements/regressions
3. **Performance Metrics** - Watch for performance degradations
4. **Error Patterns** - Identify recurring integration issues

## Contributing

When adding new integration tests:

1. **Follow Naming Convention** - Use descriptive test names
2. **Add Documentation** - Document new test scenarios
3. **Update Test Data** - Add required test fixtures
4. **Consider Performance** - Ensure tests complete in reasonable time
5. **Test Cleanup** - Always clean up test artifacts

## Support

For issues with integration testing:

1. **Check Logs** - Review service logs for error details
2. **Verify Environment** - Ensure all prerequisites are met
3. **Run Debug Mode** - Use debug mode for manual investigation
4. **Review Documentation** - Check architecture and setup docs
5. **Create Issues** - Report bugs with detailed reproduction steps

---

This integration test architecture provides comprehensive validation of inter-service communication and helps ensure the reliability and correctness of the Figure Collector Services ecosystem.