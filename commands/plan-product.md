# /plan-product

Define your product through an interactive conversation. Creates documentation that both agent-os and design-os can use as their starting point. All output goes to the project's **memory** — not in-repo. Run `/distill` afterward to produce lean in-repo docs.

## Prerequisite: `agent-os/` must exist in the current project

This command wraps agent-os functionality. If the project root does not contain an `agent-os/` directory, **stop and report**:

> `/plan-product` requires agent-os, which is not installed in this project. Options: (1) install agent-os from https://github.com/buildermethods/agent-os (vendor or clone into the project so `agent-os/` exists at the project root); (2) use alternative tooling — `/ce-brainstorm` and `/ce-plan` cover brainstorm / plan / spec workflows without the dependency, and are this repo's preferred path.

Do not proceed past this section unless `agent-os/` is present.

## Process

Read and follow the full plan-product process. Find it at one of these locations (check in order):

1. `commands/plan-product.md` (if this project is work-work itself)
2. `${WORK_WORK_DIR}/commands/plan-product.md` (work-work installation)

The full command handles:
1. Resolving the project slug and memory path
2. Running the agent-os interactive product definition flow
3. Generating design-os compatible files (product-overview, product-roadmap, data-shape)
4. Writing all output to `${MEMORY_PROJECT_DIR}/product/`
5. Suggesting `/distill` to sync lean docs to the repo
