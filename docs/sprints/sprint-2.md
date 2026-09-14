# Sprint 2: Project Management & Google Drive Auto-Provisioning

## 1. Goal
Implement core project management features:
1. Create project form with validation and concise English labels.
2. Server Actions for auto-provisioning the Google Drive folder hierarchy (`/GameDev Team/[Project Name]/...`).
3. Dual-write resilience handling with explicit retry capability on Drive API failures.
4. Project list and status filters using official shadcn components.

---

## 2. Task Breakdown

### Task 2.1: Google Drive Provisioning Helper (`lib/gdrive/provisioning.ts`)
- Implement folder creation logic:
  - Check or create shared root folder `/GameDev Team/`.
  - Create project folder `/GameDev Team/[Project Name]/`.
  - Create 5 clean subfolders without parenthetical notes:
    - `/Assets/`
    - `/Builds/`
    - `/GDD/`
    - `/Design/`
    - `/Credits/`
  - Return `drive_folder_id`.

### Task 2.2: Project Server Actions (`actions/projects.ts`)
- `createProject(data)`:
  1. Insert project record into `projects` table.
  2. Retrieve Google OAuth token from `oauth_tokens`.
  3. Call `provisionProjectFolders()`.
  4. Update project record with `drive_folder_id`.
  5. Handle Drive API errors gracefully: preserve the DB record with an error flag, allowing the user to retry.
- `updateProject(id, data)`: Update metadata without modifying Drive folder structure.
- `archiveProject(id)`: Soft-delete project by updating `status` to `archived`.
- `retryDriveProvisioning(projectId)`: Re-attempt Drive folder provisioning.

### Task 2.3: Create Project Form (`app/projects/new/page.tsx`)
- Form built strictly with shadcn primitives (`Form`, `Input`, `Select`, `Textarea`, `Button`).
- Concise English labels without parenthetical notes (`Name`, `Type`, `Start Date`, `Deadline`, `Description`).
- Zod schema validation and loading indicator on submit.

### Task 2.4: Project List & Filter View (`app/projects/page.tsx` & `app/(dashboard)/page.tsx`)
- Project cards composed with shadcn `<Card>`, `<Badge>`, `<Button>`.
- Filter controls for status: `Active`, `Completed`, `Archived`.
- Direct link to Google Drive folder using `https://drive.google.com/drive/folders/{folderId}`.
- Complete implementation of all 4 UI states: Skeleton, EmptyState, ErrorAlert, and Populated.

---

## 3. Bug & Error Prevention Checklist

- [x] **Dual-Write Isolation**: If Google Drive fails, the DB record is preserved and an alert banner with a Retry button appears.
- [x] **No Duplicate Root Folder**: The `/GameDev Team/` root folder is created once and reused for all subsequent projects.
- [x] **Strict shadcn**: No custom hand-rolled buttons, inputs, or cards; only official shadcn primitives are used.
- [x] **Clean Microcopy**: Labels contain zero parenthetical clarifications (e.g. `Type`, not `Type (Jam/Competition)`).
- [x] **Hydration Safety**: Dates are formatted safely without SSR/client hydration mismatches.
- [x] **Soft-Delete Integrity**: Archiving only alters `status` to `archived` without dropping DB rows or Drive files.

---

## 4. Definition of Done

1. Creating a project generates a database row and the exact Google Drive folder tree in < 5 seconds.
2. Drive folder links navigate directly to the correct project folder in Google Drive.
3. The project list displays all projects with correct status badges.
4. Drive API failures are handled gracefully with a functional retry mechanism.
5. `npm run build` and `npm run lint` execute with zero errors.
