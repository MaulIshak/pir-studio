# Sprint 5: Dashboard Optimization, Uptime Maintenance & Final E2E Audit

## 1. Goal
Finalize production readiness:
1. Optimize main Dashboard (`app/(dashboard)/page.tsx`) with deadline urgency indicators (< 3 days) and progress summaries.
2. Verify all UI components implement all 4 mandatory states (Skeleton, Empty, Error, Populated) and adhere strictly to shadcn preset `b7C9smijg`.
3. Configure the `/api/ping` keepalive endpoint and GitHub Actions workflow to prevent Supabase free tier inactivity pausing.
4. Execute an end-to-end verification across the complete team workflow.

---

## 2. Task Breakdown

### Task 5.1: Main Dashboard (`app/(dashboard)/page.tsx`)
- Active project cards displaying:
  - Project name and type.
  - Remaining days countdown.
  - Urgency highlight: visual badge when deadline is < 3 days.
  - Progress summary: task completion percentage.
  - Quick action buttons: `New Project` and `Drive Folder`.
- Sorting by nearest deadline.
- Toggle for archived/completed projects.

### Task 5.2: UI Standard & 4-State Verification
- Audit all pages for strict adherence to shadcn preset `b7C9smijg`:
  - Zero unstyled or hand-rolled HTML primitives.
  - Official shadcn buttons, inputs, dialogs, cards, badges, and tables only.
- Ensure every view handles:
  1. `<Skeleton>` loading state.
  2. `<Card>` empty state with brief title and action button.
  3. `<Alert variant="destructive">` error state.
  4. Populated responsive view.

### Task 5.3: Supabase Uptime Pinger
- Create keepalive route `app/api/ping/route.ts` executing a lightweight query against Supabase.
- Create GitHub Actions workflow `.github/workflows/uptime-ping.yml` scheduled to ping `/api/ping` periodically.

### Task 5.4: End-to-End Audit
- Complete scenario testing:
  1. Google OAuth sign-in.
  2. Create a project -> verify Google Drive folder provisioning.
  3. Add milestones and tasks -> verify kanban drag-and-drop and realtime sync.
  4. Submit an asset -> verify file presence in Google Drive `/Assets/`.
  5. Add a credit record -> execute "Export" and inspect document output.
  6. Add artifact link -> verify external link navigation.
  7. Verify dashboard progress summary and urgency badges.

---

## 3. Bug & Error Prevention Checklist

- [x] **Fast Dashboard Loading**: Dashboard loads active projects in < 2 seconds.
- [x] **Timezone Consistency**: Countdown calculations are reliable across timezones.
- [x] **Error Handling**: Server Actions wrap logic in `try-catch` returning readable error states.
- [x] **Uptime Ping Reliability**: `/api/ping` is lightweight and authenticated/protected appropriately.
- [x] **English & Concise Copy**: All labels are concise, natural English with zero parenthetical annotations.
- [x] **Strict shadcn**: UI uses official shadcn components exclusively.

---

## 4. Definition of Done

1. Dashboard displays project cards with accurate countdowns and urgency alerts.
2. GitHub Actions keepalive workflow is configured and functional.
3. All 4 UI states are validated across all features.
4. Complete game dev workflow runs without failure.
5. `npm run build` and `npm run lint` execute with zero errors.
