# /build-manifest

Detect project type and generate a `.pre-merge.yml` manifest that tells `/pre-merge` exactly what to run.

**The manifest is the single source of truth for the pre-merge gate.** Without it, `/pre-merge` must guess. With it, every run is deterministic.

## Usage

```
/build-manifest              # Auto-detect and generate
/build-manifest --type frontend   # Force a specific type
/build-manifest --update     # Re-detect and update existing manifest
```

## Process

### 1. Detect project type

Read the project root. Build a profile from what exists:

```bash
# Check for monorepo
ls turbo.json pnpm-workspace.yaml lerna.json 2>/dev/null

# Check for deploy target
ls wrangler.toml vercel.json netlify.toml fly.toml Dockerfile Procfile 2>/dev/null

# Check for framework
cat package.json | grep -E '"(next|vite|react|vue|svelte|hono|express|fastify)"'

# Check for test tooling
ls vitest.config.* jest.config.* playwright.config.* cypress.config.* .eslintrc* tsconfig.json 2>/dev/null

# Check for package manager
ls yarn.lock pnpm-lock.yaml package-lock.json bun.lockb 2>/dev/null

# Check package.json scripts
cat package.json | grep -E '"(test|lint|typecheck|build|e2e|dev)"'
```

Classify the project:

| Signal | Type |
|--------|------|
| `turbo.json` or `pnpm-workspace.yaml` with multiple `apps/` | **turborepo** |
| `wrangler.toml` + no frontend framework | **backend** (Cloudflare Worker) |
| Hono, Express, or Fastify in deps + no frontend | **backend** (Node.js API) |
| `Dockerfile` or `docker-compose.yml` with server code | **backend** (containerized) |
| Next.js, Vite, or React in deps | **frontend** (or fullstack if also has API) |
| Static HTML files, no build step | **frontend** (static) |
| Mix of frontend + backend in one repo (not turborepo) | **fullstack** |

### 2. Detect package manager

| Lock file | Manager |
|-----------|---------|
| `yarn.lock` | yarn |
| `pnpm-lock.yaml` | pnpm |
| `package-lock.json` | npm |
| `bun.lockb` | bun |

### 3. Detect available stages

For each possible stage, check if the project supports it:

**typecheck** — enabled if `tsconfig.json` exists
**lint** — enabled if `lint` script in package.json, or `.eslintrc*` / `eslint.config.*` exists
**unit** — enabled if `test` script in package.json, or `vitest.config.*` / `jest.config.*` exists
**e2e** — enabled if `playwright.config.*` or `cypress.config.*` exists, or `e2e`/`test:e2e` script
**integration** — enabled if `test:integration` script exists
**build** — enabled if `build` script in package.json
**visual** — enabled if Playwright is a dependency AND the project has a frontend
**security** — always enabled (allow_failure: true)

For **turborepo** projects, also:
- List all directories under `apps/` and `packages/` that have their own `package.json`
- Classify each as frontend or backend using the same signals above
- Check if root has `turbo typecheck`, `turbo lint` scripts for shared stages

### 4. For turborepo: map outputs

Each app under `apps/` that produces a deployable artifact is an **output**:

```bash
# Find all apps with their own package.json
for app in apps/*/package.json; do
  dir=$(dirname "$app")
  name=$(basename "$dir")
  echo "${name}: ${dir}"
done
```

For each output:
- Read its package.json for scripts and dependencies
- Check for its own wrangler.toml, Dockerfile, etc.
- Classify as frontend or backend
- Generate per-output stages

Shared packages under `packages/` are NOT outputs — they are dependencies.

### 5. Detect preflight patterns

Check for common setup needs and generate `preflight` commands:

| Signal | Preflight command |
|--------|-------------------|
| `node_modules/` missing or stale | `{pkg_manager} install` |
| `prisma/schema.prisma` exists | `npx prisma generate` |
| `clean` script in package.json | `{pkg_manager} clean` |

