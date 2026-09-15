# GameDev Project Manager

A lightweight, high-velocity project management web application tailored for game development teams (5–8 members) participating in game jams and game development competitions.

GameDev Project Manager provides a unified execution workspace that links project schedules, task kanban boards, hierarchical subtask checklists, milestones, asset trackers, credit/license attribution, and artifact links directly to organized Google Drive storage.

---

## ⚡ Key Features

- **Project Hub**:
  - Centralized overview of active, completed, and archived projects.
  - Game jam and competition countdown timers and deadline tracking.
  - Automated Google Drive folder provisioning upon project creation (`/GameDev Team/[Project Name]/...`).
- **Task Management & Hierarchical Subtasks**:
  - Interactive **Kanban Board** with 4 columns: `To Do`, `In Progress`, `Review`, and `Done`.
  - Structured **Table View** with expandable tree rows clearly delineating parent tasks and child subtasks.
  - **Hierarchical Subtasks**: Checklist items with interactive checkboxes (`todo` / `done`), inline quick-add, completion progress bars (`X/Y`), and optimistic UI updates.
  - **Supabase Realtime**: Live updates synchronized across all open browser sessions without manual refresh.
- **Milestones**:
  - Timeline management with automated task completion percentages (`(done tasks / total tasks) * 100%`).
- **Asset Pipeline & References**:
  - Asset status workflow (`To Do` → `In Progress` → `Done` → `Implemented`).
  - Multi-file asset bundles (texture atlases, sprite sheets, sound packages).
  - Visual asset references with gallery grid and lightbox zoom.
  - Dual-write resilience between Supabase and Google Drive streaming.
- **License & Credit Management**:
  - Track asset licenses (`CC0`, `CC-BY`, `Royalty-Free`, `Proprietary`, `Other`), author names, and source URLs.
  - One-click export to **Markdown** or **Plaintext** ready for game submission credit screens or itch.io release descriptions.
- **Artifact Links Hub**:
  - One-click access to external resources including Game Design Documents (GDD), Figma/FigJam boards, engine builds, and repositories.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) | React 19, Server Components by default, Server Actions for mutations. |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) (Preset `b7C9smijg`) | Clean, accessible primitives configured with `--pointer` interaction flag. |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) | Modern utility-first CSS with dark mode and theme tokens. |
