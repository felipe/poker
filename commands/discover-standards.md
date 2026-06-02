# /discover-standards

Extract tribal knowledge from your codebase into concise, documented standards.

## Prerequisite: `agent-os/` must exist in the current project

This command wraps agent-os functionality. If the project root does not contain an `agent-os/` directory, **stop and report**:

> `/discover-standards` requires agent-os, which is not installed in this project. Options: (1) install agent-os from https://github.com/buildermethods/agent-os (vendor or clone into the project so `agent-os/` exists at the project root); (2) use alternative tooling — `/ce-brainstorm` and `/ce-plan` cover brainstorm / plan / spec workflows without the dependency, and are this repo's preferred path.

Do not proceed past this section unless `agent-os/` is present.

## How This Works

This command wraps the agent-os `discover-standards` process. It runs the same interactive flow, but writes the full output to the project's **memory** — not in-repo. Run `/distill` afterward to produce the lean in-repo subset.

## Process

### Step 0: Resolve project memory path

1. Detect the project slug from the current working directory (match against `memory/projects/_registry.yml` in the work-work installation)
2. Set `MEMORY_PROJECT_DIR` to `memory/projects/{slug}/`
3. Create `${MEMORY_PROJECT_DIR}/standards/` if it doesn't exist

### Step 1: Run agent-os discover-standards

Read and follow the full process defined in the agent-os discover-standards command. Find it at one of these locations (check in order):

1. `vendor/agent-os/commands/agent-os/discover-standards.md` (if agent-os is vendored in this project)
2. `${WORK_WORK_DIR}/vendor/agent-os/commands/agent-os/discover-standards.md` (work-work installation)

**Path mapping** — wherever the agent-os process says `agent-os/standards/`, write to `${MEMORY_PROJECT_DIR}/standards/` instead:

| agent-os path | write to |
|---|---|
| `agent-os/standards/[folder]/[file].md` | `${MEMORY_PROJECT_DIR}/standards/[folder]/[file].md` |
| `agent-os/standards/index.yml` | `${MEMORY_PROJECT_DIR}/standards/index.yml` |

### Step 2: Suggest distillation

After standards are written to memory, remind the user:

```
Standards written to memory. Run /distill to generate lean in-repo docs.
```
