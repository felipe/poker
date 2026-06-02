# /distill

Distill the full project brain from memory into lean, agent-ready in-repo docs.

**Memory is the full brain. In-repo is what an agent needs to ship a feature without asking questions.**

## Usage

```
/distill                    # Distill current project
```

## Process

Read and follow the full distill process. Find it at one of these locations (check in order):

1. `commands/distill.md` (if this project is work-work itself)
2. `${WORK_WORK_DIR}/commands/distill.md` (work-work installation)

The full command handles:
1. Resolving the project slug and memory path
2. Reading the full brain from `${MEMORY_PROJECT_DIR}/`
3. Cross-referencing against the codebase
4. Writing lean `docs/product-summary.md`, `docs/standards/`, and `docs/contracts/`
5. Tracking owned files via `docs/.distilled-manifest.yml`
6. Pruning stale distilled files
7. Reporting what was written, excluded, and why
