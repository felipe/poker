# /review

Review code for consistency with project standards and conventions.

**Base reviews on actual code, not assumptions. Read every file you comment on.**

## Usage

```
/review                     # Review uncommitted changes
/review src/components/     # Review a specific directory
/review --pr                # Review current PR diff
```

## Process

### 1. Gather files to review
```bash
# Uncommitted changes
git diff --name-only

# PR diff
git diff main...HEAD --name-only

# Or list the target directory
find {path} -type f -name '*.ts' -o -name '*.tsx'
```

### 2. Load standards
Read ALL of:
- `standards/` (if files exist)
- `AGENTS.md` for repo conventions
- `design/` for design system (if reviewing UI code)

### 3. Review each file

Read the actual file content. Check:
- Naming conventions (files, variables, functions, components)
- Import patterns and ordering
- Error handling consistency
- Type safety (no `any`, proper generics)
- Test coverage (does a test file exist for this?)
- Security (no hardcoded secrets, proper input validation)
- Accessibility (if UI)

### 4. Verify claims

If you say "this import is wrong" — show the line.
If you say "this doesn't match the pattern" — show the pattern and the deviation.
If you say "missing test" — confirm by searching:
```bash
find . -name '{Component}.test.*' -o -name '{Component}.spec.*'
```

### 5. Report

Group by severity:
```
## Errors (must fix)
- src/api/users.ts:42 — unhandled promise rejection. Other endpoints use try/catch (see src/api/auth.ts:15)

## Warnings (should fix)
- src/components/Modal.tsx — no test file found. All other components in this dir have tests.

## Suggestions
- src/utils/format.ts:8 — could use the existing `formatDate` from src/utils/dates.ts instead of reimplementing
```

**Only flag real issues. Cite line numbers. Show the fix, not just the problem.**
