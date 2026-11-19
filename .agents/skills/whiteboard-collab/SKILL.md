---
name: whiteboard-collab
description: Membangun whiteboard kolaboratif realtime (ala FigJam/Excalidraw) yang smooth dan production-ready di dalam aplikasi project management (hierarki organisasi → project → task), dengan whiteboard berada di level project dan terhubung ke task. Stack target: Next.js, Supabase, Garage (object storage S3-compatible), Excalidraw + Yjs + Hocuspocus. Gunakan skill ini setiap kali user menyebut whiteboard, board kolaborasi, kanvas bersama, Excalidraw, Yjs, Hocuspocus, kursor multiplayer, brainstorming visual, atau ingin menambah fitur gambar/diagram bersama ke aplikasi project management mereka, walaupun tidak menyebut semua teknologi di atas.
---

# Whiteboard Kolaboratif di Level Project

## Prinsip utama: jangan berasumsi, temukan dulu

Skill ini mendeskripsikan **konsep dan hasil akhir yang diinginkan**, bukan implementasi. Semua yang menyangkut aplikasi yang sudah ada (nama tabel, kolom, struktur folder, pola izin, pola API, UI kit, versi library, cara deploy) **tidak diketahui** dan harus Anda temukan sendiri dengan membaca kode, schema, dan konfigurasi. Contoh kode atau SQL di skill ini hanya ilustrasi bentuk; nama dan tipe harus disesuaikan dengan konvensi project.

Jika sesuatu tidak bisa ditemukan dan memengaruhi keputusan penting, ajukan **satu** pertanyaan ringkas. Jika tidak penting, pilih default yang paling sesuai dengan pola yang sudah ada dan tulis asumsinya secara eksplisit.

## Konsep produk

Aplikasi adalah project management untuk tim game dev indie (banyak yang mengerjakan game jam dan kompetisi). Hierarki data: **organisasi → project → task**.

Whiteboard ditempatkan di **level project**:

- Satu project dapat memiliki **banyak board** (mis. konsep game, level, alur menu, pemotongan scope). Membuat dan membuang board harus cepat, karena ritme game jam singkat.
- **Izin diwarisi dari project.** Anggota project dapat mengakses board project itu sesuai peran mereka di project. Jangan membuat sistem keanggotaan board yang terpisah, kecuali Langkah 0 menunjukkan kebutuhan yang tidak bisa dipenuhi dengan pewarisan.
- Whiteboard **bukan bagian dari task** dan bukan di level organisasi. Pengecualian: **template board** boleh dikelola di level organisasi lalu disalin ke project (lihat Fase 5).
- Board **terhubung ke task** lewat relasi, tanpa mengubah struktur task yang ada.

## Pilihan teknologi (sudah diputuskan)

| Lapisan | Pilihan |
|---|---|
| Kanvas | `@excalidraw/excalidraw` (MIT, gratis untuk komersial) |
| Sinkronisasi | Yjs (CRDT) |
| Server realtime | Hocuspocus (Node, WebSocket) |
| Auth, database | Supabase (pakai yang sudah ada di project) |
| Aset (gambar/file) | Garage lewat presigned URL |

Jika Langkah 0 menemukan konflik nyata dengan pilihan ini (mis. versi tidak kompatibel, kebijakan infrastruktur), laporkan dan usulkan alternatif sebelum melanjutkan; jangan mengganti diam-diam.

Prinsip kecepatan: **state live berada di memori server realtime; database hanya untuk persistensi (debounced).** Jangan pernah query database di jalur setiap perubahan. WebSocket persisten tidak cocok untuk lingkungan serverless, jadi server realtime berjalan sebagai proses long-lived; cara dan tempat menjalankannya ditentukan setelah memeriksa infrastruktur yang ada.

## Langkah 0: Investigasi (wajib sebelum menulis kode)

Baca kode dan konfigurasi, lalu catat temuan dalam ringkasan singkat. Hal yang harus dicari tahu:

