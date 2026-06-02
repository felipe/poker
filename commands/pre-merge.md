# /pre-merge

Full verification gate before requesting human review on a PR.
Run EVERY test the project has. Do not skip anything. Do not summarize failures.

**No PR should reach Felipe unless this passes clean.**

## Usage

```
/pre-merge                  # Run against current branch
/pre-merge --branch name    # Run against a specific branch
```

## Process

### 0. Load the manifest

Check for `.pre-merge.yml` at the project root.

**If it exists:** use it as the authoritative list of stages, commands, and configuration. Follow the manifest exactly — do not auto-detect or guess.

**If it does NOT exist:** fall back to auto-detection (Step 2 below), then strongly recommend running `/build-manifest` to generate one for next time.

For **turborepo** manifests (type: turborepo):
1. Run `preflight` commands if defined
2. Run `shared_stages` first (whole-repo checks like turbo typecheck, turbo lint)
3. Then run each `output` in order, `cd`-ing into its `path` for per-output stages
4. Finish with `shared_post_stages` if defined
5. Run `postflight` commands if defined
6. Run `gates` if defined
7. All outputs must pass for the gate to pass

### 1. Run preflight

If the manifest defines a `preflight` section, run each command in order before any stages:

```bash
# Example preflight commands:
yarn install
yarn clean
npx prisma generate
```

Preflight commands must all succeed. If any fails, stop — the environment is not ready for testing.

### 2. Detect the test landscape (fallback only)

> Skip this step if a manifest was loaded in Step 0.

Discover everything this project can run:

```bash
# Package scripts
cat package.json | grep -E '"(test|e2e|playwright|cypress|lint|typecheck|check|build)"'

# Config files
ls vitest.config.* jest.config.* playwright.config.* cypress.config.* .eslintrc* tsconfig.json 2>/dev/null

# Test directories
ls -d tests/ __tests__/ e2e/ test/ playwright/ cypress/ 2>/dev/null
```

Build a checklist of everything found. Nothing gets skipped.

### 3. Run stages in order

For each enabled stage, run sequentially.

**With manifest:** use the `command` field exactly as specified. If a stage is enabled but has no `command`, that's an error — report it and stop.

**Without manifest (auto-detection fallback):** use these defaults:

**typecheck:**
```bash
npx tsc --noEmit
```
If the project uses TypeScript, this must pass. Show the output.

**lint:**
```bash
npm run lint 2>/dev/null || npx eslint . 2>/dev/null
```
If a linter is configured, it must pass. Show the output.

**unit** (unit and integration tests):
```bash
npm test -- --run
```
Must pass. Show pass/fail counts. Show any failures in full.

**integration** (separate integration tests):
```bash
# Only if manifest specifies. May need services started first.
# Check manifest for needs_services / services / teardown keys.
```

**e2e** (Playwright / Cypress):
```bash
# Playwright
npx playwright install --with-deps 2>/dev/null
npx playwright test

# Cypress
npx cypress run

# Custom e2e script
npm run e2e 2>/dev/null
npm run test:e2e 2>/dev/null
```
If the manifest specifies `needs_server: true`, start the dev server first:
```bash
$SERVER_COMMAND &
DEV_PID=$!
npx wait-on $SERVER_URL --timeout ${SERVER_TIMEOUT:-30000}
# ... run tests ...
kill $DEV_PID
```

**build:**
```bash
# Use manifest command, or fall back:
npm run build
```
Must succeed. Report output size if possible. If `output_dir` is specified in the manifest, verify it exists after build.

**deploy_check** (dry-run deploy validation):
```bash
# Only if manifest specifies.
# e.g., wrangler deploy --dry-run
```

**visual** (screenshot verification):
If enabled and the project has a frontend, take screenshots of URLs listed in the manifest:
```bash
npx playwright screenshot $URL pre-merge-screenshot.png
```
Attach screenshots for human review.

