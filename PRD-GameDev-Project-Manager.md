# PRD: GameDev Project Manager

## Project Summary

**Nama kerja**: GameDev Project Manager (bisa diganti nama tim/studio)

**Latar belakang**
Tim game development kecil (5-8 orang) yang sering mengerjakan game jam dan kompetisi saat ini mengelola project menggunakan spreadsheet baru per project, koordinasi asset lewat WhatsApp, dan penyimpanan artifak (Figma, GDD, build) yang tersebar. Ini menyebabkan:
- Link project berceceran, tidak ada satu tempat untuk melihat semua project aktif
- Timeline/milestone dibuat manual tiap kali, rawan tidak konsisten
- Asset yang dikirim via WhatsApp sering tidak jelas statusnya (sudah masuk project atau belum, sudah direview atau belum)
- Informasi sumber/lisensi asset untuk kebutuhan credit sering hilang
- Tidak ada tempat terpusat untuk link artifak (Figma, FigJam, GDD, build)

**Tujuan produk**
Membangun satu aplikasi web internal yang jadi *single source of truth* untuk seluruh project tim: task & milestone, tracking asset, referensi/credit, dan link artifak — dengan file fisik tetap disimpan di Google Drive.

**Target pengguna**: 5-8 anggota tim internal, intensitas pemakaian tidak merata (aktif tinggi saat game jam, rendah di antaranya).

**Prinsip desain**
- Tidak overengineering — fitur dikunci sesuai pain point yang nyata, bukan "karena bisa"
- Zero cost — Next.js (Vercel free), Supabase (free tier), Google Drive sebagai storage file
- Semua anggota tim punya akses penuh (tanpa role/permission kompleks) di v1
- Auth via Google OAuth (satu langkah, sekaligus untuk akses Drive API)

**Stack teknis**
- Frontend: Next.js (App Router), Tailwind CSS
- Backend/DB: Supabase (Postgres, Auth, Realtime opsional)
- File storage: Google Drive API (folder auto-provisioned per project)
- Auth: Supabase Auth + Google OAuth provider
- Deploy: Vercel (frontend), Supabase Cloud (backend)
- Uptime: cron ping (GitHub Actions) untuk mencegah Supabase free tier pause karena inaktivitas

**Skema data inti**: `profiles`, `projects`, `milestones`, `tasks`, `assets`, `credits`, `artifact_links`

**Lingkup v1 (in-scope)**
- CRUD project, milestone, task
- Asset intake + tracking status
- Credit/reference tracker terpusat + export
- Link artifak eksternal (Figma, GDD, build, dll)
- Auto-provisioning folder Drive per project
- Dashboard ringkas semua project aktif

**Di luar lingkup v1 (out-of-scope, sengaja ditunda)**
- Role & permission granular
- Notifikasi push/email/Slack integration otomatis
- Versioning build otomatis / CI-CD integration
- Analytics/reporting mendalam
- Mobile app native

---

## Fitur 1: Project Management (CRUD Project)

**Masalah yang diselesaikan**
Setiap project baru butuh setup manual (bikin spreadsheet, folder, dsb) dan linknya tersebar di berbagai tempat (chat, dokumen, bookmark pribadi).

**User story**
- Sebagai anggota tim, saya ingin membuat project baru dalam satu langkah, lengkap dengan folder Drive yang otomatis tersusun rapi.
- Sebagai anggota tim, saya ingin melihat semua project (aktif maupun selesai) dalam satu tempat.

**Functional requirements**
1. Form buat project baru: nama, tipe (Game Jam / Kompetisi / Internal), tanggal mulai, deadline, deskripsi singkat (opsional)
2. Saat project dibuat, sistem otomatis:
   - Insert row ke tabel `projects`
   - Panggil Google Drive API untuk membuat struktur folder:
     ```
     /GameDev Team/[Nama Project]/
       /Assets/
       /Builds/
       /GDD/
       /Design (Figma-FigJam)/
       /Credits/
     ```
   - Simpan `drive_folder_id` ke row project