1. **Aplikasi**: versi Next.js dan model routing yang dipakai, package manager, struktur repo (monorepo atau bukan), TypeScript dan lint, library UI dan styling, pola pemanggilan data (route handler, server action, atau lainnya), pola state/fetching di klien.
2. **Model data**: bagaimana organisasi, project, task, user, dan keanggotaan direpresentasikan. Nama tabel, kolom kunci, tipe id, konvensi penamaan, soft delete, timestamp, dan migration tool yang dipakai.
3. **Model izin**: peran apa saja yang ada di organisasi dan project, di mana logika izin berada (RLS, fungsi SQL, middleware, kode aplikasi, atau campuran), dan apa **satu sumber kebenaran** untuk pertanyaan "apakah user X boleh melihat/mengedit project Y". Seluruh akses board harus memakai sumber kebenaran yang sama.
4. **Supabase**: cara klien dibuat (server, browser, service role), cara sesi dan JWT bekerja, apakah RLS dipakai secara konsisten, cara migration dijalankan, dan jenis koneksi database yang tersedia untuk proses long-lived.
5. **Garage/object storage**: apakah sudah ada klien S3, nama bucket, konvensi key, env var, endpoint yang dapat dijangkau browser, dan konfigurasi CORS bucket saat ini.
6. **Deploy dan infrastruktur**: tempat aplikasi di-deploy, ada tidaknya Docker/compose/CI, reverse proxy, dan tempat yang wajar untuk menjalankan proses Node long-lived.
7. **Task**: field yang tersedia (judul, status, assignee, dll.), alur status, dan tempat pembuatan task (UI dan kode) agar fitur "jadikan task" memakai jalur yang sama dengan pembuatan task biasa, termasuk validasi dan side effect-nya (notifikasi, log aktivitas, dsb.).
8. **Versi library**: baca dokumentasi dan changelog versi `@excalidraw/excalidraw`, `yjs`, `@hocuspocus/*` yang akan dipasang. Nama prop dan API (mis. opsi update scene tanpa masuk undo stack, `reconcileElements`, fractional index, `customData`) berubah antar versi. Jangan mengandalkan ingatan; verifikasi di dokumentasi atau source di `node_modules`.
9. Cek apakah library komunitas pengikat Excalidraw–Yjs (mis. `y-excalidraw`) masih dirawat dan kompatibel. Jika tidak jelas, tulis binding sendiri (Fase 3).
10. Cek apakah sudah ada fitur serupa, komponen kanvas, atau navigasi di halaman project yang perlu diintegrasikan, bukan diduplikasi.

Akhiri langkah ini dengan ringkasan: apa yang ditemukan, asumsi yang dibuat, dan rencana singkat per fase.

## Fase 1: Model data dan izin

Rancang perubahan schema sesuai konvensi yang ditemukan di Langkah 0. Secara konsep dibutuhkan:

- **Board**: milik satu project, punya judul dan metadata standar (pembuat, waktu dibuat/diubah, status arsip sesuai konvensi project).
- **Snapshot board**: state Yjs gabungan per board (biner), diakses hanya oleh server realtime. Tidak boleh dapat dibaca atau ditulis langsung dari klien.
- **Aset board**: metadata file yang diunggah (id file Excalidraw, key objek, tipe, ukuran, pengunggah).
- **Tautan board–task**: relasi banyak-ke-banyak antara board dan task, dengan referensi opsional ke id elemen di kanvas.
- **Template board**: konten awal yang dapat disalin ke board baru, dikelola di level organisasi, dengan kemungkinan template bawaan sistem.

Ilustrasi bentuk (nama, tipe, dan referensi tabel harus disesuaikan):

```sql
-- ILUSTRASI SAJA: sesuaikan nama tabel/kolom/tipe dengan schema yang ada
boards          (id, project_id -> projects, title, created_by, created_at, updated_at, ...)
board_snapshots (board_id -> boards, state bytea, version, updated_at)
board_assets    (id, board_id -> boards, file_id, object_key, mime_type, size_bytes, uploaded_by, created_at)
board_task_links(board_id -> boards, task_id -> tasks, element_id nullable)
board_templates (id, organization_id nullable, title, content, is_system, created_at)
```

Aturan izin:

