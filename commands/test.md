# /test

Run tests or create new tests following project conventions.

**When creating tests: verify they actually pass before reporting.**

## Usage

```
/test                    # Run all tests
/test ComponentName      # Run tests for a specific file
/test --create filename  # Create a test file for an untested file
```

## Running Tests

```bash
# All tests
npm test -- --run

# Specific file
npm test -- {pattern} --run

# Coverage
npm run test:coverage
```

Report the actual output. Don't summarize — show pass/fail counts and any failures.

## Creating Tests

### 1. Find existing test conventions
- File naming: `*.test.ts`, `*.spec.ts`, etc.
- Location: colocated, `__tests__/`, or `tests/`
- Framework: Jest, Vitest, Playwright, etc.
- Assertion style, mock patterns

### 2. Read the source file
Understand what it does. Test the real behavior, not implementation details.

### 3. Write the test
Include:
- Happy path
- Edge cases
- Error handling
- Type checking (if TypeScript)

### 4. Verify — the test must pass

```bash
# Run just the new test
npm test -- {NewTest} --run
```

**Show the actual test output.** If it fails, fix it. Don't hand over a failing test.

```bash
# Then run ALL tests to make sure nothing broke
npm test -- --run
```

### 5. Report

```
✓ Created src/components/Button/Button.test.tsx
✓ New test passes (4 tests)
✓ All existing tests still pass (47 total)
```

**If anything fails** — show the error, fix it, re-run. Don't report a test as "created" if it doesn't pass.
