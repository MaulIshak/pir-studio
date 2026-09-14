---
name: gdrive-integration
description: Google Drive API integration patterns for the GameDev Project Manager app — OAuth scope, folder provisioning structure, file upload flow, and token handling. Use this skill whenever writing code that creates Drive folders, uploads files, generates Drive links, handles Google OAuth tokens, or touches the `drive_folder_id` / `drive_file_id` columns. Always consult this skill before writing new Drive API code — do not request broader OAuth scopes or invent a different folder structure than the one defined here.
---

# Google Drive Integration

This skill defines how the app talks to Google Drive. Drive is used purely as file storage (assets, builds, GDDs, credits exports); Supabase Postgres remains the source of truth for all metadata. Every file stored in Drive must have its Drive file/folder ID mirrored in the corresponding Supabase row (`drive_folder_id` on `projects`, `drive_file_id` on `assets`).

## OAuth scope

Always request the narrowest scope that works:

```
https://www.googleapis.com/auth/drive.file
```

Do **not** request `https://www.googleapis.com/auth/drive` (full access) or `drive.readonly` alone. `drive.file` grants access only to files/folders the app itself creates — this is a deliberate security choice so the app cannot see or touch the user's unrelated personal Drive files. If a feature seems to need broader access, flag it to the user instead of silently widening the scope.

Auth flow: Supabase Auth handles Google sign-in; request the Drive scope as an **additional scope** on the same OAuth consent (via `provider_scopes` / custom Supabase Auth config), not a second separate OAuth flow. 
**PENTING (Vercel Read-Only Filesystem)**: Karena aplikasi dideploy di Vercel yang memiliki *read-only filesystem*, SEMUA token Google OAuth (`access_token`, `refresh_token`, `expires_at`) **WAJIB DISIMPAN DI DATABASE** (tabel `oauth_tokens`), bukan di file lokal/disk. Server Actions membaca token dari database dan otomatis me-refresh serta meng-update token baru kembali ke database sebelum memanggil Google Drive API.

## Folder structure (must be provisioned exactly this way)

When a new project is created, the app must create this exact folder tree in Drive and store the top-level folder's ID as `projects.drive_folder_id`:

```
/GameDev Team/
  /[Project Name]/
    /Assets/
    /Builds/
    /GDD/
    /Design/
    /Credits/
```

- The `/GameDev Team/` root folder should be created once (if it doesn't already exist) and reused for every project — do not create a new root each time.
- Do not add extra subfolders, template files, or README stubs inside newly created project folders unless the user asks for it — keep provisioning minimal.
- Folder creation should happen server-side (Server Action or API route), not client-side, since it uses the stored OAuth token.

## Upload flow

1. User submits a file via the asset intake form, or via the artifact link upload button.
2. Server-side handler uploads the file directly into the correct subfolder (`/Assets/` for asset intake, `/Builds/` or `/GDD/` for artifact links) using the `drive_folder_id` already stored on the project.
3. On successful upload, store the returned Drive file ID as `assets.drive_file_id` (or generate the corresponding `artifact_links.url`).
4. If the Drive upload fails, do not silently mark the asset/task as successful in the UI — surface the error and allow retry. Never let a database row claim a file exists in Drive when it doesn't.

## Link generation

Use `https://drive.google.com/file/d/{fileId}/view` for file links and `https://drive.google.com/drive/folders/{folderId}` for folder links. Do not attempt to embed Drive file previews inside the app in v1 — a simple "Open in Drive" link is sufficient per the PRD (no embedded preview is in scope).

## Error handling & resilience

- Drive API calls can fail independently of the Supabase write — always handle them as two separate steps, and make the failure state visible (e.g. a `pending_drive_sync` flag or a UI error banner), not a silent no-op.
- Respect Drive API rate limits: batch folder creation calls when provisioning a new project (5 folders) rather than firing them with no delay/backoff if you observe rate-limit errors in testing.
- Token refresh failures (e.g. revoked access) should redirect the user to re-authenticate rather than fail with a generic 500 error.

## Explicitly out of scope for v1

- No file versioning inside the app (Drive's own version history is sufficient).
- No in-app file preview/embed.
- No Drive webhook/push notifications for external changes made directly in Drive.
