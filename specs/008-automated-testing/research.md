# Research: Automated Testing

**Feature**: 008-automated-testing
**Date**: 2026-01-15
**Purpose**: Resolve technical decisions for test infrastructure

## Decision 1: Node.js Test Framework

**Decision**: Jest with supertest

**Rationale**:
- Jest is the de facto standard for Node.js testing with built-in mocking
- supertest integrates seamlessly with Node.js HTTP servers
- Both are actively maintained and well-documented
- Native ESM and CommonJS support in Node.js 20.x

**Alternatives Considered**:
- Mocha + Chai: More configuration required, less integrated mocking
- Vitest: Better for ESM-first projects, Jest more established
- node:test: Native but lacks ecosystem maturity

## Decision 2: Mocking spawnSync

**Decision**: Use `jest.mock('child_process')` with `mockReturnValue()`

**Rationale**:
- Jest's built-in mocking is sufficient for synchronous spawnSync calls
- No additional dependencies required
- Pattern is well-established in Node.js community

**Implementation Pattern**:
```javascript
jest.mock('child_process')
const { spawnSync } = require('child_process')

beforeEach(() => {
  jest.clearAllMocks()
})

it('handles successful Claude execution', () => {
  spawnSync.mockReturnValue({
    status: 0,
    stdout: 'Claude response here',
    stderr: '',
    signal: null
  })
  // ... test code
})
```

**Alternatives Considered**:
- Dependency injection: More invasive refactoring of server.js
- proxyquire: External dependency, Jest mocking is sufficient

## Decision 3: HTTP Server Testability

**Decision**: Modify server.js to export server without auto-starting

**Rationale**:
- supertest requires access to HTTP server instance
- Prevents port conflicts in parallel test execution
- Standard pattern in Node.js HTTP testing

**Implementation Pattern**:
```javascript
// Current: server.js auto-starts
// Change: Export server, move listen() to conditional
const server = http.createServer(handleRequest)
if (require.main === module) {
  server.listen(PORT, HOST, () => { /* ... */ })
}
module.exports = { server, handleRequest, handleRun, handleHealth }
```

**Alternatives Considered**:
- Create separate entry point: More files to maintain
- Use different ports per test: Risk of port collisions

## Decision 4: Shell Script Testing Framework

**Decision**: BATS (Bash Automated Testing System) with bats-mock

**Rationale**:
- BATS is the standard for shell script testing
- Each test runs in isolated subprocess (no pollution)
- bats-mock provides clean command stubbing with verification
- Good CI/CD integration with TAP output format

**Alternatives Considered**:
- shunit2: Less active development, fewer features
- Manual bash assertions: No structure, hard to maintain
- shellspec: Less established than BATS

## Decision 5: Mocking Claude CLI in Shell Tests

**Decision**: Create wrapper functions and use bats-mock to stub them

**Rationale**:
- "Don't mock what you don't own" - wrap external commands
- bats-mock provides argument verification
- Function export with `-f` flag is reliable in subprocesses

**Implementation Pattern**:
```bash
# In test setup
setup() {
  # Create mock claude command
  stub claude "* : echo 'mock output'"
}

teardown() {
  unstub claude
}

@test "check-auth exits 0 on success" {
  run bash check-auth.sh
  [ "$status" -eq 0 ]
}
```

**Alternatives Considered**:
- PATH manipulation: More complex, brittle
- Docker container with fake claude: Over-engineered for unit tests

## Decision 6: Coverage Reporting

**Decision**: Jest coverage with `lcov` format for CI integration

**Rationale**:
- `lcov` is widely supported by CI tools
- Can enforce coverage thresholds (≥80%)
- Integrates with GitHub PR comments via actions

**Configuration**:
```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['infra/docker/server.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: { lines: 80, branches: 80, functions: 80, statements: 80 }
  }
}
```

## Decision 7: CI/CD Pipeline

**Decision**: GitHub Actions with matrix strategy for Node.js 20.x

**Rationale**:
- Native GitHub integration (no external service)
- Runs tests on PRs automatically
- Can block merge on test failures via branch protection

**Implementation Pattern**:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - uses: bats-core/bats-action@2.0.0
        with:
          tests: tests/scripts/
```

## Decision 8: Test Directory Structure

**Decision**: Root-level `tests/` directory with subdirectories by type

**Rationale**:
- Separates test code from production code
- Clear organization by test type (unit, integration, scripts)
- Standard Node.js project convention

**Structure**:
```
tests/
├── unit/           # Jest unit tests
├── integration/    # Jest integration tests
├── scripts/        # BATS shell tests
├── mocks/          # Shared mock utilities
└── fixtures/       # Test data files
```

## Summary: Key Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| jest | Unit test runner | ^29.x |
| supertest | HTTP testing | ^6.x |
| bats-core | Shell test runner | ^1.10 |
| bats-mock | Command stubbing | ^1.x |
| bats-support | Assertion helpers | latest |
| bats-assert | Assertion library | latest |
