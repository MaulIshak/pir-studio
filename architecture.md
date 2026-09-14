# Architecture & Technical Guidelines — GameDev Project Manager

This document serves as the **single architectural source of truth** for all development sprints (Sprint 1 through Sprint 5). Every technical decision, code standard, database schema, API integration, and UI pattern must strictly adhere to this document.

---

## 1. Overview & Core Principles

- **Product Purpose**: A lightweight, unified web app for an internal game development team (5–8 members) participating in game jams and competitions. It connects project tracking, task kanban boards, asset status, license/credit records, and artifact links directly with organized Google Drive folders.
- **Zero Cost Stack**:
  - Frontend: **Next.js (App Router)** hosted on **Vercel** (Hobby/Free tier).
  - Database & Auth: **Supabase** (Postgres, Auth, Realtime) on Supabase Cloud (Free tier).
  - File Storage: **Google Drive API** (using studio/team Google Drive storage).
- **Vercel Serverless Constraint**:
  - The Vercel runtime operates on a *read-only filesystem*.
  - **Absolute Rule**: Third-party credentials and tokens (Google OAuth `access_token`, `refresh_token`, `expires_at`) **MUST BE STORED IN SUPABASE POSTGRES** (`oauth_tokens` table), never written to local files or disk.
- **UI Design System Rule**:
  - **MANDATORY**: Exclusively use **shadcn/ui** initialized with preset `b7C9smijg` (`--template next --pointer`).
  - **STRICT PROHIBITION**: Do not build custom unstyled UI components or hand-rolled primitives. All UI components originate from `npx shadcn@latest add [component]`.
- **UI Language & Microcopy Rule**:
  - **English Only**: All UI labels, buttons, headers, dialogs, empty states, and notifications must be in clear English.
  - **Brief & Clean Labels**: Keep labels as concise as possible. **Zero parenthetical annotations** (e.g., use `Design` instead of `Design (Figma)`, use `Type` instead of `Type (Jam/Competition)`).

---

## 2. Technology Stack & Packages

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, TypeScript) | Server Components by default; `"use client"` only when interactivity is required. |
| **UI Library** | shadcn/ui (Preset `b7C9smijg`) + Tailwind CSS | Pointer interaction flag (`--pointer`), installed via shadcn CLI. |
| **Icons** | Lucide React | Default icon set for shadcn/ui. |
| **Database & Auth** | Supabase Postgres + Supabase Auth | `@supabase/supabase-js`, `@supabase/ssr`, `@supabase/supabase-client-nextjs`. |
| **Drive Integration** | Google Drive API (`googleapis`) | Scope: `https://www.googleapis.com/auth/drive.file`. Tokens stored in database. |
| **Forms & Validation** | React Hook Form + Zod | Composed with shadcn `Form` primitives. |
| **Deployment** | Vercel + Supabase Cloud + GitHub Actions | Scheduled GitHub Actions workflow to keep the Supabase free-tier project active. |

### Environment Variables
Configure in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://imzqirqtyeeavrxvvaom.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_AViUsJSdZw9cILx79DiqIg_-JdgTev3
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## 3. Database Schema (Supabase Postgres)

The application utilizes 8 core tables with Row Level Security (RLS) enabled on all tables, providing full read/write access to authenticated team members:

```
+-----------------------------------------------------------------------------------+
|                                  SUPABASE POSTGRES                                |
|                                                                                   |
|  +----------------+        +-----------------+        +------------------------+  |
|  |    profiles    |<-------|   oauth_tokens  |        |        projects        |  |
|  +----------------+        +-----------------+        +------------------------+  |
|          ^                                                        ^               |
|          |                                                        |               |
|          +--------------------------+                             |               |
|                                     |                             |               |
|  +----------------+        +-----------------+        +------------------------+  |
|  |     tasks      |------->|   milestones    |------->|        assets          |  |
|  +----------------+        +-----------------+        +------------------------+  |
|                                                                   ^               |
|                            +-----------------+                    |               |
|                            |  artifact_links |<-------------------+               |
|                            +-----------------+                    |               |
|                                                                   |               |
|                            +-----------------+                    |               |
|                            |     credits     |--------------------+               |
|                            +-----------------+                                    |
+-----------------------------------------------------------------------------------+
```

