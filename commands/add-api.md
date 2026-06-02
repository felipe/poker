# /add-api

Scaffold a new API endpoint following project conventions.

**Verification required. Do not report success unless every step passes.**

## Usage

```
/add-api endpoint-name
/add-api /users/profile
```

## Process

### 1. Learn the patterns
- Check `product/tech-stack.md` for API framework
- Check `standards/` for API patterns
- Look at 2-3 existing endpoints — match their style exactly

### 2. Scaffold
Create the endpoint file following discovered patterns:
- Request/response types
- Input validation
- Error handling
- Auth middleware (if other endpoints use it)

Create a test file for the endpoint.

### 3. Verify — ALL must pass

```bash
# Read it back
cat src/api/{endpoint}.ts

# If possible, start dev server and hit the endpoint
curl -v http://localhost:3000/api/{endpoint}
```

### 4. Run the Coding Task Minimum Gates

This step is governed by the **Coding Task Minimum Gates** section of `AGENTS.md` (lint + typecheck + tests pass before the work is claimed done). A scaffolded endpoint is a code change — the gate applies.

**If the project has a `.pre-merge.yml`:** run `/pre-merge`. Every enabled stage must pass. This is the authoritative gate.

**If no `.pre-merge.yml` exists:** fall back to the project's lint + typecheck + test commands directly, and recommend running `/build-manifest` to generate one.

```bash
# Fallback (only if no manifest):
npm run lint          # or project equivalent (eslint, ruff, rubocop, …)
npx tsc --noEmit      # or project equivalent (mypy, sorbet, …)
npm test -- --run     # all tests, not just the new one
npm run build
```

**Do not report success until the gate passes.**

### 5. Report

**Only if `/pre-merge` (or the fallback gate) passes:**
```
✓ Created src/api/{endpoint}.ts
✓ Created src/api/{endpoint}.test.ts
✓ Pre-merge gate passed (lint + typecheck + tests)
✓ Endpoint responds: 200 OK
```

**If anything fails** — stop. Show the error. Fix it or ask for help. Do not move on. Do not claim completion.
