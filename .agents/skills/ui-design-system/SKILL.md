---
name: ui-design-system
description: UI design system and component conventions for the GameDev Project Manager app, strictly built on shadcn/ui using preset b7C9smijg (--template next --pointer). Use this skill whenever building or modifying any page, component, form, table, or board in the app. Always consult this skill before writing UI code.
---

# UI Design System — shadcn/ui Preset `b7C9smijg`

## ⚠️ ATURAN MUTLAK (ABSOLUTE RULES)
1. **WAJIB Berbasis shadcn/ui Preset `b7C9smijg`**:
   - Inisialisasi wajib dijalankan dengan:
     ```bash
     npx shadcn@latest init --preset b7C9smijg --template next --pointer
     ```
2. **DILARANG Membuat Komponen UI Sendiri / Komponen Default**:
   - DILARANG hand-roll / membuat komponen UI primitif kustom (seperti tombol custom, input custom, modal custom, dsb) atau memakai tag HTML polos tanpa styling shadcn.
   - SEMUA komponen UI (Button, Input, Card, Dialog, Table, Tabs, Badge, DropdownMenu, Form, Select, Textarea, Sheet, Tooltip, Avatar, Skeleton, Alert, Popover, dll.) **HANYA dan WAJIB** dipasang via `npx shadcn@latest add [component]` dan dikomposisikan sesuai preset.
   - Komponen fitur aplikasi (misal: TaskCard, AssetRow) HANYA boleh dibuat sebagai *komposisi* dari komponen resmi shadcn (`Card`, `Badge`, `Button`, dsb).
3. **WAJIB Loading State (Skeleton View)**:
   - WAJIB selalu menampilkan loading state menggunakan shadcn `<Skeleton>` atau route `loading.tsx` saat fetching data.
   - DILARANG membiarkan layar kosong (blank) atau layout tanpa placeholder skeleton saat data sedang dimuat dari server/database.

## Component Installation
Komponen dipasang menggunakan CLI shadcn:
```bash
npx shadcn@latest add button card dialog dropdown-menu input table tabs badge form select textarea skeleton alert popover
```

## Styling & Token Guidelines
- Mengikuti tokens, CSS variables, dan utilities yang dihasilkan dari preset `b7C9smijg`.
- Tidak diperbolehkan menyisipkan warna hex *hardcoded* (seperti `#1e293b` atau `#ff0000`). Selalu gunakan token semantik Tailwind / shadcn (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-destructive`, dsb).
- Pertahankan pointer interaction sesuai flag `--pointer`.
- **Warna & Accent Lebih Kaya**: Gunakan aksen warna lebih terasa di halaman (bukan hanya tombol), seperti tinted card backgrounds (`bg-primary/5 border-primary/20`), colored metric icon backdrops (`bg-primary/10 text-primary`, `bg-emerald-500/10 text-emerald-500`), progress accents gradient, dan status rings.
- **Informative & Aesthetic Icons**: Selalu sematkan icon Phosphor yang informatif dan estetik pada judul, metrik, status, tabs, dan tabel tanpa berlebihan/berantakan. Setiap icon harus memiliki makna konteks yang jelas.
- **Smooth & Professional Framer Motion**:
  - Terapkan animasi halus, cepat, dan profesional (durasi 0.2s - 0.35s) pada transisi halaman, card entrances (`initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}`), tab switches, dan interactive elements.
  - Hindari animasi berlebihan atau mengganggu (no bouncy/distracting loops).

## Komposisi Fitur
- **Status Badges**: Gunakan shadcn `<Badge variant="...">` untuk status (To Do, In Progress, Review, Done, Received, Integrated, Rejected).
- **Cards & Boards**: Gunakan `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`, `<CardFooter>` dari shadcn untuk setiap card project dan card kanban.
- **Tables**: Gunakan shadcn `<Table>`, `<TableHeader>`, `<TableRow>`, `<TableHead>`, `<TableBody>`, `<TableCell>` untuk tabel Assets, Credits, dan Artifacts.
- **Forms**: Gunakan shadcn `Form` (React Hook Form + Zod) yang dipadukan dengan shadcn `Input`, `Select`, `Textarea`, dan `Button`.
- **States (Loading/Empty/Error)**:
  - Loading: shadcn `<Skeleton>`.
  - Empty state: Dikomposisikan menggunakan shadcn `<Card>` / icon Phosphor + teks muted + tombol shadcn `<Button>` yang relevan (DILARANG mengarahkan tombol empty state sub-halaman ke Create Project).
  - Error: Gunakan shadcn `<Alert variant="destructive">`.

## Konsistensi & Checklist Sebelum Selesai Setiap Fitur
- [ ] Menggunakan HANYA komponen resmi dari shadcn preset `b7C9smijg`
- [ ] Tidak ada komponen UI custom/primitif mandiri atau tag unstyled
- [ ] Menangani 4 status wajib: Loading, Empty, Error, Populated
- [ ] Tombol Empty State sesuai konteks fitur (bukan hardcoded ke create project)
- [ ] Aksen warna dinamis dan konsisten di seluruh halaman
- [ ] Icon Phosphor bermakna dan estetik
- [ ] Animasi halus framer-motion diterapkan
- [ ] Desain responsif dan ramah aksesibilitas
- [ ] Tidak ada hardcoded color hex atau inline style asing
