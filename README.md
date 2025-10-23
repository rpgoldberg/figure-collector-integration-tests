# Figure Collector Services - Integration Testing

## Testing Achievements

### Test Coverage and Quality

- **Total Test Suites**: 13 suites
- **Total Tests**: 145 tests
- **Pass Rate**: 100% (145/145 tests passed)
- **Authentication Testing**: Full refactoring and comprehensive test coverage
- **Cross-Service Integration**: Validated and fully tested
- **Docker Infrastructure**: Multi-stage builds with health checks

### Testing Environment

#### Key Features
- Comprehensive test suite covering all major service interactions
- Docker Compose orchestration with 5 containerized services
- MongoDB test instance with isolated authentication
- Supports both in-memory and Atlas Search testing modes
- Enhanced WSL compatibility for consistent test runs
- SERVICE_AUTH_TOKEN security for service-to-service communication

#### Test Execution Modes
- `npm run test:integration`: Full Docker-based cross-service testing
- `npm run test:memory`: CI/CD testing with in-memory MongoDB
- `npm run test:atlas`: Local development testing with Atlas

### Testing Enhancements

- Improved TypeScript test configurations
  - Service-specific `tsconfig.test.json`
  - Relaxed TypeScript strict mode for test writing
- Added accessibility testing with jest-axe
- Standardized test coverage reporting
- Comprehensive mock configurations implemented

### Testing Strategy

Our integration testing focuses on:
1. Service interaction validation
2. Authentication and authorization checks
3. Data consistency across services
4. Performance and reliability testing

### Continuous Improvement

We continuously refine our testing approach to ensure:
- Maximum code coverage
- Robust service interactions
- Consistent performance across different environments

## Docker Compose Architecture

### Service Orchestration

The integration testing environment uses Docker Compose to orchestrate 5 services:

1. **mongodb-test** (Port 27018)
   - MongoDB with test authentication (testuser/testpass)
   - Isolated test database: `figure_collector_test`
   - Health checks with 60s start period

2. **version-manager-test** (Port 3006)
   - Lightweight version management service
   - Node 25, production stage
   - Validates cross-service compatibility

3. **scraper-test** (Port 3005)
   - Puppeteer-based web scraping service
   - Node 25, production stage with Chromium
   - Requires SYS_ADMIN capability for browser sandboxing

4. **backend-test** (Port 5055)
   - Express API with MongoDB integration
   - Node 25, production stage
   - Depends on mongodb, version-manager, scraper

5. **frontend-test** (Port 5056 mapped to 80)
   - React application served via nginx
   - Depends on backend availability
   - Proxies API requests to backend

### Multi-Stage Docker Builds

All services use multi-stage Dockerfiles with these stages:
- **base**: Common Node.js Alpine setup
- **development**: Dev dependencies and hot-reload
- **test**: All dependencies, runs test suite (for CI/CD validation)
- **builder**: Production dependencies only
- **production**: Optimized runtime image (used in integration testing)

**Key Insight**: Integration tests use **production stages** (not test stages) because they need long-running services. Test stages run `npm test` and exit, while production stages run servers indefinitely.

### Environment Variables

**SERVICE_AUTH_TOKEN**: Required for service-to-service authentication
- Backend uses it to proxy frontend registration to version-manager
- All services share: `test-service-auth-token-for-integration`
- Security pattern: Frontend → Backend → Version Manager (isolation)

**Port Mapping**:
- External ports differ from standard to avoid conflicts (e.g., 27018 vs 27017)
- Services communicate via Docker network using standard internal ports
- Test runner accesses via localhost:<external-port>

### Health Checks

All services implement Node.js-based health checks (Alpine-compatible):
```javascript
// Example: Backend health check
CMD node -e "require('http').get('http://localhost:5055/health',
  (res) => process.exit(res.statusCode === 200 ? 0 : 1))
  .on('error', () => process.exit(1))"
```

**Startup Sequence**:
1. Infrastructure services (mongodb, version-manager, scraper)
2. Core services (backend, frontend)
3. Test runner waits for all services healthy before executing tests

## Running Tests

```bash
# Full Docker-based integration tests (recommended)
npm run test:integration

# Memory-based tests (faster, CI/CD)
npm run test:memory

# Atlas-based tests (local development with real search)
npm run test:atlas

# Docker compose management
docker-compose -f docker-compose.integration.yml up -d  # Start services
docker-compose -f docker-compose.integration.yml ps     # Check status
docker-compose -f docker-compose.integration.yml logs -f backend-test  # View logs
docker-compose -f docker-compose.integration.yml down   # Stop and cleanup
```

## Troubleshooting

### Services Not Starting
```bash
# Check service health
docker-compose -f docker-compose.integration.yml ps

# View detailed logs
docker-compose -f docker-compose.integration.yml logs <service-name>

# Rebuild after Dockerfile changes
docker-compose -f docker-compose.integration.yml build --no-cache
```

### 503 Errors on Frontend Registration
- Ensure SERVICE_AUTH_TOKEN is set in docker-compose.integration.yml
- Backend requires this token to proxy registration to version-manager
- Check backend logs for "Service registration is not configured" errors

### MongoDB Connection Issues
- MongoDB uses auth by default (testuser/testpass)
- Connection string must include: `authSource=admin`
- External port is 27018 to avoid conflicts with local MongoDB

*Last Updated: January 2025*