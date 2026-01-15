# Quickstart: Running Tests Locally

**Feature**: 008-automated-testing
**Date**: 2026-01-15

## Prerequisites

- Node.js 20.x LTS installed
- npm 10.x installed
- Bash shell (Git Bash on Windows, native on Linux/macOS)
- BATS core installed (for shell tests)

## Step 1: Install Dependencies

```bash
# From repository root
npm install

# Verify Jest installed
npx jest --version
```

**Expected**: Jest version 29.x.x displayed

## Step 2: Run Unit Tests

```bash
# Run all Jest tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/unit/server.test.js

# Run in watch mode (development)
npm run test:watch
```

**Expected**: All tests pass with ≥80% coverage

## Step 3: Install BATS (Shell Testing)

### Linux/macOS

```bash
# Using npm (recommended)
npm install -g bats

# Or via package manager
# macOS: brew install bats-core
# Ubuntu: apt-get install bats
```

### Windows (Git Bash)

```bash
# Clone bats-core
git clone https://github.com/bats-core/bats-core.git
cd bats-core
./install.sh /usr/local
```

**Expected**: `bats --version` returns 1.10.x or higher

## Step 4: Install BATS Libraries

```bash
# From repository root
git clone https://github.com/bats-core/bats-support tests/scripts/test_helper/bats-support
git clone https://github.com/bats-core/bats-assert tests/scripts/test_helper/bats-assert
git clone https://github.com/jasonkarns/bats-mock tests/scripts/test_helper/bats-mock
```

**Note**: These are included as git submodules in CI but may need manual setup locally.

## Step 5: Run Shell Tests

```bash
# Run all BATS tests
bats tests/scripts/

# Run specific test file
bats tests/scripts/check-auth.bats

# Verbose output
bats --verbose-run tests/scripts/
```

**Expected**: All shell tests pass (TAP format output)

## Step 6: View Coverage Report

```bash
# Generate HTML coverage report
npm run test:coverage

# Open report in browser
# Windows:
start coverage/lcov-report/index.html

# macOS:
open coverage/lcov-report/index.html

# Linux:
xdg-open coverage/lcov-report/index.html
```

**Expected**: Coverage report shows ≥80% for all metrics

## Step 7: Run All Tests (Full Suite)

```bash
# Combined test command
npm run test:all

# Or manually:
npm test && bats tests/scripts/
```

**Expected**: All unit and shell tests pass

## Troubleshooting

### Tests Fail with "Cannot find module"

```bash
# Ensure dependencies installed
npm install
```

### BATS Command Not Found

```bash
# Check PATH
which bats

# Install via npm if missing
npm install -g bats
```

### Coverage Below Threshold

1. Check uncovered lines in `coverage/lcov-report/index.html`
2. Add tests for uncovered branches
3. Run `npm run test:coverage` again

### Shell Tests Fail on Windows

- Use Git Bash, not PowerShell or cmd
- Ensure line endings are LF (not CRLF)
- Check BATS helper libraries are installed

## npm Scripts Reference

| Script | Command | Purpose |
|--------|---------|---------|
| `npm test` | `jest --coverage` | Run unit tests with coverage |
| `npm run test:unit` | `jest tests/unit/` | Run unit tests only |
| `npm run test:integration` | `jest tests/integration/` | Run integration tests only |
| `npm run test:watch` | `jest --watch` | Run in watch mode |
| `npm run test:scripts` | `bats tests/scripts/` | Run BATS shell tests |
| `npm run test:all` | `npm run test && npm run test:scripts` | Full test suite |

## CI/CD Integration

Tests run automatically on:
- Push to any branch
- Pull request creation/update

View results in GitHub Actions tab of the repository.

## Verification Checklist

- [ ] `npm install` completes without errors
- [ ] `npm test` passes all tests
- [ ] Coverage report shows ≥80%
- [ ] `bats --version` returns 1.10.x+
- [ ] `bats tests/scripts/` passes all tests
