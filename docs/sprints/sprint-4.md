# Sprint 4: Asset Tracker, Credit Tracker & Artifact Links

## 1. Goal
Implement asset intake, license credits, and external artifact management:
1. Asset intake form streaming files directly to the project's `/Assets/` Drive folder and recording metadata in Supabase.
2. Asset tracker table with status updates and credit flags.
3. Credit / reference tracker for external licenses.
4. One-click "Export Credits" feature producing formatted attribution documents.
5. Artifact Links hub for centralizing external resources (Figma, FigJam, GDD, Builds).

---

## 2. Task Breakdown

### Task 4.1: Asset Intake & Upload Handler (`lib/gdrive/upload.ts` & `actions/assets.ts`)
- File upload streaming directly into the project's `/Assets/` subfolder in Google Drive.
- Server Action `createAsset(formData)`:
  - Stream file to Google Drive -> obtain `drive_file_id`.
  - Insert row in `assets` table (name, type, uploaded_by, drive_file_id, status: 'received', needs_credit, notes).
- Server Action `updateAssetStatus(assetId, newStatus)`: Update status to `received`, `review`, `integrated`, or `rejected`.

### Task 4.2: Asset Tracker UI (`app/projects/[projectId]/assets/page.tsx`)
- Action button "New Asset" opens a shadcn `<Dialog>` with upload input and metadata fields.
- Asset table using shadcn `<Table>`:
  - Columns: Name, Type, Uploader, Date, Status, Credit, and Drive Link.
  - Filters for type (`Sprite`, `Audio`, `3D Model`, `Font`, `VFX`, `Other`) and status.

### Task 4.3: Credit / Reference Tracker (`actions/credits.ts` & `app/projects/[projectId]/credits/page.tsx`)
- Server Actions:
  - `createCredit(data)`: Source name, author, license (`CC0`, `CC-BY`, `Royalty-Free`, `Proprietary`, `Other`), source URL, notes, optional `asset_id`.
  - `deleteCredit(creditId)`: Delete credit entry.
- Validation: Require `source_url` for non-CC0 licenses.
- Credit table built with shadcn `<Table>`.
- One-click **"Export"** action generating a clean formatted Markdown / text attribution file.

### Task 4.4: Artifact Links Hub (`actions/artifacts.ts` & `app/projects/[projectId]/artifacts/page.tsx`)
- Server Actions to add, edit, and delete artifact links.
- Link list grouped by type (`Figma`, `FigJam`, `GDD`, `Build`, `Other`) using shadcn `<Card>`.
- Direct upload button for build or GDD files directly into `/Builds/` or `/GDD/` on Drive.

---

## 3. Bug & Error Prevention Checklist

- [x] **Data Retention on Delete**: Deleting a row in `assets` NEVER deletes the associated row in `credits` (`asset_id` sets to `null`).
- [x] **Payload Limits**: File uploads handle serverless size constraints gracefully with user feedback.
- [x] **Direct Drive Link Format**: Uses standard Drive view URLs (`https://drive.google.com/file/d/{fileId}/view`).
- [x] **Clean Microcopy**: Labels are concise and free of parenthetical text (e.g., `New Asset`, `Export`, `Needs Credit`).
- [x] **Strict shadcn**: All UI components use official shadcn primitives.

---

## 4. Definition of Done

1. Uploaded files appear in the `/Assets/` subfolder in Google Drive.
2. Asset metadata is stored in Supabase with functional status updates.
3. "Export" action generates a formatted attribution document in < 3 seconds.
4. Artifact links open target external tools directly.
5. `npm run build` and `npm run lint` execute with zero errors.