3. List semua project dengan filter status (Aktif / Selesai / Arsip) dan tipe
4. Halaman detail project sebagai hub: menampilkan tab Tasks, Milestones, Assets, Credits, Artifact Links
5. Edit metadata project (nama, deadline, status) — tidak mengubah folder Drive yang sudah ada
6. Arsipkan project (soft-delete, status berubah jadi "Archived", tidak muncul di dashboard utama tapi tetap bisa diakses)

**Data model**
```sql
projects (
  id uuid primary key,
  name text not null,
  type text check (type in ('jam','competition','internal')),
  start_date date,
  deadline date,
  status text check (status in ('active','completed','archived')) default 'active',
  description text,
  drive_folder_id text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)
```

**Acceptance criteria**
- Membuat project baru menghasilkan folder Drive dengan struktur yang benar dalam < 5 detik
- Project baru langsung muncul di dashboard tanpa refresh manual
- Jika Drive API gagal, project tetap tersimpan di database dengan flag error, dan user bisa retry pembuatan folder

**Non-goals**: tidak ada nested sub-project, tidak ada template project custom di v1 (semua project pakai struktur folder yang sama).

---

## Fitur 2: Task & Milestone Management

**Masalah yang diselesaikan**
Timeline dan pembagian task dibuat manual di spreadsheet setiap project, tidak konsisten, dan sulit dilihat progress-nya sekilas.

**User story**
- Sebagai lead project, saya ingin menetapkan milestone dengan deadline agar tim tahu target besar.
- Sebagai anggota tim, saya ingin melihat task yang jadi tanggung jawab saya dan mengubah statusnya.
- Sebagai lead, saya ingin melihat progress project dalam bentuk board sederhana.

**Functional requirements**
1. Milestone: judul, deadline, status (Belum Mulai / Berjalan / Selesai), terhubung ke satu project
2. Task: judul, deskripsi (opsional), assignee (dari anggota tim), due date, status (To Do / In Progress / Review / Done), terhubung ke project dan opsional ke satu milestone
3. Tampilan board (kanban sederhana: To Do → In Progress → Review → Done) per project, drag-and-drop untuk ubah status
4. Tampilan list milestone dengan progress bar (jumlah task selesai / total task di bawah milestone tsb)
5. Filter task: by assignee, by status, by milestone
6. Update status task oleh siapa saja di tim (tanpa approval — tim kecil, saling percaya)

**Data model**
```sql
milestones (
  id uuid primary key,
  project_id uuid references projects(id),
  title text not null,
  due_date date,
  status text check (status in ('not_started','in_progress','done')) default 'not_started'
)

tasks (
  id uuid primary key,
  project_id uuid references projects(id),
  milestone_id uuid references milestones(id) null,
  title text not null,
  description text,
  assignee_id uuid references profiles(id) null,
  status text check (status in ('todo','in_progress','review','done')) default 'todo',
  due_date date,
  created_at timestamptz default now()
)
```

**Acceptance criteria**
- Board menampilkan task real-time (via Supabase Realtime) — kalau anggota lain ubah status, langsung terlihat tanpa refresh
- Milestone menampilkan persentase task selesai secara akurat
- Task tanpa milestone tetap valid (tidak wajib terikat milestone)

**Non-goals**: bukan Gantt chart, bukan dependency antar-task (belum perlu untuk durasi jam yang pendek).

---

## Fitur 3: Asset Deliverables & Tracker

**Masalah yang diselesaikan**
Kebutuhan asset (sprite, audio, model 3D, font, VFX) sering tidak terdefinisi dari awal sehingga tim bingung apa saja yang harus dibuat. Selain itu, asset yang dikirim lewat WhatsApp sering tercecer, referensi visual hilang, dan file bundle seperti texture atlas sulit dihubungkan ke banyak item asset sekaligus.

**User story**
- Sebagai lead/game designer/artist, saya ingin menyusun daftar deliverable asset yang diperlukan untuk game (bahkan sebelum file fisiknya dibuat), lengkap dengan referensi visualnya.
- Sebagai artist, saya ingin menghubungkan asset ke Task terkait (misal task "Gameplay UI Art" memiliki asset health bar, inventory icon, minimap panel).
- Sebagai artist, saya ingin mem-paste gambar referensi langsung dari clipboard (Ctrl+V) dan melihatnya dalam gallery grid dengan fitur zoom.
- Sebagai artist/developer, saya ingin mengupload file asset baik secara individual per item maupun dalam bentuk bundle (Texture Atlas / Sprite Sheet) yang mencakup banyak item asset sekaligus.
- Sebagai tim, saya ingin melacak siklus status asset: `To Do` -> `In Progress` -> `Done` -> `Implemented`.