Also check for `postflight` patterns:

| Signal | Postflight command |
|--------|-------------------|
| `coverage` script in package.json | `{pkg_manager} coverage` |
| `scripts/validate-contracts.sh` exists | `bash ./scripts/validate-contracts.sh` |

And detect potential `gates`:

| Signal | Gate |
|--------|------|
| `coverage` script + threshold configured | Coverage gate |
| OpenAPI/Swagger spec + `docs:verify` script | API contract gate |

### 6. Generate the manifest

Write `.pre-merge.yml` to the project root.

Use the appropriate manifest template as a starting point (located in the work-work repo at `templates/manifests/`):
- **frontend**: `pre-merge.frontend.yml`
- **backend**: `pre-merge.backend.yml`
- **turborepo**: `pre-merge.turborepo.yml`

The agent reads these templates from the work-work repo, not from the target project. The generated `.pre-merge.yml` is written to the project root.

Customize the template based on what was detected:
- Set the correct `package_manager`
- Fill in `project` section (name from package.json `name` field, type from detection)
- Fill in `context` section (set `watchers: [Felipe]`, detect `coverage_goal` from config)
- Add detected `preflight` commands (uncommented if detected, commented if not)
- Enable/disable stages based on what exists
- Fill in actual commands from package.json scripts
- For turborepo, fill in actual output names and paths
- Add detected `postflight` commands
- Add detected `gates`
- Comment out sections that don't apply (don't delete them — they serve as documentation for what COULD be enabled)

### 7. Verify the manifest

After generating, validate it:

```bash
# Check it parses as valid YAML
python3 -c "import yaml; yaml.safe_load(open('.pre-merge.yml'))"

# Dry-run: for each enabled stage, verify the command exists
# e.g., if "yarn lint" is configured, check that "lint" script exists in package.json
```

### 8. Report

```
MANIFEST GENERATED — .pre-merge.yml

Project: my-frontend-app (frontend)
Package manager: yarn
Watchers: Felipe
Preflight:
  yarn install
Stages:
  [ON]  typecheck — npx tsc --noEmit
  [ON]  lint — yarn lint
  [ON]  unit — yarn test --run
  [OFF] e2e — no Playwright/Cypress config found
  [ON]  build — yarn build → dist/
  [OFF] visual — no dev server configured
  [ON]  security — npm audit (non-blocking)
Postflight: (none detected)
Gates: (none detected)

Next: commit .pre-merge.yml and run /pre-merge to validate.
```

For turborepo:

```
MANIFEST GENERATED — .pre-merge.yml

Project: my-platform (turborepo)
Package manager: yarn
Watchers: Felipe
Preflight:
  yarn install
Shared stages:
  [ON]  typecheck — yarn turbo typecheck
  [ON]  lint — yarn turbo lint

Outputs:
  web (apps/web) — frontend
    [ON]  unit — yarn test --run
    [OFF] e2e — no config
    [ON]  build — yarn build → dist/

  api (apps/api) — backend
    [ON]  unit — yarn test --run
    [ON]  build — wrangler deploy --dry-run

  [ON]  security — npm audit (non-blocking)
Postflight: (none detected)
Gates: (none detected)

Next: commit .pre-merge.yml and run /pre-merge to validate.
```

## If --update flag

Re-run detection on an existing manifest:
1. Read the current `.pre-merge.yml`
2. Run detection again
3. Show a diff of what changed (new stages found, removed stages, etc.)
4. Write the updated manifest
5. Report what changed

## Rules

- **Never delete user customizations.** If the manifest already exists and has custom commands or flags, preserve them. Only add newly detected stages.
- **Comments are documentation.** Leave disabled stages as commented examples so the user knows what's available.
- **The manifest must be valid YAML.** Parse it back after writing to confirm.
- **One manifest per repo root.** For turborepos, everything goes in one file at the root.
