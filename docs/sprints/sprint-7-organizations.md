# Sprint 7: Multi-Tenant Organizations & RBAC

**Theme**: Transforming the project into an Organization $\rightarrow$ Project $\rightarrow$ Tasks hierarchy with Role-Based Access Control, notification hub, invitation links, project membership assignment, and a personal user dashboard.

---

## Sprint 1: Database Migration & Core RBAC Engine (Completed)

### 1. Database Migration
- Created `supabase/migrations/20260929000000_add_organizations_and_rbac.sql`
  - `organizations` table for tenant metadata (`id`, `name`, `slug`, `description`, timestamps).
  - `organization_members` table with role checking (`'leader' | 'co_leader' | 'member'`).
  - `project_members` table mapping explicit project assignments for `member` role users.
  - `organization_invitations` table with cryptographically secure tokens, expiration dates, and role assignment.
  - `notifications` table for user-facing invitations and status alerts.
  - Added `organization_id` foreign key to `projects`.
  - **Safe Production Backfill**:
    - Automatically created `"Pir Berkacamata"` organization.
    - Identified **Maulana Ishak** in `profiles` and assigned as `leader`.
    - Added all existing users into `organization_members` as `member`.
    - Associated all existing projects with `"Pir Berkacamata"`.
    - Populated `project_members` for existing users so zero access or data is lost.
    - Enabled RLS policies and Realtime publications on `notifications` and `organization_members`.

### 2. Authorization & Server Actions
- Created `lib/auth/permissions.ts` with centralized helpers:
  - `getCurrentUser()`
  - `getUserOrgRole(orgId, userId)`
  - `hasProjectAccess(projectId, userId)` (automatic access for Leader & Co-Leader, explicit check for Member)
  - `requireProjectAccess(projectId)`
  - `requireOrgAdmin(orgId)`
  - `requireOrgLeader(orgId)`
- Created `lib/auth/active-org.ts`:
  - Cookie-based active organization tracking with automatic fallback to first organization.
- Created `actions/organizations.ts`:
  - `getActiveOrg()`, `switchActiveOrg(orgId)`, `getUserOrganizations()`
  - `createOrganization({ name, description, invitations })`
  - `getOrganizationMembers(orgId)`, `updateOrganization(orgId, data)`
  - `updateMemberRole(orgId, targetUserId, newRole)`
  - `removeMember(orgId, targetUserId)`
  - `inviteMember(orgId, email, role)`
  - `assignProjectsToMember(orgId, memberUserId, projectIds)`
- Updated `actions/projects.ts`:
  - Project creation strictly restricted to `leader` and `co_leader` (Members rejected with clear message).
  - Project lists automatically filtered by active organization and project membership.
  - Added `getProjectMembers(projectId)` returning unified list of Leaders, Co-Leaders, and assigned Members with role badges.

---

## Sprint 2: Organization Switcher, Management & Invitation Links (Completed)

### 1. Notifications Center
- Created `actions/notifications.ts` (`getUserNotifications`, `acceptOrgInvitation`, `declineOrgInvitation`, `getInvitationByToken`, `markNotificationAsRead`).
- Built `components/notifications/notifications-popover.tsx` with unread notification badge count, invitation accept/decline actions with loading states, and Supabase Realtime auto-refresh.
- Integrated into `components/layout/top-nav-bar.tsx`.

### 2. Organization Switcher & Creation
- Created `components/layout/org-switcher.tsx` with organization dropdown, current active organization badge, role indicator, and "Create Organization" action.
- Mounted at top of `components/layout/app-sidebar.tsx`.
- Built `components/organizations/create-org-form.tsx` and `app/orgs/new/page.tsx` with dynamic invitation rows and role picker.

### 3. Shareable Invitation Link Page
- Built `app/invite/[token]/page.tsx` and `components/organizations/invitation-card.tsx`.
- Displays Organization name, Leader name & avatar, current authenticated user profile (`Signed in as ...`), and Accept / Decline actions.
- Automatically redirects unauthenticated guests to `/login?next=/invite/[token]`.

### 4. Organization Settings & Member Management
- Built `app/orgs/[slug]/page.tsx` (Organization Dashboard) showing organization metrics, project roster, and member overview.
- Built `app/orgs/[slug]/members/page.tsx` and `components/organizations/member-management.tsx`:
  - Send direct email invites with role selection.
  - Copy shareable invite links with instant clipboard copy.
  - Change member roles (Leader only).
  - Manage project access for Members (Leader & Co-Leader).
  - Remove members (Leader only).

---

## Sprint 3: Project Members, Assignee Scoping & Task Role Badges (Completed)

### 1. Project Members Tab
- Updated `components/projects/project-nav.tsx` to include `Members` navigation tab.
- Created `components/projects/project-members-view.tsx` and `app/projects/[slug]/members/page.tsx`.
- Displays all project collaborators grouped by their organization role (`Leader`, `Co-Leader`, `Member`).
- Provides Leaders and Co-Leaders with an inline dialog to assign additional organization members to the project.

### 2. Scoped Task Assignee Selection with Role Badges
- Updated `components/tasks/create-task-dialog.tsx` and `components/tasks/edit-task-dialog.tsx` to accept `members` from `getProjectMembers(projectId)` instead of global profiles.
- Displayed role badges (`Leader`, `Co-Leader`, `Member`) next to assignee names in dropdown selectors and assignee badges.
- Updated `components/tasks/task-card.tsx` to support role badges on task assignee avatars.

---

## Sprint 4: Personal User Dashboard, Quick Actions & Polish (Completed)

### 1. Personal User Dashboard
- Revamped `app/page.tsx` into a personalized user dashboard:
  - Personal metrics: Assigned Tasks, In Progress, Due Soon, Accessible Projects.
  - My Tasks section with status filter tabs (`All`, `To Do`, `In Progress`, `Done`, `Overdue`).
  - **Quick Actions**: Dropdown menu on each task item to immediately change status without entering the kanban board, plus a direct button to jump to the project's task board.
  - Accessible Projects grid displaying project status, deadlines, and member counts.

### 2. Quality & Verification
- All automated checks pass cleanly:
  - `npm run typecheck` $\rightarrow$ 0 errors.
  - `npm run lint` $\rightarrow$ 0 warnings / errors.
  - `npm run build` $\rightarrow$ Successfully built all static and dynamic routes.
- Documentation synced across `architecture.md`, `PRD-GameDev-Project-Manager.md`, `README.md`, `AGENTS.md`, and `.agents/skills/supabase-schema/SKILL.md`.
