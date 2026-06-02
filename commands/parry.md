# /parry

> **Deprecated.** For Copilot and automated reviews, use `/verify` instead — it runs proactively and folds Copilot comments into a unified verification report. `/parry` remains available for responding to human reviewer comments.

Address PR review comments — analyze feedback, fix valid issues, explain rejections.

**Read every comment before touching code. Not all feedback requires changes.**

## Usage

```
/parry 42              # Parry review comments on PR #42
/parry                 # Parry current branch's PR
/parry --repo org/repo # Target a specific repo
```

## Process

### 1. Identify the PR

```bash
# From argument
gh pr view {number} --json number,title,url,headRefName,baseRefName

# Or from current branch
gh pr view --json number,title,url,headRefName,baseRefName
```

### 2. Read ALL review comments

```bash
# PR reviews (approval, changes requested, comments)
gh pr view {number} --json reviews --jq '.reviews[] | {author: .author.login, state: .state, body: .body}'

# Inline review comments (the important ones)
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | {path: .path, line: .line, body: .body, author: .user.login, id: .id}'

# General PR comments
gh pr view {number} --json comments --jq '.comments[] | {author: .author.login, body: .body}'
```

### 3. Read the PR diff

```bash
gh pr diff {number}
```

Understand the full scope of changes before responding to any comment.

### 4. Triage each comment

Categorize every comment:

- **Valid fix** — reviewer is right, code needs to change
- **Valid concern, different fix** — the problem is real but the suggested fix isn't ideal
- **Reject** — reviewer misread the code, or the suggestion conflicts with project patterns
- **Question** — needs clarification before acting

### 5. Fix valid issues

Check out the PR branch:
```bash
# If in a worktree layout
cd ../{branch-name}
# Or
git checkout {branch-name}
```

Make all fixes in a single commit. Group related changes. Don't fix unrelated code.

### 5a. Run the Coding Task Minimum Gates (before pushing)

If any fix touched code, this step is governed by the **Coding Task Minimum Gates** section of `AGENTS.md` (lint + typecheck + tests pass before the work is claimed done). Review-feedback fixes are code changes — the gate applies.

**If the project has a `.pre-merge.yml`:** run `/pre-merge`. Every enabled stage must pass. This is the authoritative gate.

**If no `.pre-merge.yml` exists:** fall back to the project's lint + typecheck + test commands directly.

```bash
# Fallback (only if no manifest):
npm run lint          # or project equivalent (eslint, ruff, rubocop, …)
npx tsc --noEmit      # or project equivalent (mypy, sorbet, …)
npm test -- --run
```

**Do not push and do not respond on the PR until the gate passes.** If the gate fails, fix the issue before continuing — never commit around the gate.

Once the gate is green:

```bash
git add {changed files}
git commit -m "Address review feedback on #{number}" \
  --author="${GIT_AUTHOR_NAME} <${GIT_AUTHOR_EMAIL}>"
git push
```

### 6. Respond on the PR

Leave a single summary comment addressing ALL feedback:

```bash
gh pr comment {number} --body "$(cat <<'EOF'
## Review feedback addressed

**Fixed:**
- {file}:{line} — {what was fixed and why the reviewer was right}

**Addressed differently:**
- {file}:{line} — {what the concern was, what was done instead, and why}

**No change:**
- {file}:{line} — {why the code is correct as-is, with evidence}

**Questions:**
- {quote the comment} — {what needs clarification}
EOF
)"
```

### 7. Report

```
✓ PR #{number}: {title}
✓ {N} comments addressed
✓ {N} fixes applied
✓ {N} rejected with explanation
✓ {N} questions raised
✓ Pushed: {commit sha}
```

## Rules

- **Never dismiss feedback without explanation.** If you disagree, say why with evidence (line numbers, project patterns, docs).
- **Never make unrelated changes.** Only touch code that review comments reference.
- **One commit for all fixes.** Don't create a commit per comment.
- **No AI attribution.** No "co-authored-by", "generated with", or similar lines anywhere.
- **Git author must be** the value configured in `memory/Work-Work/globals/private-env.sh`
