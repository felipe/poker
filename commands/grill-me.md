# /grill-me

Interview me relentlessly about every aspect of a plan or design until we reach shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one by one.

**You ask, I answer. If the codebase has the answer, read it instead of asking.**

## Usage

```
/grill-me                  # Grill on the current project's design
/grill-me #42              # Grill on a specific issue/spec
/grill-me "the events system"  # Grill on a specific topic
```

## Process

Load the full skill from `skills/grill-me/SKILL.md` in the work-work repo (parent of `projects/`).

1. Read the project's AGENTS.md, README, and product docs
2. Read `memory/projects/{slug}/status.md` for current context and past decisions
3. If a topic or issue is specified, read that too
4. Map the decision tree — identify what's unresolved
5. Start grilling — one branch at a time, most foundational first
6. After resolving all branches, write decisions to `memory/projects/{slug}/status.md`

## Rules

- One question at a time. Wait for the answer.
- Don't suggest solutions — ask what happens, why, and what breaks.
- Don't accept vague answers. Press for specifics.
- If the code already answers a question, read it and move on.
- Track resolved/open/parked decisions with periodic checkpoints.
- At closeout, append each resolved decision to the project's `status.md` under `## Decisions`.
