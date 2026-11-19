# Collaborative Whiteboard — Architecture, Local Setup & Production Runbook

## Architecture Overview

Whiteboards belong to **projects** (`organizations → projects → boards`) and inherit permissions from the owning project (`lib/whiteboards/permissions.ts` + Supabase RLS).

| Layer | Technology | Responsibility |
|---|---|---|
| Canvas | `@excalidraw/excalidraw` (`0.18.1`) | Client-only drawing canvas, fractional ordering, `reconcileElements`, export/import |
| CRDT & Offline | `yjs` + `y-indexeddb` | Per-element `Y.Map` (`elements`) + lightweight file references (`files`), offline cache & auto-merge |
| Realtime Server | `@hocuspocus/server` (`4.8.0`) in `server/collab/index.ts` | Long-lived Node WebSocket server, JWT auth + RBAC, read-only enforcement, debounced persistence, graceful flush |
| Database & Auth | Supabase Auth + Postgres + Realtime | `boards`, `board_snapshots` (server-only RLS), `board_assets`, `board_task_links`, `board_templates`, live `tasks` status updates |
| Object Storage | Garage S3 (`lib/storage/s3.ts`) | Private bucket (`pir-studio`), direct browser image upload/download via short-lived presigned URLs |

### Key Design Guarantees
- **Single source of truth for permissions**: `resolveBoardAccess()` in `lib/whiteboards/permissions.ts` and SQL functions `user_has_project_access` / `user_is_project_admin` enforce identical rules across Next.js Server Actions, API routes, RLS, and Hocuspocus.
- **Server-enforced read-only**: Boards with `status = 'archived'` or `is_locked = true` set `connectionConfig.readOnly = true` on Hocuspocus so modified clients cannot push mutations.
- **Snapshot isolation**: `board_snapshots` has RLS enabled with zero `anon`/`authenticated` policies; only `service_role` (Hocuspocus and server-side template seeding) can access binary Yjs snapshots.
- **Task status never duplicated in Yjs**: Linked elements store only `customData.linkedTaskId` + rows in `board_task_links`. Status badges are rendered client-side from live Supabase Realtime `tasks` data.
- **Images never stored in Yjs**: Pasted/dropped images are downscaled client-side (max 2048px), uploaded directly to Garage via presigned `PUT`, confirmed via `HeadObject`, and referenced in Yjs only by `{ fileId, mimeType, status }`.

---

## Local Development

1. Apply the Supabase migration:
   - File: `supabase/migrations/20261119000000_add_whiteboards.sql`
   - Run via `npx supabase db push` or execute in the Supabase SQL Editor.
2. Verify `.env.local` contains:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   S3_ENDPOINT=https://s3.mavl.my.id
   S3_REGION=garage
   S3_BUCKET=pir-studio
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_FORCE_PATH_STYLE=true
   NEXT_PUBLIC_COLLAB_WS_URL=ws://localhost:1234
   COLLAB_PORT=1234
   COLLAB_ALLOWED_ORIGINS=http://localhost:3000
   ```
3. Configure Garage bucket CORS for direct browser image uploads:
   ```bash
   npx tsx scripts/setup-garage-cors.ts --check
   npx tsx scripts/setup-garage-cors.ts --apply http://localhost:3000 https://your-app-domain.com
   ```
4. Start both processes in separate terminals:
   ```bash
   npm run dev
   npm run dev:collab
   ```
5. Verify the collab server health endpoint:
   ```bash
   curl http://localhost:1234/health
   ```

---

## Production Deployment (Docker Compose + Cloudflare Tunnel)

`docker-compose.yml` runs three services:
- `app` — Next.js standalone (`:3000`)
- `collab` — Hocuspocus WebSocket server (`:1234`, `stop_grace_period: 20s` for clean shutdown flush)
- `cloudflared` — Cloudflare Tunnel exposing both services over TLS

### Required Production Steps
1. **Cloudflare Tunnel public hostnames**:
   - `app.yourdomain.com` → `http://app:3000`
   - `ws.yourdomain.com` → `http://collab:1234` (Cloudflare Tunnel supports `wss://` WebSocket upgrade automatically; keep idle timeout ≥ 60s — Hocuspocus sends ping/awareness keepalives every 30s).
2. **Environment variables** (in `.env` / `.env.local` before `docker compose build`):
   ```env
   NEXT_PUBLIC_COLLAB_WS_URL=wss://ws.yourdomain.com
   COLLAB_ALLOWED_ORIGINS=https://app.yourdomain.com
   ```
3. **Garage CORS**:
   ```bash
   npx tsx scripts/setup-garage-cors.ts --apply https://app.yourdomain.com
   ```
4. **Build & start**:
   ```bash
   docker compose up -d --build
   ```

---

## Scaling Path

Run a **single** `collab` instance by default (easily handles dozens of boards and hundreds of concurrent connections for game jam teams).
Do **not** scale `collab` to multiple replicas without adding one of:
1. **`@hocuspocus/extension-redis`**: synchronizes live Y.Doc updates and awareness across replicas through Redis Pub/Sub, or
2. **Sticky routing per board**: route WebSocket upgrades deterministically by `board:<boardId>` to a single replica.

---

## Operations, Monitoring & Snapshot Recovery

- **Health check**: `GET http://collab:1234/health` returns JSON with `status`, `uptimeSeconds`, `activeDocuments`, `activeConnections`, `memoryMb`, and `metrics` (`storeSuccessCount`, `storeErrorCount`, `lastStoreError`, `authFailureCount`, `rateLimitDropCount`).
- **Structured logs**: JSON lines to stdout/stderr (`event: "doc.store_failed"`, `"auth.denied"`, `"ws.rate_limited"`, `"ws.revoked_connections"`, `"server.shutdown_complete"`). Alert on `level === "error"` or rising `metrics.storeErrorCount`.
- **Backups**: Include Supabase Postgres backups (`boards`, `board_snapshots`, `board_assets`, `board_task_links`, `board_templates`) AND Garage `pir-studio` bucket snapshots (`projects/*/whiteboards/*`).
- **Recovering a board from snapshot backup**:
  1. Temporarily lock the board (`boards.is_locked = true`) so active editors disconnect.
  2. Restore the target row in `public.board_snapshots` (`board_id`, `state`, `version`, `updated_at`) from Postgres PITR / pg_dump backup using `service_role`.
  3. Unlock the board (`boards.is_locked = false`); reconnecting clients immediately load the restored Yjs state.

---

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run build
npm run test:collab
npx tsx scripts/load-test-collab.ts 3 10 20
```