### Table Definitions:

1. **`profiles`**
   - Synchronized automatically from `auth.users` on first sign-in via trigger.
   - Columns: `id (uuid, PK -> auth.users.id)`, `name (text)`, `email (text)`, `avatar_url (text)`, `created_at (timestamptz)`.
2. **`oauth_tokens`**
   - Stores Google OAuth tokens for Google Drive API calls (accommodating Vercel read-only runtime).
   - Columns: `id (uuid, PK)`, `user_id (uuid -> profiles.id)`, `provider (text, default 'google')`, `access_token (text)`, `refresh_token (text)`, `expires_at (timestamptz)`, `created_at (timestamptz)`, `updated_at (timestamptz)`.
3. **`projects`**
   - Columns: `id (uuid, PK)`, `name (text)`, `type (text: 'jam' | 'competition' | 'internal')`, `start_date (date)`, `deadline (date)`, `status (text: 'active' | 'completed' | 'archived', default 'active')`, `description (text)`, `drive_folder_id (text)`, `created_by (uuid -> profiles.id)`, `created_at (timestamptz)`.
4. **`milestones`**
   - Columns: `id (uuid, PK)`, `project_id (uuid -> projects.id on delete cascade)`, `title (text)`, `due_date (date)`, `status (text: 'not_started' | 'in_progress' | 'done', default 'not_started')`.
5. **`tasks`**
   - Columns: `id (uuid, PK)`, `project_id (uuid -> projects.id on delete cascade)`, `milestone_id (uuid -> milestones.id on delete set null)`, `title (text)`, `description (text)`, `assignee_id (uuid -> profiles.id on delete set null)`, `status (text: 'todo' | 'in_progress' | 'review' | 'done', default 'todo')`, `due_date (date)`, `created_at (timestamptz)`.
   - *Note: Supabase Realtime is enabled specifically for this table.*
6. **`assets`**
   - Columns: `id (uuid, PK)`, `project_id (uuid -> projects.id on delete cascade)`, `name (text)`, `type (text: 'sprite' | 'audio' | '3d_model' | 'font' | 'vfx' | 'other')`, `uploaded_by (uuid -> profiles.id)`, `drive_file_id (text)`, `status (text: 'received' | 'review' | 'integrated' | 'rejected', default 'received')`, `needs_credit (boolean, default false)`, `notes (text)`, `created_at (timestamptz)`.
7. **`credits`**
   - Columns: `id (uuid, PK)`, `project_id (uuid -> projects.id on delete cascade)`, `asset_id (uuid -> assets.id on delete set null)`, `source_name (text)`, `author (text)`, `license (text: 'cc0' | 'cc_by' | 'royalty_free' | 'proprietary' | 'other')`, `source_url (text)`, `notes (text)`, `created_at (timestamptz)`.
   - *Note: `asset_id` on delete set null preserves credit history even if the source asset is deleted.*
8. **`artifact_links`**
   - Columns: `id (uuid, PK)`, `project_id (uuid -> projects.id on delete cascade)`, `label (text)`, `type (text: 'figma' | 'figjam' | 'gdd' | 'build' | 'other')`, `url (text)`, `notes (text)`, `created_at (timestamptz)`.

---

## 4. Google Drive Integration & Dual-Write Resilience

### Folder Hierarchy
When a project is created, the system provisions the following folder structure in Google Drive without parentheticals:
```text
/GameDev Team/
  /[Project Name]/
    /Assets/
    /Builds/
    /GDD/
    /Design/
    /Credits/
```

