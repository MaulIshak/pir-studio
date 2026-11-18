# CI/CD Setup Guide

This repository uses GitHub Actions for Continuous Integration (CI) and a GitHub Self-Hosted Runner for Continuous Deployment (CD) to the self-hosted Docker Compose + Cloudflare Tunnel stack.

## Workflows

| Workflow | File | Trigger | Runner | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **CI** | `.github/workflows/ci.yml` | `push` (`main`), `pull_request` (`main`), manual | `ubuntu-latest` | Runs `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, and verifies the `Dockerfile` builds cleanly. |
| **CD** | `.github/workflows/cd.yml` | After `CI` succeeds on `main`, or manual | `self-hosted` | Syncs code, builds & restarts `docker compose`, verifies `/api/ping` health, and prunes dangling images. |
| **Supabase Keepalive Ping** | `.github/workflows/uptime-ping.yml` | Every 4 days (`0 0 */4 * *`), manual | `ubuntu-latest` | Pings `$APP_URL/api/ping` to keep the Supabase free-tier database active. |

> **Database Migrations**: SQL migrations in `supabase/migrations/` are **not** executed automatically by CD. Apply new migration files manually via the Supabase Dashboard SQL Editor before or alongside deploying dependent code.

---

## GitHub Repository Configuration

### 1. Variables (`Settings → Secrets and variables → Actions → Variables`)
- `NEXT_PUBLIC_SUPABASE_URL` — Public Supabase project URL (used during `next build` and Docker build).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Public Supabase publishable key (used during `next build` and Docker build).
- `DEPLOY_DIR` *(optional)* — Absolute path on the self-hosted server where the persistent `docker-compose.yml` stack and `.env.local` live (e.g. `/opt/pir-studio`). If omitted, CD runs inside the runner workspace.

### 2. Secrets (`Settings → Secrets and variables → Actions → Secrets`)
- `APP_URL` — Public URL of your deployed app (e.g. `https://app.example.com`) for `uptime-ping.yml`.
- `ENV_FILE` *(optional if `.env.local` already exists in `DEPLOY_DIR`)* — Full contents of `.env.local` to write before `docker compose` runs.

---

## Setting Up the Self-Hosted Runner on Your Server

1. On your server, install Docker Engine + Docker Compose v2 (`docker compose`) and `rsync`.
2. In GitHub, go to **Settings → Actions → Runners → New self-hosted runner** (Linux x64/ARM64) and follow the installation commands on your server.
3. Install and start the runner as a systemd service so it stays online across reboots:
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```
4. Ensure the runner user can run Docker commands (`sudo usermod -aG docker <runner-user>`).
5. Place your `.env.local` inside `DEPLOY_DIR` (with `S3_*`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `MCP_SECRET`, `TUNNEL_TOKEN`) — or set `secrets.ENV_FILE` in GitHub.
6. Push to `main` (or trigger **CD** manually via `workflow_dispatch`).