**Functional requirements**
1. **Asset Deliverables Backlog (List-First)**:
   - Form penambahan asset: nama asset, tipe (Sprite/Audio/3D Model/Font/VFX/Other), task terkait (opsional/terhubung ke tabel `tasks`), status awal (default: `To Do`), referensi gambar (opsional), file asset (opsional), catatan, dan checkbox butuh credit.
   - Asset dapat dibuat tanpa file fisik terlebih dahulu sebagai checklist target produksi.
2. **Koneksi ke Task**:
   - Setiap item asset dapat dihubungkan ke satu Task (`task_id`). Satu task dapat memiliki banyak deliverable asset.
   - Kanban Task Card & Task Detail menampilkan counter dan daftar deliverable asset yang terhubung.
3. **Siklus Status 4-Tahap**:
   - `To Do`: Asset terdaftar sebagai target pembuatan, belum mulai dikerjakan.
   - `In Progress`: Asset sedang aktif dikerjakan oleh artist/audio designer.
   - `Done`: File fisik asset sudah selesai dibuat dan diupload ke Google Drive.
   - `Implemented`: Asset sudah diintegrasikan ke dalam game engine/build project.
4. **Dua Model Upload ke Google Drive**:
   - **Single Asset File**: Upload 1 file fisik untuk 1 item asset spesifik.
   - **Atlas / Asset Bundle**: Upload 1 file komposit (misal texture atlas, sprite sheet, audio pack) yang langsung meng-cover beberapa item dari list asset sekaligus. Sistem mencatat bundle di tabel `asset_bundles` dan menghubungkan semua asset terpilih.
5. **Visual References Gallery & Clipboard Paste**:
   - Mendukung upload gambar referensi dan **Paste langsung dari clipboard (`Ctrl+V`)** dengan instant client-side preview.
   - Tampilan **Gallery Grid**: menampilkan seluruh gambar referensi dalam bentuk grid responsif.
   - Fitur **Zoom / Lightbox**: klik pada gambar referensi membuka tampilan zoom/fullscreen beresolusi penuh.
   - **Hard Delete**: setiap gambar referensi dapat dihapus secara permanen (hard delete dari database dan Google Drive).
6. **Search & Filter**:
   - Filter tabel asset berdasarkan Tipe, Status, Task Terkait, dan Ketersediaan File (With File, Missing File, Single File, Atlas/Bundle).

**Data model**
```sql
asset_bundles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  drive_file_id text not null,
  file_name text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

asset_references (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id) on delete cascade,
  drive_file_id text not null,
  file_name text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  name text not null,
  type text check (type in ('sprite','audio','3d_model','font','vfx','other')),
  uploaded_by uuid references profiles(id),
  drive_file_id text,
  bundle_id uuid references asset_bundles(id) on delete set null,
  file_name text,
  status text check (status in ('todo','in_progress','done','implemented')) default 'todo',
  needs_credit boolean default false,
  notes text,
  created_at timestamptz default now()
);
```

**Acceptance criteria**
- Asset dapat dibuat sebagai backlog tanpa mewajibkan file fisik upload awal.
- File asset (individual maupun atlas bundle) otomatis streaming dan tersimpan rapi di Google Drive `/Assets/`.
- Gambar referensi tersimpan di Google Drive `/Design/` dan dapat dilihat via Gallery Grid serta di-zoom resolusi penuh.
- Paste gambar dari clipboard via `Ctrl+V` berfungsi mulus dan menampilkan preview seketika.
- Menghapus gambar referensi mengeksekusi hard-delete permanen.
- Status asset dapat diubah seketika antara `To Do`, `In Progress`, `Done`, dan `Implemented`.

---

## Fitur 4: Credit / Reference Tracker

**Masalah yang diselesaikan**
Informasi sumber dan lisensi asset (untuk kebutuhan credit di game) sering hilang atau tercecer, tidak ada tempat terpusat.

