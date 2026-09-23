# Sprint 6: In-App AI Assistant + MCP Server (Tasks & Milestones)

## 1. Goal
Tambah AI chat panel (kanan bawah) yang bisa buat/ubah task dan buat milestone via prompting,
plus MCP server agar AI agent eksternal bisa konek dan melakukan hal yang sama.
V1 sederhana: TIDAK termasuk upload file asset fisik ke Drive.

Full context: `architecture.md`, `PRD-GameDev-Project-Manager.md`, `DESIGN_GUIDE.md`,
`AGENTS.md`, `docs/sprints/sprint-1.md` s/d `sprint-5.md`.

## 2. Decisions (locked)
- Scope AI v1: tasks + milestones saja (plus subtasks, plus list/read untuk grounding).
- Konteks project: project aktif dari URL `/projects/[slug]` via `useParams()`,
  resolve ke `project_id` dengan `getProjectBySlug`. Fallback: dropdown pilih project.
- MCP auth: `Authorization: Bearer <MCP_SECRET>`, secret hanya di env server.
- MCP transport: Streamable HTTP di `app/api/mcp/route.ts` pakai `@modelcontextprotocol/sdk`.
- LLM: Gemini REST `gemini-flash-latest:generateContent` + function calling,
  key HANYA dari `GEMINI_API_KEY` server-side. Jangan hardcode, jangan kirim ke client.

## 3. Security note
- Key `X-goog-api-key` yang pernah dipaste di chat harus dianggap bocor — revoke/rotate
  di Google AI Studio sebelum sprint ini.
- `.env.local` + Vercel settings tambah `GEMINI_API_KEY=` dan `MCP_SECRET=` (tanpa nilai asli di repo).
- Tambah keduanya ke `.env.example` sebagai placeholder kosong.

## 4. Architecture
- UI (`"use client"`): `components/ai/ai-assistant-fab.tsx` (FAB kanan bawah,
  Phosphor `Sparkle`, `fixed bottom-4 right-4 z-50`) + `components/ai/ai-assistant-panel.tsx`
  (shadcn `Card` + `Input` + `ScrollArea`, framer-motion 0.2s).
  Mount FAB di `components/layout/app-shell.tsx`, sembunyikan di `/login`, `/privacy`, `/terms`.
  4 UI states wajib: Skeleton / Card empty `No messages` / Alert destructive + Retry / populated.
  Copy Inggris, label 1-2 kata, tanpa parenthetical.
- Backend: `lib/ai/gemini.ts` (fetch Gemini REST server-side),
  `lib/ai/tools.ts` (definisi tool + Zod, mirror `TaskSchema`/`MilestoneSchema`),
  `actions/ai.ts` (Server Action: terima `{ projectSlug, message, history }`,
  ambil konteks via `getTasksByProjectId` + `getMilestonesByProjectId`,
  panggil Gemini, eksekusi tool dengan memanggil `actions/tasks.ts`
  (`createTask`, `updateTask`, `updateTaskStatus`, `createSubtask`) dan
  `actions/milestones.ts` (`createMilestone`), return ringkasan ke UI).
- MCP: `app/api/mcp/route.ts` (cek Bearer dulu, 401 jika salah; expose tools
  `list_projects`, `get_project`, `list_tasks`, `create_task`, `update_task`,
  `update_task_status`, `create_subtask`, `list_milestones`, `create_milestone`;
  reuse fungsi Server Action yang sama; tanpa delete permanen dan tanpa tool Drive mentah di v1).
- Dependensi baru: `@modelcontextprotocol/sdk` (verifikasi kompatibel Next 16 + React 19).

## 5. Tool schemas (Gemini function declarations = MCP tools)
- `listTasks({projectId})`, `listMilestones({projectId})`
- `createTask({project_id, title, description?, status?: todo|in_progress|review|done, due_date?, subtasks?: string[]})`
- `updateTask({taskId, projectId, title?, description?, status?, milestone_id?, assignee_id?, due_date?})`
- `updateTaskStatus({taskId, projectId, newStatus})`
- `createSubtask({taskId, title})`
- `createMilestone({project_id, title, start_date?, due_date?, status?})`
- Selalu grounding via list dulu sebelum resolve `taskTitle -> taskId`; jika ambigu, tanya balik di chat.

## 6. Files (as-built)
- Baru: `components/ai/ai-assistant-fab.tsx`, `components/ai/ai-assistant-panel.tsx`,
  `actions/ai.ts`, `lib/ai/gemini.ts`, `lib/ai/tools.ts`, `app/api/mcp/route.ts`,
  `actions/mcp-tokens.ts`, `lib/mcp/tokens.ts`, `app/mcp/page.tsx`,
  `components/mcp/*`, `supabase/migrations/20260923000000_add_mcp_tokens.sql`,
  `components/ui/scroll-area.tsx`, `docs/mcp.md`, `docs/sprints/sprint-6.md` (file ini).
- Edit: `components/layout/app-shell.tsx`, `.env.example`, `package.json` (tambah SDK),
  lint/config fixes.
- Dipanggil reuse (tanpa ubah skema inti): `actions/tasks.ts`, `actions/milestones.ts`,
  `actions/projects.ts`, `actions/assets.ts`, `actions/credits.ts`, `actions/artifacts.ts`.
- Skema baru: `mcp_tokens` (hash SHA-256 saja, RLS per-user) untuk auth MCP per-user
  selain shared `MCP_SECRET`.

## 7. Test & Done
1. `npm run typecheck && npm run lint && npm run build` nol error.
2. Prompt uji: "buat 3 task persiapan jam + milestone Demo Day minggu depan"
   → row ada di Supabase DAN muncul realtime di kanban tanpa refresh.
3. MCP: `curl -H "Authorization: Bearer $MCP_SECRET" <domain>/api/mcp` list tools OK,
   `create_task` uji muncul di DB.
4. Checklist `DESIGN_GUIDE.md` §7 lolos (shadcn-only, 4 states, ikon bermakna, microcopy Inggris).

## 8. Out of scope v1 (tunda)
Preview Drive embed, notifikasi, granular roles, analytics. Minta konfirmasi user sebelum bangun.
Catatan as-built: tool AI/MCP mencakup update/delete metadata dan upload Drive
(user-token saja, butuh Drive tertaut). Tanpa delete permanen via shared secret.
