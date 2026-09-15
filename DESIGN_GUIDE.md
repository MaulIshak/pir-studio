# GameDev Project Manager — Design System & UI Guide

> **Design Philosophy**: High-density, professional developer-tool aesthetic (Linear / GitHub Projects). Clean, purposeful, rich in semantic accents, and completely free of gimmicky decorations or unnecessary AI-style widgets.

---

## 1. Absolute Rules & Non-Negotiables

1. **Strictly shadcn/ui Preset `b7C9smijg` (`--template next --pointer`)**:
   - All primitive UI components (Buttons, Inputs, Cards, Dialogs, Tables, Tabs, Badges, Selects, Skeletons, Alerts, Dropdowns) must originate from shadcn CLI:
     ```bash
     npx shadcn@latest add [component]
     ```
   - **Never hand-roll custom primitive UI** or write unstyled raw HTML elements.
   - Application components (`TaskCard`, `MilestoneRow`, `AssetTable`) are strictly compositions of official shadcn components.

2. **Always Render Loading States (`Skeleton`)**:
   - Every data-fetching route and view **must** render a loading state using Next.js `loading.tsx` or shadcn `<Skeleton>`.
   - Never leave a blank or unstyled screen while fetching data from Supabase or Google Drive.

3. **Contextual Empty States**:
   - Sub-page empty states (Milestones, Assets, Credits, Artifacts) must provide direct contextual creation dialogs (e.g. `New Milestone`, `New Asset`).
   - **Never hardcode empty state actions to `/projects/new`**.

4. **Zero Parenthetical Annotations & English Microcopy**:
   - All UI text must be in English.
   - Ultra-brief labeling (1–2 words preferred).
   - **Never include parenthetical clarifications in UI labels**:
     - ❌ `Design (Figma/FigJam)` →  `Design`
     - ❌ `Type (Jam / Competition / Internal)` →  `Type`
     - ❌ `Status (Active / Completed / Archived)` →  `Status`
     - ❌ `Needs Credit? (External License)` →  `Needs Credit`

5. **Identical Select Trigger & Item Labels**:
   - All `<Select>` inputs must display the exact same human-readable label in the dropdown item and when selected in the trigger.
   - Raw UUIDs (`3f3879ea...`) or snake_case enums (`in_progress`, `cc_by`) must **never** leak into the UI.

---

## 2. Typography

| Role | Font Family | CSS Variable | Usage |
| :--- | :--- | :--- | :--- |
| **Primary Sans** | **Noto Sans** | `--font-sans` | Body text, card titles, form labels, buttons, dialogs |
| **Headings** | **Noto Sans** | `--font-heading` | Page titles (`h1`, `h2`), section headers |
| **Monospace** | **Geist Mono** | `--font-mono` | Dates, deadlines, countdowns, percentages, badges, UUIDs, code |

### Typography Hierarchy
- **Page Title (`h1`)**: `font-heading text-2xl font-bold tracking-tight sm:text-3xl text-foreground`
- **Section / Card Title**: `text-xs font-semibold uppercase tracking-wider text-foreground`
- **Item Title**: `text-xs font-semibold leading-snug break-words text-foreground`
- **Body / Descriptions**: `text-xs text-muted-foreground`
- **Metadata / Timestamps**: `font-mono text-[10px] sm:text-xs text-muted-foreground`

---

## 3. Color Palette & Semantic Accents

The app uses dark-mode first semantic tokens with rich, deliberate color accents throughout the page—not just on buttons.

### Color Accents & Usage Matrix

| Context | Tailwind Accent Classes | Usage |
| :--- | :--- | :--- |
| **Primary / Active** | `text-primary bg-primary/10 border-primary/20` | Active links, In Progress tasks, primary actions |
| **Success / Done** | `text-emerald-400 bg-emerald-500/10 border-emerald-500/20` | Done tasks, completed milestones, Drive synced, shipped entries |
| **Warning / Jam** | `text-amber-400 bg-amber-500/10 border-amber-500/20` | Review status, game jam type badge, credit requirements |
| **Danger / Urgent** | `text-destructive bg-destructive/10 border-destructive/20` | Deadlines < 3 days ("Due Soon"), overdue dates, delete actions |
| **Neutral / To Do** | `text-slate-400 bg-slate-500/10 border-slate-500/20` | To Do tasks, unassigned states, archived projects |
| **Competition** | `text-purple-400 bg-purple-500/10 border-purple-500/20` | Competition project badges, Figma links |

### Deep Page Tinting
Apply subtle ambient gradients to cards and metrics to establish depth without visual noise:
```tsx
// Metric / Urgent Card
className="border-destructive/25 bg-gradient-to-br from-destructive/10 via-destructive/5 to-card transition-all duration-200 hover:shadow-sm"

// Completed Card
className="border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-card transition-all duration-200 hover:shadow-sm"

// Primary Card
className="border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-card transition-all duration-200 hover:shadow-sm"
```

---

## 4. Iconography Standards

All icons are strictly sourced from `@phosphor-icons/react` (or `@phosphor-icons/react/dist/ssr` for RSCs).