- Hak akses board **diturunkan dari peran pengguna di project induknya** lewat sumber kebenaran izin yang ditemukan di Langkah 0. Tentukan pemetaan peran (siapa boleh membuat/mengedit/melihat/menghapus board) mengikuti peran yang sudah ada; jangan membuat peran baru tanpa alasan.
- Terapkan izin di **setiap lapisan yang dipakai project** (RLS jika project memakainya, plus pengecekan di server realtime dan endpoint presign). Satu logika, banyak tempat pemanggilan; hindari menyalin aturan ke banyak tempat.
- Tambahkan index sesuai pola kueri (board per project, tautan per task, aset per board).
- Penghapusan project/board harus ikut menghapus data turunan dan objek di storage.

## Fase 2: Server realtime (Hocuspocus)

Proses Node terpisah yang menjadi pemilik state live board.

Kebutuhan wajib:

1. **Autentikasi per koneksi**: verifikasi token sesi Supabase (verifikasi tanda tangan, bukan sekadar decode). Dari nama dokumen, tentukan board dan project-nya, lalu cek izin lewat **sumber kebenaran izin yang sama** dengan aplikasi (query langsung dengan aturan yang sama, atau memanggil fungsi/endpoint internal; pilih yang paling konsisten dengan arsitektur yang ada). Tolak jika tidak berhak; jadikan koneksi **read-only** untuk peran yang hanya boleh melihat.
2. **Persistensi**: muat snapshot saat dokumen dibuka; simpan state gabungan (`Y.encodeStateAsUpdate`) secara **debounced** (dengan batas maksimum jeda). Pakai koneksi database yang sesuai untuk proses long-lived; simpan biner langsung.
3. **Graceful shutdown**: flush semua dokumen aktif sebelum proses berhenti, dan pastikan benar-benar ditunggu.
4. **Batasan**: ukuran pesan, jumlah koneksi per user per board, ukuran dokumen, jumlah elemen, dan rate limit per koneksi.
5. **Health check**, logging terstruktur (koneksi, error simpan, ukuran dokumen), dan metrik dasar.
6. **Skalabilitas**: rancang agar satu instance berjalan benar. Dokumentasikan jalur skala (extension Redis resmi atau sticky routing per board); jangan menjalankan banyak instance tanpa salah satunya.
7. **Jaringan produksi**: `wss://`, origin di-allowlist, WebSocket upgrade dan timeout idle di reverse proxy yang dipakai infrastruktur.
8. Packaging dan cara menjalankan mengikuti pola infrastruktur yang ditemukan di Langkah 0 (Docker, compose, CI, dll.).

## Fase 3: Klien (Next.js)

- Komponen kanvas dimuat **hanya di sisi klien** (Excalidraw tidak boleh di-render di server). Ikuti model routing dan pola komponen yang dipakai project.
- Akses board dicek di sisi server sebelum halaman dirender; tidak ada secret yang dikirim ke klien.
- Sediakan state **memuat, error (tidak berhak/tidak ditemukan), dan status koneksi** (terhubung, menyambung ulang, offline).

### Binding Excalidraw ↔ Yjs

Jika library pengikat yang ada layak (hasil Langkah 0), pakai. Jika tidak, tulis sendiri dengan prinsip berikut:

- Satu elemen = satu entri (mis. `Y.Map` dengan key id elemen), bukan satu struktur besar yang ditimpa utuh. Perubahan elemen berbeda oleh user berbeda tidak boleh saling bentrok.
- Penghapusan memakai penanda `isDeleted` seperti bawaan Excalidraw. Pembersihan elemen terhapus yang sudah lama dilakukan di server, bukan di klien.
- Urutan layer mengikuti mekanisme urutan di versi Excalidraw terpasang.
- **Lokal → Yjs**: kirim hanya elemen yang `version`-nya berubah, dalam satu transaksi dengan origin penanda lokal. Abaikan perubahan yang berasal dari remote (cegah echo loop).
- **Yjs → lokal**: abaikan transaksi dengan origin lokal. Gabungkan dengan elemen lokal memakai mekanisme rekonsiliasi Excalidraw (jangan menimpa elemen yang sedang di-drag/diedit user lokal), dan terapkan **tanpa memasukkannya ke undo stack lokal**. Batch update beruntun dengan `requestAnimationFrame`.
- **Undo/redo per user**: hanya membatalkan perubahan milik sendiri. Pakai mekanisme history Excalidraw versi terpasang yang mendukung kolaborasi, atau `Y.UndoManager` dengan origin terlacak; pilih satu, jangan campur.

