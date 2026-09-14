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

## Fitur 3: Asset Tracker

**Masalah yang diselesaikan**
Asset (sprite, audio, model 3D, font, dll) dikirim lewat WhatsApp dan sering tidak jelas: sudah pernah dikirim atau belum, sudah masuk ke project atau belum, sudah direview atau belum.

**User story**
- Sebagai anggota tim, saya ingin submit asset baru lewat satu form resmi agar tercatat dan file-nya otomatis tersimpan di folder project yang benar.
- Sebagai lead/artist, saya ingin melihat status semua asset (diterima, direview, sudah diintegrasikan, ditolak) dalam satu tabel.
- Sebagai anggota tim, saya ingin tahu asset mana yang butuh info credit sebelum dipakai.

**Functional requirements**
1. Form intake asset: nama asset, tipe (Sprite/Audio/3D Model/Font/VFX/Lainnya), file upload (langsung ke Drive folder `/Assets/` project terkait), catatan (opsional), checkbox "butuh credit?"
2. Setelah submit, asset otomatis berstatus "Diterima" dan tercatat siapa pengirim serta waktunya
3. Tabel asset tracker per project, kolom: nama, tipe, pengirim, status, butuh credit (ya/tidak), link file Drive, tanggal masuk
4. Update status oleh reviewer: Diterima → Direview → Diintegrasikan / Ditolak
5. Jika asset ditandai "butuh credit", muncul prompt untuk mengisi detail credit (bisa langsung atau nanti, terhubung ke Fitur 4)
6. Search/filter asset by nama, tipe, status

**Data model**
```sql
assets (
  id uuid primary key,
  project_id uuid references projects(id),
  name text not null,
  type text check (type in ('sprite','audio','3d_model','font','vfx','other')),
  uploaded_by uuid references profiles(id),
  drive_file_id text,
  status text check (status in ('received','review','integrated','rejected')) default 'received',
  needs_credit boolean default false,
  notes text,
  created_at timestamptz default now()
)
```

**Acceptance criteria**
- File yang diupload lewat form langsung tersedia di folder Drive `/Assets/` project yang benar
- Tidak ada asset yang bisa "hilang jejak" — semua submission tercatat dengan pengirim dan waktu
- Status asset bisa diubah oleh anggota tim manapun (tanpa role approval khusus di v1)

**Non-goals**: bukan versioning asset (revisi 1, 2, 3), bukan preview file di dalam app (cukup link ke Drive).

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