### Dual-Write Pattern
1. **Step 1**: Write project or asset metadata into Supabase Postgres.
2. **Step 2**: Call the Google Drive API to provision the folder or stream the file.
3. **Step 3**: Record `drive_folder_id` or `drive_file_id` into the corresponding database row.
4. **Resilience**: If the Drive API call fails (rate-limit, timeout), retain the DB row with a warning status and provide an explicit **Retry** action in the UI. Never fail silently.

---

## 5. Directory Structure

Conforming to Next.js App Router conventions:
```text
pir-project/
├── app/
│   ├── (dashboard)/
│   │   └── page.tsx                   # Active projects overview
│   ├── projects/
│   │   ├── new/
│   │   │   └── page.tsx               # Create project form
│   │   └── [projectId]/
│   │       ├── page.tsx               # Project hub overview
│   │       ├── tasks/page.tsx         # Realtime task kanban
│   │       ├── milestones/page.tsx    # Milestone list & timeline
│   │       ├── assets/page.tsx        # Asset tracker & upload
│   │       ├── credits/page.tsx       # Credit tracker & export
│   │       └── artifacts/page.tsx     # Artifact links hub
│   ├── api/
│   │   ├── auth/callback/route.ts     # Google OAuth callback
│   │   └── ping/route.ts              # Keepalive ping endpoint
│   ├── globals.css                    # Preset b7C9smijg styling variables
│   └── layout.tsx                     # Root layout
├── actions/                           # Server Actions (Mutations)
│   ├── projects.ts
│   ├── tasks.ts
│   ├── milestones.ts
│   ├── assets.ts
│   ├── credits.ts
│   └── artifacts.ts
├── components/
│   ├── ui/                            # Official shadcn components only
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── skeleton.tsx
│   │   └── ...
│   └── [feature]/                     # Feature compositions built on shadcn
├── lib/
│   ├── supabase/                      # Supabase client & server instances
│   │   ├── client.ts
│   │   └── server.ts
│   └── gdrive/                        # Google Drive API & token helpers
│       ├── client.ts
│       ├── provisioning.ts
│       └── tokens.ts
├── supabase/
│   └── migrations/                    # SQL migration files
├── docs/
│   └── sprints/                       # Sprint specs & checklists
│       ├── sprint-1.md
│       ├── sprint-2.md
│       ├── sprint-3.md
│       ├── sprint-4.md
│       └── sprint-5.md
├── PRD-GameDev-Project-Manager.md
└── architecture.md
```

---

## 6. Implementation & UI Standards

1. **Server Actions vs API Routes**:
   - All mutations triggered within the UI must be handled via **Server Actions** (`actions/`).
   - API routes are reserved strictly for external endpoints (`/api/auth/callback`, `/api/ping`).
2. **Server Components Default**:
   - Pages and components fetch data server-side by default.
   - Use `"use client"` exclusively for components needing interactive hooks (`useState`, `useEffect`, drag-and-drop).
3. **Mandatory 4 UI States**:
   Every data-driven view must implement:
   - **Loading State**: Render shadcn `<Skeleton>`.
   - **Empty State**: Render clean shadcn `<Card>` with concise text and an action button.
   - **Error State**: Render shadcn `<Alert variant="destructive">` with a clear retry trigger.
   - **Populated State**: Responsive, clean layout.
4. **Copywriting Standards**:
   - All text in English.
   - Concise labels without parenthetical descriptions (e.g., `New Project`, `Assets`, `Status`, `Due Date`, `Export`).

---

## 7. Quality Gates & Definition of Done

Before any sprint or feature is marked complete:
1. **Zero-Error Build**: `npm run build` succeeds with zero TypeScript and build errors.
2. **Zero-Warning Lint**: `npm run lint` completes cleanly.
3. **Dual-System Verification**: Data writes to both Supabase and Google Drive remain consistent.
4. **UI Compliance**: Strict adherence to shadcn preset `b7C9smijg` and English microcopy without parenthetical annotations.
