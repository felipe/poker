# poker

## The Rule

**Never report completion without verification.**

Do not say something works unless you have tested it and confirmed it works.
If something fails, say so. Show the error. Ask what to do.

## Product
<!-- What is this project? One paragraph max. -->
<!-- What problem does it solve? Who is it for? What's the core experience? -->

## Do Not
<!-- Bright lines agents must never cross. Product-level, not code-level. -->
<!-- e.g. "No cloud-required features", "No tracking/analytics", "No social features (v2+)" -->

## Stack Discovery

Before starting work, discover this project's current stack:
1. Read `package.json` → dependencies, scripts, package manager
2. Check for: `wrangler.toml`, `vercel.json`, `fly.toml`, `turbo.json`, `Dockerfile`
3. Check for `.pre-merge.yml` → the verification gate
4. Run the test command to confirm tests pass before changing anything
5. Read `tsconfig.json` if TypeScript

Do not assume the stack from memory or prior sessions. Read the code.

## Commands

This project has workflow instructions in `commands/` (and `commands/design/` for design tasks).
Read the relevant command file before executing a workflow — e.g. `commands/pre-merge.md` for verification, `commands/fix-issue.md` for issue implementation.

## Infrastructure
<!-- ONLY things that CANNOT be discovered from code -->
<!-- IDs, URLs, account numbers, deploy targets, signing info -->

## Guardrails
- **Pre-merge gate is mandatory.** Before any PR is marked ready for review, run `/pre-merge`. Every test in `.pre-merge.yml` must pass. Do not request human review on a failing branch.
- **Stop on red.** If a test stage fails, stop. Fix it or report the failure. Never skip a failing check.
- **No AI attribution.** Never reference an LLM in branch names, commit messages, PR descriptions, or issue comments. No `co-authored-by`, `generated with`, or similar lines anywhere.
<!-- Project-specific safety rails below -->