### Awareness (presence)

- Gunakan awareness Yjs untuk pointer, nama, warna, elemen terpilih (opsional: viewport). Ini bersifat ephemeral dan **tidak disimpan di dokumen**.
- Throttle pengiriman pointer (~30–50 ms) dan kirim hanya bila berubah.
- Terjemahkan awareness ke daftar kolaborator Excalidraw; bersihkan saat user keluar.
- Nama dan avatar diambil dari profil user yang sudah ada di aplikasi; warna konsisten per user.

### Ketahanan koneksi

- Reconnect otomatis dengan backoff dan indikator status.
- Cache lokal (mis. `y-indexeddb`) agar perubahan offline tidak hilang dan board terbuka cepat; merge otomatis saat tersambung kembali.
- Token auth disediakan sebagai fungsi yang selalu mengambil sesi terbaru (token berumur pendek).
- Peringatan sebelum menutup tab bila ada perubahan yang belum tersinkron.

## Fase 4: Aset gambar (Garage)

Jangan menyimpan gambar (dataURL) di dokumen Yjs. Alur konsep:

1. Klien memvalidasi dan memperkecil gambar (batas dimensi dan ukuran ditentukan, sesuaikan dengan kebutuhan).
2. Klien meminta presigned URL upload ke endpoint aplikasi. Endpoint memverifikasi sesi dan izin board, memvalidasi tipe (allowlist) dan ukuran, menentukan key objek **di sisi server** (terikat ke board), dan mengembalikan URL berumur pendek dengan batasan konten.
3. Klien mengunggah langsung ke Garage; metadata aset dicatat (setelah verifikasi keberadaan objek).
4. Dokumen Yjs hanya menyimpan **referensi** ke aset (id file + metadata kecil).
5. Klien lain meminta presigned URL baca untuk id file yang baru muncul, lalu memasukkannya ke Excalidraw. Cache hasilnya.

Hal yang **harus diverifikasi** terhadap konfigurasi Garage yang berjalan, bukan diasumsikan:

- CORS bucket untuk origin aplikasi dan method/header yang dipakai upload.
- Gaya pengalamatan (path-style vs virtual-host), nama region, dan endpoint yang dapat dijangkau **browser** (bukan alamat internal).
- Perilaku checksum default AWS SDK v3 terhadap Garage versi terpasang (jika ada penolakan, atur opsi checksum SDK agar hanya dihitung bila diwajibkan).
- Bucket tetap privat; seluruh akses lewat presigned URL.
- Pembersihan objek yatim dan penghapusan objek saat board/project dihapus.

Jika sudah ada klien S3 atau helper upload di project, **pakai ulang**.

## Fase 5: Integrasi dengan project management

Fase inilah yang membuat whiteboard terasa menyatu dengan produk. Kerjakan berurutan:

1. **Daftar board di halaman project**: buat, ganti nama, arsipkan/hapus, buka. Letakkan di navigasi project mengikuti pola UI yang ada.
2. **Template board**:
   - Template bawaan yang relevan untuk game dev dan game jam, mis. brainstorming tema/ide, core loop, daftar fitur dengan prioritas (untuk memotong scope), blockout level, alur layar/menu.
   - Template di level organisasi yang bisa dibuat dari board yang ada.
   - Membuat board dari template = membuat board baru dengan konten awal tersalin; board hasil salinan tidak terhubung ke template.
   - Opsi: pembuatan project dengan tipe/kategori tertentu dapat menawarkan membuat board awal dari template. Hanya jika konsep tipe project sudah ada atau cocok dengan model data.
