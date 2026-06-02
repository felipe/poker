# /inject-standards

Inject relevant standards into the current context, formatted appropriately for the situation.

## Prerequisite: `agent-os/` must exist in the current project

This command wraps agent-os functionality. If the project root does not contain an `agent-os/` directory, **stop and report**:

> `/inject-standards` requires agent-os, which is not installed in this project. Options: (1) install agent-os from https://github.com/buildermethods/agent-os (vendor or clone into the project so `agent-os/` exists at the project root); (2) use alternative tooling — `/ce-brainstorm` and `/ce-plan` cover brainstorm / plan / spec workflows without the dependency, and are this repo's preferred path.

Do not proceed past this section unless `agent-os/` is present.

## Usage

```
/inject-standards                    # Auto-suggest based on context
/inject-standards api                # All standards in api/
/inject-standards api/response-format # Single file
```

## How This Works

This command wraps the agent-os `inject-standards` process. It reads standards from **two locations** in priority order:

1. **In-repo `docs/standards/`** — curated, agent-ready subset (takes precedence)
2. **Memory `${MEMORY_PROJECT_DIR}/standards/`** — full standards library (fallback)

In-repo standards are the distilled guardrails. Memory standards are the complete brain. When both exist for the same standard, the in-repo version wins.

## Process

### Step 0: Resolve project memory path

1. Detect the project slug from the current working directory (match against `memory/projects/_registry.yml` in the work-work installation)
2. Set `MEMORY_PROJECT_DIR` to `memory/projects/{slug}/`

### Step 1: Run agent-os inject-standards

Read and follow the full process defined in the agent-os inject-standards command. Find it at one of these locations (check in order):

1. `vendor/agent-os/commands/agent-os/inject-standards.md` (if agent-os is vendored in this project)
2. `${WORK_WORK_DIR}/vendor/agent-os/commands/agent-os/inject-standards.md` (work-work installation)

**Path mapping** — read from both locations, in-repo first:

| agent-os path | read from (priority order) |
|---|---|
| `agent-os/standards/index.yml` | 1. `docs/standards/index.yml` 2. `${MEMORY_PROJECT_DIR}/standards/index.yml` |
| `agent-os/standards/[folder]/[file].md` | 1. `docs/standards/[folder]/[file].md` 2. `${MEMORY_PROJECT_DIR}/standards/[folder]/[file].md` |

If neither location has standards, report that no standards have been discovered yet and suggest running `/discover-standards`.
