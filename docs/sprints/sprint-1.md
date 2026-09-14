# Sprint 1: Core Architecture, Database Migration & Auth Setup

## 1. Goal
Establish the core foundation of the GameDev Project Manager:
1. Initialize the Next.js project with shadcn preset `b7C9smijg` (`--template next --pointer`).
2. Deploy the complete Supabase Postgres schema (8 tables) with Row Level Security (RLS) policies.
3. Configure the Supabase client and server helpers using `@supabase/supabase-client-nextjs`.
4. Implement Google OAuth with database-backed token storage (`oauth_tokens` table) to support Vercel serverless deployment.

---

## 2. Task Breakdown

### Task 1.1: Framework & UI Preset Setup
- Initialize Next.js with shadcn preset:
  ```bash
  npx shadcn@latest init --preset b7C9smijg --template next --pointer
  ```
- Install Supabase dependencies:
  ```bash
  npm install @supabase/supabase-js @supabase/ssr
  npx shadcn@latest add @supabase/supabase-client-nextjs
  ```
- Install required shadcn primitives:
  ```bash
  npx shadcn@latest add button card dialog dropdown-menu input table tabs badge form select textarea skeleton alert popover
  ```

### Task 1.2: Supabase Schema & Migrations
- Create migration file `supabase/migrations/20260914_initial_schema.sql` containing 8 tables:
  1. `profiles`
  2. `oauth_tokens`
  3. `projects`
  4. `milestones`
  5. `tasks`
  6. `assets`
  7. `credits`
  8. `artifact_links`
- Enable Row Level Security (RLS) on all 8 tables for `authenticated` users.
- Add trigger `on_auth_user_created` to sync new users from `auth.users` to `profiles`.

### Task 1.3: Environment & Supabase Helpers
- Configure `.env.local`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://imzqirqtyeeavrxvvaom.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_AViUsJSdZw9cILx79DiqIg_-JdgTev3
  ```
- Verify Supabase client instances in `lib/supabase/client.ts` and `lib/supabase/server.ts`.

### Task 1.4: Google OAuth & Database Token Storage
- Implement `app/api/auth/callback/route.ts` to exchange OAuth code for session.
- Store Google OAuth `access_token` and `refresh_token` in `oauth_tokens` on successful authentication.
- Create `lib/gdrive/tokens.ts` to fetch and refresh tokens directly from Supabase Postgres.

---

## 3. Bug & Error Prevention Checklist

- [ ] **Next.js Compilation**: `npm run build` succeeds without TypeScript or module resolution errors.
- [ ] **Preset Integrity**: `components.json` confirms `"style"` preset `b7C9smijg` with zero manual styling overrides.
- [ ] **RLS Coverage**: Every table has RLS enabled with permissive authenticated policies to avoid silent empty returns.
- [ ] **Vercel Read-Only Compliance**: No code attempts to write tokens to disk (`fs.writeFile`); all tokens persist to the database.
- [ ] **Foreign Key Cascades**: Foreign key delete actions match the specification (`credits.asset_id` uses `on delete set null`).
- [ ] **English Only**: All UI labels and messages are written in English without parenthetical text.

---

## 4. Definition of Done

1. Next.js runs cleanly at `localhost:3000` with preset `b7C9smijg` styles.
2. All 8 database tables and user sync triggers exist in Supabase Postgres.
3. Users can sign in via Google OAuth, generating a profile in `profiles` and persisting tokens in `oauth_tokens`.
4. `npm run build` and `npm run lint` execute with zero errors.
