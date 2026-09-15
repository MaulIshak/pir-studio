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
- Client hook subscribing to `postgres_changes` on `tasks` and `subtasks` tables filtered by `project_id`.
- Optimistic UI updates with realtime synchronization across browser sessions.

### Task 3.5: Hierarchical Subtasks & Checkbox Status Toggling
- Dedicated database table `subtasks` (`id`, `task_id`, `title`, `status: 'todo' | 'done'`, `position`, `created_at`).
- Server actions: `createSubtask`, `updateSubtaskStatus`, `updateSubtaskTitle`, `deleteSubtask`.
- Interactive shadcn `<Checkbox>` for subtasks directly in Kanban Card, Table View, and Task Detail Dialog.
- Expandable nested tree hierarchy in Table View with inline subtask creation.
- Subtask progress indicator (`X/Y` with progress bar) on cards and table rows.

---

## 3. Bug & Error Prevention Checklist

- [x] **Nullable Milestone Safety**: Tasks without a milestone (`milestone_id = null`) render and filter without runtime errors.
- [x] **Hierarchical Subtask Cascade**: Deleting a parent task cleanly cascades to all child subtasks.
- [x] **Realtime Cleanup**: Subscription channels on `tasks` and `subtasks` are cleaned up on unmount.
- [x] **Division by Zero Protection**: Progress calculations return 0% when zero tasks/subtasks exist.
- [x] **Responsive Kanban & Table**: Columns and nested rows stack gracefully on smaller screens.
- [x] **Strict shadcn Primitives**: Checkbox, Dialog, Dropdown, Card, and Badge components are strictly from shadcn.
- [x] **English Microcopy**: All labels (`Tasks`, `Subtasks`, `New Task`, `Assignee`, `Due Date`) are concise and in English.

---

## 4. Definition of Done

1. Kanban board displays all tasks across 4 columns with clean, responsive styling and clear subtask hierarchy.
2. Table View supports expandable tree rows showing child subtasks with checkboxes and inline addition.
3. Task and subtask status updates reflect instantly on other open sessions via Supabase Realtime and optimistic UI.
4. Milestone progress percentages and subtask completion ratios update accurately.
5. Mobile view operates smoothly without overflow issues.
6. `npm run build` and `npm run lint` execute with zero errors.