**security:**
Use the audit command matching the manifest's `package_manager`:
```bash
# npm
npm audit --audit-level=high 2>/dev/null
# yarn
yarn audit --level high 2>/dev/null
# pnpm
pnpm audit --audit-level=high 2>/dev/null
```
If `allow_failure: true` in manifest, report but do not fail the gate.

### 4. Stop on first failure

**Stop at the first failing stage.** Do not run later stages if an earlier one fails. Fix forward or report the failure.

Exception: stages with `allow_failure: true` report warnings but do not stop the pipeline.

### 5. Run postflight

If the manifest defines a `postflight` section, run each command after all stages pass:

```bash
# Example postflight commands:
yarn coverage:report
bash ./scripts/validate-contracts.sh
```

Postflight failures are reported as warnings — they do not block the gate, but are included in the report.

### 6. Run gates

If the manifest defines `gates`, run each gate independently (gates do not block each other):

```bash
# Example gates:
npm run coverage --check     # Coverage above threshold
npm run docs:verify           # API contract docs in sync
```

Each gate produces a PASS or FAIL. **All gates must pass** for the PR to be ready. Unlike stages, gates run independently — a failing gate does not skip other gates.

### 7. Report

Include `context.watchers` in the report header if defined in the manifest.

All checks must be accounted for. Use this format:

```
PRE-MERGE GATE — {branch name}
Watchers: {context.watchers, if defined}

PREFLIGHT:
  [PASS] yarn install
  [PASS] yarn clean

STAGES:
  [PASS] Type check — clean
  [PASS] Lint — 0 warnings
  [PASS] Unit tests — 47/47 passed
  [PASS] E2E tests — 12/12 passed
  [PASS] Build — succeeded (2.1MB)
  [PASS] Visual — screenshots attached
  [WARN] Security audit — 2 moderate vulnerabilities (non-blocking)

POSTFLIGHT:
  [PASS] yarn coverage:report

GATES:
  [PASS] coverage — Coverage above threshold
---
RESULT: READY FOR REVIEW
```

Or if anything fails:

```
PRE-MERGE GATE — {branch name}
Watchers: Felipe

PREFLIGHT:
  [PASS] yarn install

STAGES:
  [PASS] Type check — clean
  [PASS] Lint — 0 warnings
  [FAIL] Unit tests — 45/47 passed, 2 failed
    FAILED: src/utils/format.test.ts > formatCurrency > handles negative values
      Expected: "-$5.00"
      Received: "$-5.00"
    FAILED: src/api/users.test.ts > getUser > returns 404 for missing user
      TypeError: Cannot read property 'id' of undefined
  [SKIP] E2E tests — skipped (unit tests failed)
  [SKIP] Build — skipped (unit tests failed)
  [SKIP] Gates — skipped (stages failed)
---
RESULT: NOT READY — 2 test failures must be fixed
```

For **turborepo** projects:

```
PRE-MERGE GATE — {branch name}
Watchers: Felipe

PREFLIGHT:
  [PASS] yarn install

SHARED:
  [PASS] Type check — turbo typecheck clean
  [PASS] Lint — turbo lint clean

OUTPUT: web (apps/web)
  [PASS] Unit tests — 23/23 passed
  [PASS] Build — succeeded (1.8MB)

OUTPUT: api (apps/api)
  [PASS] Unit tests — 14/14 passed
  [PASS] Build — wrangler dry-run succeeded

POST:
  [WARN] Security audit — 1 moderate vulnerability (non-blocking)

POSTFLIGHT:
  [PASS] yarn coverage:report

GATES:
  [PASS] preview — Preview deployment succeeds
---
RESULT: READY FOR REVIEW
```

If no preflight, postflight, or gates are defined, omit those sections from the report.

**NEVER mark a PR as ready if any check fails.** Show the actual errors. Either fix them or flag them for Felipe.

## No manifest? Recommend one.

If the project has no `.pre-merge.yml`, append this to the report:

```
NOTE: No .pre-merge.yml found. This run used auto-detection.
Run /build-manifest to generate a manifest and make future runs deterministic.
```
