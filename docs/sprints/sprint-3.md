# Sprint 3: Milestone & Task Kanban Board (Realtime)

## 1. Goal
Develop the central project execution hub:
1. Project Hub page (`app/projects/[projectId]/page.tsx`) with shadcn tab navigation.
2. Milestone management with automated task completion progress calculation.
3. Interactive Task Kanban board (`To Do` -> `In Progress` -> `Review` -> `Done`).
4. Supabase Realtime integration on `tasks` table for live updates across team members.

---

## 2. Task Breakdown

### Task 3.1: Project Hub Layout (`app/projects/[projectId]/layout.tsx`)
- Header displaying project name, type, status, countdown, and Drive folder link.
- Tab navigation using shadcn `<Tabs>` with clean English labels:
  - `Tasks`
  - `Milestones`
  - `Assets`
  - `Credits`
  - `Artifacts`

### Task 3.2: Milestone Management (`actions/milestones.ts` & `app/projects/[projectId]/milestones/page.tsx`)
- Server Actions for creating, editing, and completing milestones.
- Milestone list with progress bar calculated as `(done tasks / total tasks) * 100%`.
- Create milestone modal using shadcn `<Dialog>`.

### Task 3.3: Task Management & Kanban Board (`actions/tasks.ts` & `app/projects/[projectId]/tasks/page.tsx`)
- Server Actions:
  - `createTask(data)`: Title, description, assignee, due date, optional milestone.
  - `updateTaskStatus(taskId, newStatus)`: Update task status.
  - `deleteTask(taskId)`: Delete task.
- Kanban board composed of official shadcn components:
  - 4 status columns: `To Do`, `In Progress`, `Review`, `Done`.
  - `<TaskCard>` displaying title, assignee, due date, and shadcn `<Badge>`.
  - Create task modal dialog.

### Task 3.4: Supabase Realtime Subscription
- Client hook subscribing to `postgres_changes` on the `tasks` table filtered by `project_id`.
- Optimistic UI updates with realtime synchronization across browser sessions.

---

## 3. Bug & Error Prevention Checklist

- [ ] **Nullable Milestone Safety**: Tasks without a milestone (`milestone_id = null`) render and filter without runtime errors.
- [ ] **Realtime Cleanup**: Subscription channels are cleaned up on component unmount to prevent memory leaks.
- [ ] **Division by Zero Protection**: Progress calculations return 0% when zero tasks exist, avoiding `NaN` or crashes.
- [ ] **Responsive Kanban**: Columns stack gracefully on mobile screens without horizontal layout breaking.
- [ ] **Strict shadcn Primitives**: Dialog, Dropdown, Card, and Badge components are strictly from shadcn.
- [ ] **English Microcopy**: All labels (`Tasks`, `New Task`, `Assignee`, `Due Date`) are concise and in English.

---

## 4. Definition of Done

1. Kanban board displays all tasks across 4 columns with clean, responsive styling.
2. Task status updates reflect instantly on other open sessions via Supabase Realtime.
3. Milestone progress percentages update accurately as tasks are completed.
4. Mobile view operates smoothly without overflow issues.
5. `npm run build` and `npm run lint` execute with zero errors.