### Rules for Icons
1. **Meaningful & Communicative**: Every icon must convey functional meaning (e.g. `DotsSixVertical` = drag grip, `ClockCountdown` = urgent deadline). Never sprinkle random decorative icons.
2. **Standard Sizes**:
   - Inline badge / micro icons: `size-2.5` to `size-3`
   - Action / button icons: `size-3.5` to `size-4`
   - Header / section icons: `size-4` to `size-5`
   - Empty state icons: `size-7` to `size-8`
3. **Paired Icon Container**:
   Place key metric and header icons inside tinted squircle containers:
   ```tsx
   <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
     <GameController className="size-4" />
   </div>
   ```

### Standard Icon Mappings
- **Navigation & Brand**: `GameController`, `SquaresFour`, `Kanban`, `GoogleDriveLogo`, `GoogleLogo`, `SignOut`
- **Task & Milestone Status**: `CircleDashed` (To Do), `Play` (In Progress), `Eye` (Review), `CheckCircle` (Done)
- **Actions**: `Plus` (Create), `PencilSimple` (Edit), `Trash` (Delete), `DownloadSimple` (Export), `DotsThreeVertical` (Menu), `DotsSixVertical` (Drag Handle)
- **Metadata**: `CalendarBlank` (Date), `ClockCountdown` (Deadline), `Flag` (Milestone), `User` (Assignee), `Scroll` (Attribution)

---

## 5. Animation & Motion Guidelines

Motion must be **fast, subtle, and professional** using `framer-motion`. Never use long, bouncy, or distracting loops.

### Standard Animation Durations
- Hover transitions: `0.15s`
- Page / card entrance: `0.2s - 0.25s`
- Modal / accordion expansion: `0.2s`

### Card Entrance & Hover Pattern
```tsx
<motion.div
  initial={{ opacity: 0, y: 6 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95 }}
  whileHover={{ y: -2, transition: { duration: 0.15 } }}
  transition={{ duration: 0.2 }}
>
  <Card className="...">{/* Card Content */}</Card>
</motion.div>
```

### Layout Reordering & Tabs
Always use `layout` and `<AnimatePresence mode="popLayout">` for dynamic lists, filter transitions, and kanban reordering so items glide smoothly into place instead of popping:
```tsx
<AnimatePresence mode="popLayout" initial={false}>
  {tasks.map((task) => (
    <TaskCard key={task.id} task={task} />
  ))}
</AnimatePresence>
```

---

## 6. Component Patterns & Recipes

### 1. Draggable Kanban Card
- Whole card has `cursor-grab active:cursor-grabbing`.
- Drag grip icon (`DotsSixVertical`) with `text-muted-foreground/40 group-hover:text-muted-foreground/80`.
- During active drag: `opacity-40 border-dashed border-primary/50 bg-primary/5 shadow-none`.
- Inner buttons and dropdown triggers must stop mouse-down propagation (`onMouseDown={(e) => e.stopPropagation()}`) to prevent accidental drag triggers.
- Accessible 3-dot menu with `Move to [Status]` preserved for keyboard and mobile users.

### 2. Column Drop Zone
- On drag hover, the column highlights with:
  ```tsx
  isDropTarget && "ring-2 ring-primary/40 border-primary/60 bg-primary/[0.04] shadow-md"
  ```
- Displays an animated drop target indicator slot:
  ```tsx
  <div className="flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-primary/50 bg-primary/10 py-3 text-xs font-medium text-primary transition-all animate-pulse">
    <ArrowDown className="size-3.5" />
    Drop to move to {col.label}
  </div>
  ```

### 3. Gantt Roadmap & Timeline
- **Gantt Chart**:
  - Dual-pane layout: Fixed 280px left table + horizontal timeline grid with 7-day date ruler.
  - Dynamic red dashed line marking "Today".
  - Proportional duration bars mapped to project start/deadline dates.
  - Emerald fill for `Done`, Violet fill for `In Progress`, bordered pill for `Not Started`.
- **Linear Timeline**:
  - Thin 1px vertical stem with 10px circular status nodes.
  - High-density milestone row with task progress summary and jump button to Kanban board.

### 4. Form Dialogs
- Max width: `sm:max-w-[480px]` or `sm:max-w-[500px]`.
- Field labels: `text-xs font-medium text-foreground`.
- Inputs / Select triggers: `h-9 text-xs`.
- Form footer: Cancel button (`variant="outline"`) on the left, Primary Submit on the right.
- Pending state: Show loading label (`Saving...`, `Uploading...`) and disable buttons.

---

## 7. Quality Checklist for New Features

Before marking any UI task or sprint complete, verify:
- [ ] **shadcn/ui only**: No hand-rolled raw HTML buttons or inputs.
- [ ] **Noto Sans**: Consistent typography across all text and headings.
- [ ] **Loading states**: Route `loading.tsx` or skeleton components present.
- [ ] **Contextual empty states**: Actions open specific dialogs, never redirecting to `/projects/new`.
- [ ] **Rich color accents**: Status colors applied across badges, borders, and metric containers.
- [ ] **Purposeful icons**: Phosphor icons with contextual meaning.
- [ ] **Framer Motion**: Subtle entrance and layout transitions applied.
- [ ] **Input label consistency**: Dropdown items and selected values show identical human-readable labels.
- [ ] **English microcopy**: Concise, professional copy with zero parenthetical annotations.
- [ ] **Build validation**: `npm run lint` and `npm run build` pass with `0 errors, 0 warnings`.
