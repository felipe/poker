# /session-start

Optional pre-work ritual. Reads the cross-project wiki context before you begin, writes a session note when a decision was made, and adds new issues/PRs to The Docket.

## When to use

- **Default (infrastructure + pays-the-bills work): don't.** Just open the PR. AGENTS.md + the project's code is sufficient context. This ritual adds friction without signal.
- **Exploratory / maintenance / rarely-touched projects:** run `/session-start` when resuming the project after a gap so the wiki state is fresh in your head before you act.

## Process

When starting work:

1. **Read `./wiki/_index.md`** — know the wiki's current shape.
2. **Read `./wiki/work/pages/stack.md`** — know what matters across the full project list right now.
3. **Read `./wiki/work/pages/projects/{name}.md`** — recover context on where you left off on this specific project.
4. **`cd` into the project's worktree** — perform the actual work.
5. **Write a session note** to `./wiki/work/raw/session-notes/YYYY-MM-DD-{slug}.md` — but only when a decision was made, not as reflexive ritual for every session. The note records *what happened and why*; a diff captures *what changed*.
6. **Add new issues/PRs to The Docket:**

   ```bash
   gh project item-add 7 --owner felipe --url <issue-or-pr-url>
   ```

## Rules

- **Opt-in.** Never imposed on infrastructure / pays-the-bills work. An agent operating on InStock / FrndlyTV / PFRANKMD / work-work should not invoke this preamble.
- **Decision-gated notes.** Session notes exist to preserve reasoning that isn't captured elsewhere. "I fixed a typo" is not a session note; "I chose X over Y because Z" is.
- **Docket is additive.** If an issue is auto-added by the nightly GitHub-activity scrape, don't double-add.

## Rationale

The 6-step Session Flow used to live in the repo-root `AGENTS.md` as a universal preamble. In practice, on fast-moving infrastructure / pays-the-bills work, agents were skipping most of it anyway — the ritual was a compliance tax, not a signal-producing act. By pulling it out into this opt-in command, the projects that benefit from ritual keep it; the projects that move fast aren't slowed by it.
