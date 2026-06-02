# /next

Coordination-digest verb. Answers "what's next?" for the current project.

## Usage

```
/next              # print the digest
/next explain <n>  # re-run the classifier and print details for item n
```

## What This Does

`/next` reads the current project's coordination signals and prints a four-section terminal digest:

- **Moveable** — items you can act on now (no `waiting-on-*` label, no blocking PR, labeled as actionable or present in the project's todo/launch-checklist)
- **Nudge** — items waiting on an external actor and stale beyond the threshold
- **Watching** — open PRs, in-flight items, anything you should observe but not drive
- **Unclassified** — everything else; age-bucketed and capped to prevent wall-of-issues on fresh projects

Per-project behavior is configurable via `.work-work/next.yml` at the repo root (absent = sane defaults).

## Process

Run:

```bash
bash ~/Work/scripts/next.sh
```

That's it. The script handles project resolution (from cwd), fetching, classifying, rendering, and degraded-mode banners if GitHub is unreachable.

For the `explain` subcommand:

```bash
bash ~/Work/scripts/next.sh explain <n>
```

## Label semantics

`/next` reads labels for classification but does not document the label vocabulary itself — the canonical rubric lives elsewhere. Two pointers worth knowing if you're filing or triaging issues:

- **`templates/labels.yml`** in work-work — definitions for the universal 15-label set every registered project uses (state, priority, routing, gate, task type).
- **CLAUDE.md → "Universal Label Taxonomy" + "Properties of delegatable tasks"** — the rubric for *which* labels apply when, and specifically what makes an issue eligible for the `delegate` label (scoped, closed-loop, not mission-critical, etc.). The orchestrator daemon picks up `delegate`-labeled issues automatically; `needs-judgment` is the default for triaged-but-not-delegate-eligible items.

If you're a Sibyl drafting issues for a human to ship, propose the label set in your draft — the human applies it on creation.

## Rules

- **Print-only.** v1 does not dispatch to agents, does not draft nudges, does not execute scripts. It shows state; you act.
- **Pull-only.** No cron, no session-start hook. You invoke it when you want it.
- **Stateless.** Each invocation re-runs the classifier from scratch — `/next explain N` may reference a different item if issue state changed between calls (expected trade-off; acknowledged caveat).
- **Config-driven.** Classification label vocabulary lives in `.work-work/next.yml` (labels.moveable, labels.waiting_prefix, labels.in_flight, stale_threshold_days). Defaults match InStock's vocabulary.
- **Bot-filtered staleness.** `last_human_event_at` excludes Copilot, dependabot, github-actions, project-board sync events, and mechanical User events (transferred/referenced/added_to_project_v2). Only substantive human engagement counts.

## Exit codes

- `0` — clean run (digest printed)
- `1` — GitHub fetch failed (partial digest printed from local signals)
- `2` — project not resolvable from cwd

## Guardrails

- `/next` does not write to the wiki.
- `/next` does not modify issue labels or state.
- `/next` does not invoke other work-work verbs or agent flows.
- If the cwd is not inside a registered project (`~/Work/projects/<org>/<repo>/<worktree>/...` or `~/Work` itself), the verb exits 2 with a one-line hint.

## Report

The verb's output is a text digest. A run against an active project with a configured label vocabulary looks like:

```
/next — instock (abbott-interfast/InStock)
   3 moveable · 1 nudge · 2 watching · 42 unclassified

Moveable (you can act on now)
  [1] Run category-attributes import against Lightsail (todo §1) 🔒
  [2] Address Copilot review on PR #245  (#245, REVIEW_REQUIRED)

Nudge (stuck, needs outside move)
  [3] CardPointe creds 🔒  (#62)  · 8 weeks  · waiting on abbott

Watching (in-flight)
  [4] PR #243 admin product edit  (PR #243, APPROVED)

Unclassified (42 items)
  Recent (<2 days):
    …
  2-30 days:
    …
  Older (>30 days):
    …and 23 more in this bucket

Run /next explain <n> to inspect an item.
```