3. **Jadikan task dari kanvas**: pilih sticky note/teks/shape → buat task. Gunakan **jalur pembuatan task yang sama** dengan UI biasa (validasi, izin, notifikasi, log aktivitas). Simpan tautannya di tabel relasi, dan tandai elemen di kanvas dengan referensi ringan ke task (mis. lewat `customData` elemen Excalidraw, setelah memverifikasi dukungannya di versi terpasang). Dukung pembuatan banyak task sekaligus dari beberapa elemen terpilih.
4. **Dari task ke board**: di detail task tampilkan board terkait; membukanya menyorot elemen yang terhubung. Izinkan menautkan task yang sudah ada ke elemen di kanvas.
5. **Badge status task di kanvas**: tampilkan status task (dan opsional assignee) pada elemen yang terhubung. **Jangan menyalin status ke dokumen Yjs.** Render dari data task di aplikasi sebagai lapisan tampilan di klien, supaya status selalu sinkron dengan sumber kebenarannya, dan perbarui saat task berubah (mengikuti mekanisme pembaruan data yang sudah dipakai aplikasi).
6. **Penanganan tautan rusak**: bila task dihapus, elemen yang terhubung tetap utuh namun tidak lagi menampilkan badge; bila elemen dihapus, tautannya dibersihkan.
7. **Pelengkap**: ekspor (PNG, SVG, JSON) dan impor, thumbnail board (diunggah ke storage, diperbarui secara debounced), serta undangan/peran mengikuti sistem keanggotaan project yang ada (jangan membuat sistem undangan baru khusus board).

Setiap fitur di fase ini memakai komponen, pola UI, dan pola data yang sudah ada di aplikasi.

## Fase 6: Kualitas, uji, dan produksi

### Pengujian wajib
- **Multi-klien**: dua atau lebih konteks browser pada board yang sama (mis. Playwright dengan beberapa context) — gambar bersamaan, hapus bersamaan, edit elemen yang sama; kedua sisi harus konvergen ke state identik.
- **Offline dan reconnect**: putuskan jaringan satu klien, edit, sambungkan kembali.
- **Restart server realtime** saat klien terhubung: klien menyambung ulang tanpa kehilangan data.
- **Izin**: bukan anggota project ditolak; peran hanya-lihat tidak bisa menulis (coba paksa lewat klien yang dimodifikasi); token kedaluwarsa ditolak; user yang dikeluarkan dari project kehilangan akses ke board (termasuk koneksi yang sedang terbuka, tentukan strategi pemutusannya).
- **Integrasi task**: buat task dari kanvas, hapus task, hapus elemen, ubah status task dan pastikan badge ikut berubah.
- **Beban**: skrip dengan banyak klien Yjs headless (beberapa puluh per board, beberapa board paralel); amati latensi, memori, waktu simpan. Board besar (ribuan elemen) harus tetap responsif; jika tidak, profil dan perbaiki.

### Daftar periksa produksi
- [ ] `wss://`, TLS, origin di-allowlist, timeout proxy sesuai
- [ ] JWT diverifikasi dan izin dicek per koneksi lewat sumber kebenaran izin yang sama dengan aplikasi
- [ ] Akses snapshot hanya dari server; klien tidak bisa membaca/menulisnya langsung
- [ ] Persistensi debounced dan flush saat shutdown teruji
- [ ] Backup mencakup snapshot board di database dan bucket Garage
- [ ] Batas ukuran dan rate limit: pesan WS, dokumen, elemen, aset, upload, endpoint presign
- [ ] Health check, log terstruktur, alert untuk kegagalan simpan
- [ ] Env var terdokumentasi; secret tidak masuk bundle klien
- [ ] Rencana scaling didokumentasikan
- [ ] Dokumentasi singkat: arsitektur, menjalankan lokal, deploy, memulihkan board dari snapshot

## Cara bekerja

1. Mulai dengan Langkah 0, ringkas temuan dan asumsi, lalu kerjakan per fase.
2. **Setiap fase berakhir dengan sesuatu yang dapat dijalankan dan diuji.** Fase 1–3 sudah menghasilkan board kolaboratif dasar per project; Fase 4 menambah gambar; Fase 5 menyatukannya dengan project dan task.
3. Ikuti konvensi kode, penamaan, dan pola yang sudah ada. Jangan memperkenalkan pola baru bila pola yang ada sudah cukup.
4. Batasi perubahan di luar cakupan whiteboard (mis. navigasi, env var, migration) dan jelaskan tiap perubahan semacam itu.
5. Jangan mengarang nama API. Bila ragu tentang Excalidraw, Yjs, Hocuspocus, Supabase, atau Garage, baca dokumentasi atau source versi terpasang.
6. Setelah selesai, jalankan type-check, lint, dan test yang ada; laporkan apa yang sudah diuji dan apa yang belum (terutama uji multi-klien dan beban).
