# /verify-deploy

Check deployment configuration and verify the live site actually works.
Does NOT trigger deploys — deployments are IaC (wrangler.toml, GitHub Actions).

**Every claim must be backed by an actual check.**

## Usage

```
/verify-deploy              # Check production
/verify-deploy staging      # Check staging
```

## Process

### 1. Find deploy config
```bash
ls wrangler.toml .github/workflows/deploy* vercel.json netlify.toml fly.toml 2>/dev/null
```

### 2. Validate config
Read the config. Check:
- Required fields present
- Build command matches package.json
- Output directory matches what deploy expects
- Environment variables documented (don't print values)

### 3. Build locally
```bash
npm run build
```
Must succeed. Report output size.

### 4. Check recent deploy status
```bash
# Cloudflare
wrangler deployments list 2>/dev/null

# GitHub Actions
gh run list --workflow=deploy.yml --limit=3 2>/dev/null
```

### 5. Hit the live URL
```bash
curl -sS -o /dev/null -w "%{http_code}" https://{deployed-url}
```
Must return 200 (or expected status).

### 6. Check health endpoint
```bash
curl -sS https://{deployed-url}/health 2>/dev/null || \
curl -sS https://{deployed-url}/api/health 2>/dev/null
```

### 7. Screenshot the live site
```bash
npx playwright screenshot https://{deployed-url} deploy-check.png
```
Attach the screenshot. Visually confirm the page loaded.

### 8. Report

```
✓ Deploy method: Cloudflare Pages (wrangler.toml)
✓ Build succeeds locally (1.2MB output)
✓ Last deploy: 2 hours ago — SUCCESS
✓ Live URL: https://example.com → 200 OK
✓ Health: /api/health → 200 OK
✓ Screenshot attached — page renders correctly
```

Or:
```
✗ Live URL returns 502
  curl output: [actual output]

The deploy config looks correct but the service is down.
Check logs with: wrangler tail
```

**If you can't verify something, say so. Don't assume it works.**