| **Icons** | [Phosphor Icons](https://phosphoricons.com/) (`@phosphor-icons/react`) | Unified visual language across all dialogs, tables, and buttons. |
| **Database & Auth** | [Supabase](https://supabase.com/) | PostgreSQL database, Row Level Security (RLS), Supabase Auth, Realtime. |
| **Cloud Storage** | [Google Drive API v3](https://developers.google.com/drive) (`googleapis`) | Direct folder provisioning and asset streaming. OAuth tokens securely stored in Postgres. |
| **Validation** | [Zod 4](https://zod.dev/) + React Hook Form | Type-safe form validation and Server Action schemas. |
| **Hosting** | [Vercel](https://vercel.com/) | Serverless edge deployment with read-only runtime compliance. |

---

## 🗄️ Database Architecture

The application runs on 11 PostgreSQL tables in Supabase, protected by Row Level Security (RLS) policies allowing authenticated team members full collaboration:

```
+-----------------------------------------------------------------------------------+
|                                  SUPABASE POSTGRES                                |
|                                                                                   |
|  +----------------+        +-----------------+        +------------------------+  |
|  |    profiles    |<-------|   oauth_tokens  |        |        projects        |  |
|  +----------------+        +-----------------+        +------------------------+  |
|          ^                                                  ^     ^        ^      |
|          |                                                  |     |        |      |
|          +--------------------------+                       |     |        |      |
|                                     |                       |     |        |      |
|  +----------------+        +-----------------+              |     |        |      |
|  |     tasks      |------->|   milestones    |              |     |        |      |
|  +----------------+        +-----------------+              |     |        |      |
|     ^     |                                                 |     |        |      |
|     |     |                                                 |     |        |      |
|     |     +-------------------------------------------+     |     |        |      |
|     |                                                 |     |     |        |      |
|  +--+-------------+        +-----------------+        +-----+     |        |      |
|  |    subtasks    |        |     assets      |--------------------+        |      |
|  +----------------+        +-----------------+                             |      |
|     |                         ^        ^                                   |      |
|  +--+-------------+           |        |        +-----------------+        |      |
|  |  asset_bundles |-----------+        +--------|     credits     |        |      |
|  +----------------+                             +-----------------+        |      |
|                                                 +-----------------+        |      |
|  +------------------+                           |  artifact_links |<-------+      |
|  | asset_references |                           +-----------------+               |
|  +------------------+                                                             |
+-----------------------------------------------------------------------------------+
```

### Table Summary:
1. **`profiles`**: User details synced automatically from `auth.users`.
2. **`oauth_tokens`**: Encrypted Google OAuth tokens for Vercel serverless Drive operations.
3. **`projects`**: Game project records, deadlines, metadata, and root Drive folder IDs.
4. **`milestones`**: Key checkpoints and delivery dates per project.
5. **`tasks`**: Work items linked to projects/milestones with status (`todo`, `in_progress`, `review`, `done`). *(Realtime enabled)*
6. **`subtasks`**: Hierarchical checklist items with boolean status (`todo`, `done`). *(Realtime enabled)*
7. **`asset_bundles`**: Composite packages (atlases, sound packs) stored in Google Drive.
8. **`assets`**: Individual audio, sprite, 3D model, and VFX entries.
9. **`asset_references`**: Visual reference image attachments for gallery grids and zoom lightboxes.
10. **`credits`**: Licensing source records, author attribution, and license types.
11. **`artifact_links`**: External URLs (Figma, GDD, Git repo, WebGL builds).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 20.x or higher
- **npm** or **pnpm**
- A **Supabase** project (free tier is fully supported)
- A **Google Cloud Console** OAuth 2.0 Client ID & Secret with Google Drive API enabled

### 1. Clone & Install
```bash
git clone https://github.com/MaulIshak/pir-studio.git
cd pir-studio
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>

# Google OAuth & Drive Integration
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
```

### 3. Apply Database Migrations
Migrations are stored in `supabase/migrations/`:
- `20260914_initial_schema.sql` (Initial 8 tables, triggers, RLS)
- `20260915_add_bundles_and_references.sql` (Asset bundles & visual references)
- `20260915000000_add_subtasks_table.sql` (Hierarchical subtasks with realtime)

Apply these to your remote Supabase instance via the Supabase CLI:
```bash
npx supabase db push
```
Or execute the SQL files directly in the Supabase SQL Editor.

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server with Turbopack. |
| `npm run build` | Compiles the production build. |
| `npm run start` | Runs the production server locally. |
| `npm run typecheck` | Validates TypeScript types across the entire project (`tsc --noEmit`). |
| `npm run lint` | Checks ESLint rules and code formatting. |
| `npm run format` | Formats code using Prettier with Tailwind CSS plugin. |

---

## 📐 Design & Architectural Principles

- **Zero-Cost Operation**: Fully functional on free-tier services (Vercel + Supabase Free + Google Drive).
- **Vercel Serverless Compliance**: No persistent local disk usage; all session state and Google OAuth refresh tokens are stored in Supabase Postgres.
- **Server Actions Over API Routes**: All mutations from UI forms and dialogs use Next.js Server Actions under `actions/`. API routes (`app/api/`) are reserved strictly for external webhooks or OAuth redirects.
- **Strict UI System**: Standardized on shadcn/ui components (`preset b7C9smijg`) and Phosphor Icons. Hand-rolled or unstyled ad-hoc components are prohibited.
- **Concise English Microcopy**: Clean, brief UI labeling with zero parenthetical annotations (e.g., `Tasks`, `New Task`, `Subtasks`, `Assets`, `Status`).
