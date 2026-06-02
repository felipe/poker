# /fix-issue

Pick up a GitHub Issue, implement it, verify it works, then open a PR.

**Verification required. Do not open a PR unless the fix actually works.**

## Usage

```
/fix-issue 42
/fix-issue         # List open issues and pick one
```

## Process

### 1. Claim the issue
```bash
# Check if already claimed — stop if it is
if gh issue view {number} --json labels --jq '.labels[].name' | grep -q "^claimed$"; then
  echo "Already claimed — pick a different issue"
  exit 1
fi

# Unclaimed — claim it (add label + assign)
gh issue edit {number} --add-label "claimed" --add-assignee "$(gh api user --jq '.login')"
```
If the issue is already claimed, **stop** — someone else is working on it. Pick a different issue.

### 2. Read the issue
```bash
gh issue view {number}
```
Extract: what needs to change, acceptance criteria, test requirements.
If the issue is unclear, ask — don't guess.

### 3. Discover the project
Read `AGENTS.md` (or `CLAUDE.md`). Follow Stack Discovery steps.
If the project has `commands/` at root, those are available instructions (e.g. `commands/pre-merge.md`).

### 4. Create worktree
```bash
git worktree add ../feat-issue-{number} -b feat/issue-{number} main
cd ../feat-issue-{number}
```

### 5. Implement
Follow project patterns. Write tests alongside code.

### 6. Verify — ALL must pass before PR

**If the project has a `.pre-merge.yml`:** run `/pre-merge`. Every enabled stage must pass. This is the authoritative gate.

**If no `.pre-merge.yml` exists:** fall back to manual checks, and recommend running `/build-manifest` to generate one.

```bash
# Fallback (only if no manifest):
# Type check
npx tsc --noEmit

# All tests pass (not just new ones)
npm test -- --run

# Build succeeds
npm run build
```

**If the issue involves UI:**
```bash
# Start dev server and take a screenshot with Playwright
npx playwright screenshot http://localhost:3000/affected-page screenshot.png
```
Confirm the UI matches what the issue asked for. Include the screenshot.

**If the issue has acceptance criteria:**
Go through each criterion one by one. Test it. Confirm it passes. If any criterion fails, fix it before continuing.

### 7. Commit and push
```bash
git add {changed files}
git commit -m "fix: {description} (#${number})"
git push -u origin feat/issue-{number}
```

### 8. Open PR
```bash
gh pr create \
  --title "fix: {description}" \
  --body "Closes #{number}

## Verification
- [x] Type check passed
- [x] All tests pass (X tests)
- [x] Build succeeds
- [x] {each acceptance criterion checked}
- [x] Screenshot: {if visual}"
```

### 9. Report

```
✓ Issue #42: {title}
✓ Branch: feat/issue-42
✓ Type check passed
✓ Tests passed (X tests)
✓ Build succeeded
✓ Acceptance criteria verified
✓ PR opened: {PR URL}
```

**If anything fails at any step** — stop. Show the error. Fix it or ask for help. Never open a PR with broken code.
