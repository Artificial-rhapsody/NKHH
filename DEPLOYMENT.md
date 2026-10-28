# Deployment

## Current production resources

- Temporary GitHub repository: https://github.com/Artificial-rhapsody/NKHH.git, branch `main`.
- Worker: https://story-interview-auth-production.hatayoru.workers.dev
- Production D1: `story-users-production`, ID `9fe7b4ce-258b-42d3-b2b4-fc28a125832d`.
- Production migration `0001_auth.sql` applied; `users`, `sessions`, `rate_limits` verified remotely.
- Allowed frontend Origin: `https://artificial-rhapsody.github.io` (no repository path).
- Intended Pages URL: https://artificial-rhapsody.github.io/NKHH/ ; availability must be verified after the Pages workflow finishes.
- Worker Secret: `GITHUB_TOKEN`; value is never committed. Use a Fine-grained PAT restricted to NKHH with Contents read/write. A 90-day lifetime is recommended; record the actual expiration privately and rotate before expiration.

Production authentication was exercised against the public Worker: registration, login, session lookup, normal-user denial, administrator permission check and logout. The disposable production test account was removed and its absence verified. GitHub content writes require the repository's initial push before end-to-end verification.

## GitHub Pages and CI

Set repository Actions variable `PUBLIC_API_BASE` to `https://story-interview-auth-production.hatayoru.workers.dev`. Select GitHub Actions in Settings → Pages. The Pages workflow builds `dev-page/` and deploys it; CI installs Chromium and ffmpeg before browser/media tests.

Worker writes to `site.json`, `videos.json` and media paths using GitHub Contents API. Each successful content commit triggers the Pages workflow. API read-back confirms the repository update, not completion of the asynchronous Pages deployment. Keep uploaded media tracked in Git; only referenced media are copied into the public artifact.

## Local verification

```bash
npm ci
npx playwright install chromium
npm test
npm run check
python3 test_content.py
npm run build
npm run build:worker
```

Media tests also require ffmpeg. Full local E2E requires separate terminals running `npm run worker:dev` and `npm run dev`, then `npm run test:e2e` and `npm run test:videos` sequentially. These tests temporarily modify published local JSON, restore original records and delete their disposable accounts. Never run them against production.

## Update Worker

```bash
npx wrangler whoami
npm run build:worker
npm run worker:deploy
npx wrangler deployments list --env production --config workers/wrangler.jsonc
```

Production resources are configured under `env.production`; the default environment remains local with a placeholder D1 ID. Do not apply local admin promotion to production. Never copy local users, test accounts or Wrangler state into production.

## Rotate GitHub token

In your own system terminal (not chat):

```bash
npx wrangler secret put GITHUB_TOKEN --env production --config workers/wrangler.jsonc
```

Paste the new token only at the hidden prompt. Verify the new credential before revoking the previous one, except exposed tokens must be revoked immediately. An expired/revoked token stops admin publishing/uploads, but does not remove the already deployed public site. Do not store personal gh OAuth credentials in the Worker.

## First production administrator

Register through the public website, then have an authorized operator change that exact user's role to `admin` in production D1 using controlled parameter binding or the Cloudflare D1 console. Do not concatenate arbitrary user input into shell SQL. Local `npm run admin:promote` is not a production tool.

## Later transfer to client

Update the Git remote, production `GITHUB_OWNER`/`GITHUB_REPO`/`GITHUB_BRANCH`, target-repository PAT, Pages variable and Worker `ALLOWED_ORIGINS`. If moving Cloudflare accounts, recreate/migrate D1 and redeploy under that account. Account IDs and repository names are configuration, not secrets; token values and user databases must never be committed.
