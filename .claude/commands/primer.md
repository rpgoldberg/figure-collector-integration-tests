## Figure Collector Integration Tests Primer Command

**IMPORTANT**: This is the figure-collector-integration-tests service - a Docker-based integration testing suite that validates end-to-end functionality across all Figure Collector services.

### Step 1: Service Configuration
1. Read `CLAUDE.md` for service-specific configuration and agent instructions
2. Understand this service's role as the integration validation layer for the entire Figure Collector system

### Step 2: Service Structure Analysis

**Integration Test Structure**:
- Read `jest.integration.config.js` for Jest configuration and test environment setup
- Read `docker-compose.integration.yml` for service orchestration and testing environment
- Read `setup.ts` for global test setup, service health checks, and initialization
- Review individual test files for specific integration scenarios
- Check `test-utilities/` for shared testing utilities and helpers

**Test Coverage Areas**:
- Examine `health-connectivity.test.ts` for service startup and health validation
- Review `frontend-backend-integration.test.ts` for UI-API integration
- Check `backend-scraper-integration.test.ts` for API-scraper communication
- Review `end-to-end-workflows.test.ts` for complete user journey testing
- Analyze inter-service communication patterns

**Docker Integration**:
- Review Docker Compose configuration for service orchestration
- Check service networking and communication setup
- Understand test database initialization and cleanup
- Review environment variable configuration for testing

**Test Utilities**:
- Examine shared utilities for service health checking
- Review test data management and fixtures
- Check Docker container management utilities
- Understand timing and synchronization helpers

### Step 3: Service Understanding

**Integration Testing Scope**:
- Multi-service startup and health validation
- Inter-service API communication testing
- End-to-end user workflow validation
- Database integration and data consistency
- Authentication flow across services
- Error handling and service recovery

**Service Orchestration**:
- Docker Compose based service management
- Service dependency management and startup order
- Network configuration and service discovery
- Environment isolation and test data management
- Resource cleanup and teardown procedures

**Test Execution**:
- Automated service startup and health checking
- Parallel test execution across service boundaries
- Test data initialization and cleanup
- Result aggregation and reporting
- CI/CD integration and automation

### Step 4: Available Tools and Agents

**Available Sub-Agents**:
- `test-generator-integration` (Haiku) - Docker-based integration test generation
- `documentation-manager` (Haiku) - Documentation synchronization
- `validation-gates` - Testing and validation specialist

**Development Commands**:
- `npm run test:integration` - Run full integration test suite
- `npm run test:health` - Service health check validation
- `npm run test:e2e` - End-to-end workflow testing
- `docker-compose -f docker-compose.integration.yml up` - Start test environment
- `./integration-test-runner.sh` - Complete test execution script

### Step 5: Summary Report

After analysis, provide:
- **Service Purpose**: Integration testing and validation for the entire Figure Collector system
- **Technology Stack**: Jest, Docker Compose, Node.js, service orchestration
- **Key Functionality**: Multi-service testing, health validation, end-to-end workflows
- **Test Coverage**: Service integration, API communication, user workflows, data consistency
- **Docker Integration**: Service orchestration, networking, environment management
- **Test Utilities**: Health checking, data management, timing, Docker controls
- **Integration Scenarios**: All service combinations and communication patterns
- **CI/CD Integration**: Automated testing pipeline and result reporting
- **Development Workflow**: Test environment setup, execution, and cleanup procedures

**Remember**: This service validates the entire system - comprehensive coverage of service interactions and user workflows are critical for system reliability.