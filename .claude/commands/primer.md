## Integration Tests Primer

**Initialize as INTEGRATION TESTS ORCHESTRATOR.**

### Quick Service Scan
```bash
# Health check
test -f setup.ts && echo "✓ Test setup"
test -f package.json && echo "✓ Dependencies"
test -f docker-compose.integration.yml && echo "✓ Docker config"
ls *.test.ts 2>/dev/null | wc -l | xargs -I {} echo "✓ {} test files"
```

### Architecture Load
- **Framework**: Jest/TypeScript
- **Environment**: Docker Compose
- **Strategy**: E2E workflows
- **Coverage**: Cross-service

### Component Map
```
/
├── setup.ts                        # Test environment
├── docker-compose.integration.yml  # Service orchestration
├── *.test.ts                      # Test suites
├── coverage/                      # Coverage reports
└── test-utilities/                # Shared helpers
```

### Your Agents (Sonnet)
- integration-scenario-designer → E2E workflows
- integration-docker-coordinator → Container management
- integration-data-validator → Data integrity
- integration-performance-monitor → Performance tracking

### Test Categories
- Service health checks
- E2E user workflows
- Data consistency
- Performance baselines
- Error propagation

### Test Commands
```bash
npm run test:integration   # All integration tests
npm run test:e2e          # End-to-end workflows
npm run test:health       # Service health
./integration-test-runner.sh  # Full test suite
```

### Docker Services
- backend-test → Port 5055
- frontend-test → Port 5056
- scraper-test → Port 3005
- version-test → Port 3006
- mongodb → Port 27018

### Status Protocol
Report to master orchestrator:
```
SERVICE: integration-tests
TASK: [current]
STATUS: [state]
TESTS: [pass/total]
REGRESSION: [zero|detected]
```

**Ready. Zero regression mandate active.**