**User story**
- Sebagai anggota tim, saya ingin mencatat sumber/author/lisensi setiap asset eksternal begitu dipakai, supaya tidak lupa saat submission/rilis.
- Sebagai lead, saya ingin generate daftar credit lengkap untuk satu project dengan satu klik.

**Functional requirements**
1. Entry credit: nama sumber/author, judul asset, lisensi (dropdown: CC0, CC-BY, Royalty-Free, Proprietary/Beli, Lainnya), link sumber asli, catatan, terhubung opsional ke satu row di `assets`
2. Bisa ditambah manual (untuk hal yang bukan file asset, misal font dari Google Fonts, sound library, dsb) atau otomatis ter-trigger dari Fitur 3 saat asset ditandai "butuh credit"
3. Tabel credit per project, bisa di-search
4. Tombol "Export Credits" — generate dokumen (Google Doc atau PDF sederhana) berisi daftar credit terformat, siap ditempel ke README/end-credit game
5. Validasi ringan: entry credit dengan lisensi selain CC0 wajib mengisi link sumber

**Data model**
```sql
credits (
  id uuid primary key,
  project_id uuid references projects(id),
  asset_id uuid references assets(id) null,
  source_name text not null,
  author text,
  license text check (license in ('cc0','cc_by','royalty_free','proprietary','other')),
  source_url text,
  notes text,
  created_at timestamptz default now()
)
```

**Acceptance criteria**
- Semua credit satu project bisa di-export jadi satu dokumen terformat dalam < 10 detik
- Entry credit tidak bisa hilang — selalu terikat ke project, muncul di tabel walau asset terkait sudah dihapus (asset_id nullable, source_name tetap tersimpan)

**Non-goals**: bukan sistem lisensi otomatis-detect, bukan pengecekan hukum/legal compliance otomatis.

---

## Fitur 5: Artifact Links

**Masalah yang diselesaikan**
Link ke Figma, FigJam, GDD, build, dan artifak lain tersebar dan sulit ditemukan kembali.

**User story**
- Sebagai anggota tim, saya ingin menyimpan semua link penting (Figma, FigJam, GDD, build terakhir) di satu tempat per project.

**Functional requirements**
1. Entry link: label (bebas, misal "GDD v2", "Build Playtest 3"), tipe (Figma/FigJam/GDD/Build/Lainnya), URL, catatan opsional
2. List link per project, dikelompokkan by tipe
3. Tambah/edit/hapus link
4. Untuk file yang disimpan di Drive (bukan link eksternal seperti Figma), sediakan tombol "Upload ke folder [Builds/GDD]" yang langsung upload ke folder Drive terkait dan generate link otomatis

**Data model**
```sql
artifact_links (
  id uuid primary key,
  project_id uuid references projects(id),
  label text not null,
  type text check (type in ('figma','figjam','gdd','build','other')),
  url text not null,
  notes text,
  created_at timestamptz default now()
)
```

**Acceptance criteria**
- Semua link penting satu project bisa ditemukan dalam satu tab tanpa perlu scroll chat/dokumen lain

**Non-goals**: bukan embed preview Figma di dalam app (cukup link keluar).

---

## Fitur 6: Dashboard

**Masalah yang diselesaikan**
Tidak ada satu tempat untuk melihat gambaran semua project yang sedang berjalan dan urgensinya.

**User story**
- Sebagai anggota tim, saya ingin begitu login langsung tahu project mana yang aktif dan mendekati deadline.

**Functional requirements**
1. List card project aktif, menampilkan: nama, tipe, deadline, countdown hari tersisa, progress ringkas (persentase task selesai)
2. Urutkan otomatis by deadline terdekat
3. Highlight visual untuk project dengan deadline < 3 hari (khas game jam)
4. Quick action: tombol "Project Baru" langsung dari dashboard
5. Toggle untuk lihat project Archived/Completed (default hidden)

**Acceptance criteria**
- Dashboard load dalam < 2 detik untuk skala data tim ini (puluhan project, ratusan task)
- Countdown deadline akurat sesuai timezone tim

**Non-goals**: bukan dashboard analytics/statistik historis (bisa jadi fitur v2 kalau memang dibutuhkan nanti).




