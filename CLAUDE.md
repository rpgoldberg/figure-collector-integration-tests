# Integration Tests Service Claude Configuration

## Technology Stack
- Jest
- Docker Compose
- Cross-Service Testing
- Service Health Checking
- End-to-End Workflow Testing

## Service-Specific Testing Approaches

### Testing Configurations
- Docker-based integration environment
- Cross-service communication validation
- Service health and connectivity tests
- Workflow simulation
- Coverage collection across services

### Test Modes
- Service Integration Tests
- End-to-End Workflow Tests
- Health Connectivity Checks
- Performance and Resilience Testing

## Development Workflow

### Key Development Commands
- `npm run test:integration`: Run all integration tests
- `npm run test:e2e`: Run end-to-end workflows
- `npm run test:health`: Validate service health
- `npm run docker:test`: Spin up test environment
- `npm run coverage:collect`: Aggregate test coverage

## Available Sub-Agents

### Atomic Task Agents (Haiku Model)
- **`test-generator-integration`**: Docker-based integration test generation
  - Multi-service health checking and startup validation
  - Inter-service API communication testing
  - End-to-end user workflow validation
  - Database integration and data consistency testing
  
- **`documentation-manager`**: Documentation synchronization specialist
  - Updates README and integration docs after code changes
  - Maintains documentation accuracy
  - Synchronizes docs with code modifications
  
- **`validation-gates`**: Testing and validation specialist
  - Runs comprehensive test suites
  - Validates code quality gates
  - Iterates on fixes until all tests pass
  - Ensures production readiness

## Agent Invocation Instructions

### Manual Orchestration Pattern (Required)
Use TodoWrite to plan tasks, then call sub-agents directly with proper Haiku configuration:

```
Task:
subagent_type: test-generator-integration
description: Generate comprehensive integration tests
prompt:
MODEL_OVERRIDE: claude-3-haiku-20240307
AGENT_MODEL: haiku

ATOMIC TASK: Create comprehensive integration test suite for all services

REQUIREMENTS:
- Generate tests for service health and communication
- Test end-to-end user workflows
- Validate data consistency across services
- Achieve comprehensive integration coverage
- Follow Docker orchestration patterns

Start with: I am using claude-3-haiku-20240307 to generate comprehensive integration tests.
```

### Post-Implementation Validation
Always call validation-gates after implementing features:

```
Task:
subagent_type: validation-gates
description: Validate integration test implementation
prompt:
MODEL_OVERRIDE: claude-3-haiku-20240307

ATOMIC TASK: Validate all tests pass and quality gates are met

FEATURES IMPLEMENTED: [Specify what was implemented]
VALIDATION NEEDED: Run integration tests, check coverage, ensure quality

Start with: I am using claude-3-haiku-20240307 to validate implementation quality.
```

### Documentation Updates
Call documentation-manager after code changes:

```
Task:
subagent_type: documentation-manager  
description: Update documentation after changes
prompt:
MODEL_OVERRIDE: claude-3-haiku-20240307

ATOMIC TASK: Synchronize documentation with code changes

FILES CHANGED: [List of modified files]
CHANGES MADE: [Brief description of changes]

Start with: I am using claude-3-haiku-20240307 to update documentation.
```

## Integration Test Example
```typescript
describe('Backend-Scraper Integration', () => {
  it('successfully communicates and exchanges data', async () => {
    const backendResponse = await testBackendScrapeIntegration();
    expect(backendResponse).toHaveProperty('scraped_data');
    expect(backendResponse.status).toBe('success');
  });
});
```

## Atomic Task Principles
- Isolate individual integration scenarios
- Test specific cross-service interactions
- Validate service health and readiness
- Simulate complex user workflows
- Ensure robust inter-service communication

## File Structure

```
.claude/
├── agents/
│   ├── test-generator-integration.md
│   ├── documentation-manager.md
│   └── validation-gates.md
└── commands/
    └── primer.md
```

## Quality Assurance Workflow

1. **Implementation**: Write code changes
2. **Testing**: Call `test-generator-integration` if new tests needed
3. **Validation**: Call `validation-gates` to ensure quality
4. **Documentation**: Call `documentation-manager` to update docs
5. **Verification**: Confirm all tests pass and docs are current