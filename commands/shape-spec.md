# /shape-spec

Gather context and structure planning for significant work. **Run this command in plan mode.**

## Prerequisite: `agent-os/` must exist in the current project

This command wraps agent-os functionality. If the project root does not contain an `agent-os/` directory, **stop and report**:

> `/shape-spec` requires agent-os, which is not installed in this project. Options: (1) install agent-os from https://github.com/buildermethods/agent-os (vendor or clone into the project so `agent-os/` exists at the project root); (2) use alternative tooling — `/ce-brainstorm` and `/ce-plan` cover brainstorm / plan / spec workflows without the dependency, and are this repo's preferred path.

Do not proceed past this section unless `agent-os/` is present.

All output goes to the project's **memory** — not in-repo. Run `/distill` afterward to produce lean in-repo docs.

## Process

Read and follow the full shape-spec process. Find it at one of these locations (check in order):

1. `commands/shape-spec.md` (if this project is work-work itself)
2. `${WORK_WORK_DIR}/commands/shape-spec.md` (work-work installation)

The full command handles:
1. Resolving the project slug and memory path
2. Running the agent-os shape-spec interactive flow (must be in plan mode)
3. Writing specs, product context, and standards to `${MEMORY_PROJECT_DIR}/`
4. Suggesting `/distill` to sync lean docs to the repo
