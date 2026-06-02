# /add-component

Scaffold a new component following this project's standards.

**Verification required. Do not report success unless every step passes.**

## Usage

```
/add-component ComponentName
```

## Process

### 1. Learn the patterns
- Check `standards/` for component patterns
- Check `design/` for design system tokens
- Look at 2-3 existing components in `src/` — match their style exactly

### 2. Scaffold
Create the component matching the project's conventions:
- File location based on existing component structure
- Naming convention matching existing files
- Import patterns matching existing code
- TypeScript types matching project strictness

Create a test file alongside it using the same framework and patterns as existing tests.

### 3. Verify — ALL must pass

```bash
# Read it back — does it look right?
cat src/components/{Name}/{Name}.tsx
```

### 4. Run the Coding Task Minimum Gates

This step is governed by the **Coding Task Minimum Gates** section of `AGENTS.md` (lint + typecheck + tests pass before the work is claimed done). A scaffolded component is a code change — the gate applies.

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
✓ Created src/components/{Name}/{Name}.tsx
✓ Created src/components/{Name}/{Name}.test.tsx
✓ Pre-merge gate passed (lint + typecheck + tests)
```

**If anything fails** — stop. Show the error. Fix it or ask for help. Do not move on. Do not claim completion.
