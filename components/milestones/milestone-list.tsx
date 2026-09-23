'use client'

import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { updateMilestone, deleteMilestone } from '@/actions/milestones'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { CreateMilestoneDialog } from './create-milestone-dialog'
import { EditMilestoneDialog } from './edit-milestone-dialog'
import { EmptyState } from '@/components/projects/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DotsThreeVertical,
  Trash,
  CalendarBlank,
  Flag,
  CheckCircle,
  Play,
  CircleDashed,
  ChartBarHorizontal,
  Rows,
  Kanban,
  PencilSimple,
  Crosshair,
} from '@phosphor-icons/react'

export interface MilestoneItem {
  id: string
  project_id: string
  title: string
  start_date?: string | null
  due_date: string | null
  status: 'not_started' | 'in_progress' | 'done'
  tasks?: Array<{ id: string; title?: string; status: string }>
}

interface MilestoneListProps {
  projectId: string
  projectSlug?: string
  initialMilestones: MilestoneItem[]
  projectStartDate?: string | null
  projectDeadline?: string | null
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'No date'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatDateRange(startDate?: string | null, dueDate?: string | null) {
  if (!startDate && !dueDate) return 'No schedule'
  if (startDate && dueDate) {
    const s = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const d = new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${s} – ${d}`
  }
  if (dueDate) return `Due ${formatDate(dueDate)}`
  return `Starts ${formatDate(startDate)}`
}

function getDueInfo(dueDate: string | null, status: MilestoneItem['status']) {
  if (status === 'done') {
    return { label: 'Completed', className: 'text-emerald-500 font-medium' }
  }
  if (!dueDate) {
    return { label: 'No date', className: 'text-muted-foreground' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dueDate)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, className: 'text-destructive font-semibold' }
  }
  if (diffDays === 0) {
    return { label: 'Due today', className: 'text-destructive font-semibold animate-pulse' }
  }
  if (diffDays === 1) {
    return { label: 'Due tomorrow', className: 'text-amber-500 font-semibold' }
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays}d`, className: 'text-amber-500 font-medium' }
  }
  return { label: `Due in ${diffDays}d`, className: 'text-muted-foreground' }
}

function formatToLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function subscribeToViewport(onChange: () => void) {
  const mql = window.matchMedia('(max-width: 767px)')
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

const DAY_WIDTH = 48 // Width of each single day column in pixels
const DAY_MS = 86400000

export function MilestoneList({
  projectId,
  projectSlug,
  initialMilestones,
  projectStartDate,
  projectDeadline,
}: MilestoneListProps) {
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [milestones, setMilestones] = useState<MilestoneItem[]>(initialMilestones)
  const [viewOverride, setViewOverride] = useState<'gantt' | 'timeline' | null>(null)
  const [milestoneToEdit, setMilestoneToEdit] = useState<MilestoneItem | null>(null)
  const [milestoneToDelete, setMilestoneToDelete] = useState<MilestoneItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isHoveringDeadline, setIsHoveringDeadline] = useState(false)

  // Small screens default to timeline without a hydration mismatch. A manual
  // toggle always wins via viewOverride.
  const isSmallScreen = useSyncExternalStore(
    subscribeToViewport,
    () => window.innerWidth < 768,
    () => false
  )
  const viewMode = viewOverride ?? (isSmallScreen ? 'timeline' : 'gantt')

  // Keep local state in sync whenever server component re-fetches initialMilestones
  const [prevInitialMilestones, setPrevInitialMilestones] = useState(initialMilestones)
  if (prevInitialMilestones !== initialMilestones) {
    setPrevInitialMilestones(initialMilestones)
    setMilestones(initialMilestones)
  }

  const handleMilestoneCreated = (newMilestone?: MilestoneItem) => {
    if (newMilestone) {
      setMilestones((prev) => {
        if (prev.some((m) => m.id === newMilestone.id)) return prev
        return [...prev, { ...newMilestone, tasks: newMilestone.tasks ?? [] }]
      })
    }
    router.refresh()
  }

  const handleMilestoneUpdated = (updatedMilestone?: MilestoneItem) => {
    if (updatedMilestone) {
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === updatedMilestone.id
            ? { ...m, ...updatedMilestone, tasks: m.tasks ?? [] }
            : m
        )
      )
    }
    router.refresh()
  }

  const totalCount = milestones.length
  const completedCount = milestones.filter((m) => m.status === 'done').length

  // Sort chronologically by start_date, then due_date
  const sortedMilestones = [...milestones].sort((a, b) => {
    const aDate = a.start_date || a.due_date
    const bDate = b.start_date || b.due_date
    if (!aDate) return 1
    if (!bDate) return -1
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })

  const handleStatusChange = async (
    milestoneId: string,
    status: 'not_started' | 'in_progress' | 'done'
  ) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === milestoneId ? { ...m, status } : m))
    )
    await updateMilestone(milestoneId, projectId, { status })
    router.refresh()
  }

  const handleConfirmDelete = async () => {
    if (!milestoneToDelete) return
    setIsDeleting(true)
    const idToDelete = milestoneToDelete.id
    try {
      setMilestones((prev) => prev.filter((m) => m.id !== idToDelete))
      setMilestoneToDelete(null)
      await deleteMilestone(idToDelete, projectId)
      router.refresh()
    } finally {
      setIsDeleting(false)
    }
  }

  // --- Day-by-Day Timeline Calculations ---
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()
  const todayStr = formatToLocalDateStr(today)

  const deadlineDate = projectDeadline ? new Date(projectDeadline) : null
  if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0)
  const deadlineTime = deadlineDate ? deadlineDate.getTime() : null
  const deadlineStr = projectDeadline
    ? projectDeadline.includes('T')
      ? formatToLocalDateStr(new Date(projectDeadline))
      : projectDeadline
    : null

  let minTime = projectStartDate ? new Date(projectStartDate).getTime() : todayTime - 7 * DAY_MS
  let maxTime = deadlineTime ? deadlineTime : todayTime + 30 * DAY_MS

  // Expand bounds to cover all milestone dates
  for (const m of milestones) {
    if (m.start_date) {
      const sTime = new Date(m.start_date).getTime()
      if (sTime < minTime) minTime = sTime
      if (sTime > maxTime) maxTime = sTime
    }
    if (m.due_date) {
      const dTime = new Date(m.due_date).getTime()
      if (dTime < minTime) minTime = dTime
      if (dTime > maxTime) maxTime = dTime
    }
  }

  // Add 3 days buffer on the left, 7 days buffer on the right
  const minDate = new Date(minTime - 3 * DAY_MS)
  minDate.setHours(0, 0, 0, 0)

  const maxDate = new Date(maxTime + 7 * DAY_MS)
  maxDate.setHours(0, 0, 0, 0)

  // Ensure at least 21 days
  if (maxDate.getTime() - minDate.getTime() < 21 * DAY_MS) {
    maxDate.setTime(minDate.getTime() + 21 * DAY_MS)
  }

  const totalDays = Math.max(21, Math.round((maxDate.getTime() - minDate.getTime()) / DAY_MS))

  // Generate continuous single calendar days (no skips, no intervals)
  const calendarDays: Array<{
    date: Date
    dateStr: string
    dayNum: number
    dayName: string
    isWeekend: boolean
    isToday: boolean
    isDeadline: boolean
    monthYear: string
  }> = []

  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  for (let i = 0; i < totalDays; i++) {
    const cur = new Date(minDate.getTime() + i * DAY_MS)
    const curStr = formatToLocalDateStr(cur)
    calendarDays.push({
      date: cur,
      dateStr: curStr,
      dayNum: cur.getDate(),
      dayName: dayNames[cur.getDay()],
      isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
      isToday: curStr === todayStr,
      isDeadline: curStr === deadlineStr,
      monthYear: cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    })
  }

  // Month grouping for ruler Tier 1
  const monthGroups: Array<{ label: string; daysCount: number; width: number }> = []
  calendarDays.forEach((d) => {
    const last = monthGroups[monthGroups.length - 1]
    if (last && last.label === d.monthYear) {
      last.daysCount += 1
      last.width += DAY_WIDTH
    } else {
      monthGroups.push({
        label: d.monthYear,
        daysCount: 1,
        width: DAY_WIDTH,
      })
    }
  })

  // Indices
  const todayIndex = calendarDays.findIndex((d) => d.isToday)
  const deadlineIndex = calendarDays.findIndex((d) => d.isDeadline)
  const totalTimelineWidth = calendarDays.length * DAY_WIDTH

  // Helper: check if milestone is active today
  const isMilestoneActiveToday = (m: MilestoneItem) => {
    if (m.status === 'done') return false
    if (m.start_date && m.due_date) {
      return todayStr >= m.start_date && todayStr <= m.due_date
    }
    if (m.start_date && !m.due_date) {
      return todayStr >= m.start_date
    }
    if (!m.start_date && m.due_date) {
      return todayStr <= m.due_date && m.status === 'in_progress'
    }
    return m.status === 'in_progress'
  }

  // Scroll to Today on initial load
  useEffect(() => {
    if (scrollContainerRef.current && todayIndex >= 0) {
      scrollContainerRef.current.scrollLeft = Math.max(0, todayIndex * DAY_WIDTH - 150)
    }
  }, [todayIndex])

  const scrollToToday = () => {
    if (scrollContainerRef.current && todayIndex >= 0) {
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, todayIndex * DAY_WIDTH - 150),
        behavior: 'smooth',
      })
    }
  }

  const scrollToDeadline = () => {
    if (scrollContainerRef.current && deadlineIndex >= 0) {
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, (deadlineIndex + 1) * DAY_WIDTH - 200),
        behavior: 'smooth',
      })
      setIsHoveringDeadline(true)
      setTimeout(() => setIsHoveringDeadline(false), 2500)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Clean, Professional Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading text-xl font-bold tracking-tight">Milestones</h2>
            {totalCount > 0 && (
              <Badge variant="secondary" className="font-mono text-xs">
                {completedCount} of {totalCount} completed
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Plan, schedule, and track major deliverables across project phases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === 'gantt' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setViewOverride('gantt')}
              className="gap-1.5 text-xs font-medium"
            >
              <ChartBarHorizontal className="size-3.5" />
              Gantt
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setViewOverride('timeline')}
              className="gap-1.5 text-xs font-medium"
            >
              <Rows className="size-3.5" />
              Timeline
            </Button>
          </div>

          <CreateMilestoneDialog projectId={projectId} onSuccess={handleMilestoneCreated} />
        </div>
      </div>

      {/* Main Content */}
      {milestones.length === 0 ? (
        <EmptyState
          title="No milestones defined"
          description="Define key milestones to schedule your game's development phases and track completion."
          icon={<Flag className="size-7" />}
          action={<CreateMilestoneDialog projectId={projectId} onSuccess={handleMilestoneCreated} />}
        />
      ) : viewMode === 'gantt' ? (
        /* HORIZONTALLY SCROLLABLE DAY-BY-DAY GANTT ROADMAP */
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full min-w-0 rounded-lg border bg-card shadow-xs overflow-hidden"
        >
          {/* Quick Toolbar (Jump Controls & Timeline Info) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 sm:px-4 py-2 bg-muted/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-[11px] text-foreground">
                {calendarDays.length} days
              </span>
              <span>•</span>
              <span className="text-[11px] truncate max-w-[160px] sm:max-w-none">
                {calendarDays[0]?.dateStr} – {calendarDays[calendarDays.length - 1]?.dateStr}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {todayIndex >= 0 && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={scrollToToday}
                  className="h-6 text-[10px] sm:text-[11px] px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Crosshair className="size-3" />
                  Today
                </Button>
              )}
              {deadlineIndex >= 0 && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={scrollToDeadline}
                  className="h-6 text-[10px] sm:text-[11px] px-2 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Flag className="size-3" />
                  Deadline
                </Button>
              )}
            </div>
          </div>

          {/* Horizontally Scrollable Container with Pinned Left Column */}
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto relative select-none scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex flex-col min-w-max">
              {/* Header: Left Pinned Title + Right Days Ruler */}
              <div className="flex border-b bg-muted/60 sticky top-0 z-10">
                {/* Pinned Left Header Column: Phase / Milestone */}
                <div className="w-36 sm:w-56 md:w-64 shrink-0 border-r px-2.5 sm:px-4 py-3 font-semibold text-xs text-foreground bg-muted sticky left-0 z-[11] flex items-center justify-between shadow-[2px_0_8px_-2px_rgba(0,0,0,0.1)]">
                  <span className="truncate">Phase</span>
                  <span className="text-[10px] font-mono font-normal text-muted-foreground hidden sm:inline">
                    {milestones.length} phases
                  </span>
                </div>

                {/* Right Timeline Ruler (2 Tiers: Month Groups + Every Single Day) */}
                <div className="flex flex-col relative" style={{ width: `${totalTimelineWidth}px` }}>
                  {/* Tier 1: Months */}
                  <div className="flex border-b border-border/60">
                    {monthGroups.map((mg, idx) => (
                      <div
                        key={idx}
                        style={{ width: `${mg.width}px` }}
                        className="border-r border-border/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground bg-muted/40 truncate"
                      >
                        {mg.label}
                      </div>
                    ))}
                  </div>

                  {/* Tier 2: Every Single Day (Continuous vertical lines for ALL dates) */}
                  <div className="flex relative">
                    {calendarDays.map((day) => (
                      <div
                        key={day.dateStr}
                        style={{ width: `${DAY_WIDTH}px` }}
                        className={`flex flex-col items-center justify-center py-1.5 border-r border-border/40 shrink-0 text-center transition-colors ${
                          day.isToday
                            ? 'bg-primary/10 font-bold text-primary'
                            : day.isWeekend
                            ? 'bg-muted/30 text-muted-foreground/70'
                            : 'text-muted-foreground'
                        }`}
                        title={
                          day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                        }
                      >
                        <span className="text-[10px] uppercase font-mono tracking-tighter leading-none">
                          {day.dayName}
                        </span>
                        <span
                          className={`mt-0.5 text-xs font-mono leading-none ${
                            day.isToday
                              ? 'flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]'
                              : ''
                          }`}
                        >
                          {day.dayNum}
                        </span>
                      </div>
                    ))}

                    {/* Project Deadline Marker in Header on the dividing line between deadline day and next day */}
                    {deadlineIndex >= 0 && (
                      <>
                        {/* Floating tooltip badge */}
                        <div
                          onMouseEnter={() => setIsHoveringDeadline(true)}
                          onMouseLeave={() => setIsHoveringDeadline(false)}
                          className={`absolute -top-3.5 -translate-x-1/2 flex flex-col items-center z-50 pointer-events-auto cursor-help transition-all duration-150 ${
                            isHoveringDeadline
                              ? 'opacity-100 translate-y-0 scale-100'
                              : 'opacity-0 translate-y-1 scale-95 pointer-events-none'
                          }`}
                          style={{ left: `${(deadlineIndex + 1) * DAY_WIDTH}px` }}
                        >
                          <span className="flex items-center gap-1 rounded-md bg-destructive px-2 py-0.5 font-mono text-[10px] font-bold text-destructive-foreground shadow-md whitespace-nowrap">
                            <Flag className="size-3 shrink-0" weight="fill" />
                            Project Deadline ({formatDate(projectDeadline)})
                          </span>
                          <span className="size-1.5 rotate-45 bg-destructive -mt-0.5" />
                        </div>

                        {/* Pin marker sitting right on the border line between days */}
                        <div
                          onMouseEnter={() => setIsHoveringDeadline(true)}
                          onMouseLeave={() => setIsHoveringDeadline(false)}
                          className="absolute top-1 bottom-0 -translate-x-1/2 z-20 flex flex-col items-center cursor-help pointer-events-auto"
                          style={{ left: `${(deadlineIndex + 1) * DAY_WIDTH}px` }}
                          title={`Project Deadline: ${formatDate(projectDeadline)}`}
                        >
                          <div
                            className={`flex size-4.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-all ${
                              isHoveringDeadline ? 'ring-2 ring-destructive ring-offset-2 scale-110 shadow-md' : ''
                            }`}
                          >
                            <Flag className="size-2.5 shrink-0" weight="fill" />
                          </div>
                          {/* Dashed line continuing down through header */}
                          <div
                            className={`flex-1 w-0.5 border-l-2 border-dashed border-destructive transition-all ${
                              isHoveringDeadline ? 'opacity-100 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'opacity-80'
                            }`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Body: Milestone Rows */}
              <div className="divide-y divide-border/60 relative">
                {sortedMilestones.map((milestone) => {
                  const totalTasks = milestone.tasks?.length || 0
                  const doneTasks = milestone.tasks?.filter((t) => t.status === 'done').length || 0
                  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
                  const isDone = milestone.status === 'done'
                  const isInProgress = milestone.status === 'in_progress'
                  const isActiveToday = isMilestoneActiveToday(milestone)

                  // Compute start & end index on the day grid
                  const getDayIndex = (dateStr?: string | null) => {
                    if (!dateStr) return -1
                    const clean = dateStr.includes('T') ? formatToLocalDateStr(new Date(dateStr)) : dateStr
                    return calendarDays.findIndex((d) => d.dateStr === clean)
                  }

                  let startDayIndex = getDayIndex(milestone.start_date)
                  let endDayIndex = getDayIndex(milestone.due_date)

                  if (startDayIndex === -1 && endDayIndex === -1) {
                    startDayIndex = 0
                    endDayIndex = Math.min(6, calendarDays.length - 1)
                  } else if (startDayIndex === -1 && endDayIndex !== -1) {
                    startDayIndex = Math.max(0, endDayIndex - 7)
                  } else if (startDayIndex !== -1 && endDayIndex === -1) {
                    endDayIndex = Math.min(calendarDays.length - 1, startDayIndex + 7)
                  }

                  if (startDayIndex > endDayIndex) {
                    endDayIndex = startDayIndex
                  }

                  const barLeft = startDayIndex * DAY_WIDTH + 2
                  const barWidth = Math.max(DAY_WIDTH - 4, (endDayIndex - startDayIndex + 1) * DAY_WIDTH - 4)

                  return (
                    <div
                      key={milestone.id}
                      className={`group flex min-h-[56px] items-center transition-colors relative ${
                        isActiveToday ? 'bg-primary/[0.03] hover:bg-primary/[0.06]' : 'hover:bg-muted/15'
                      }`}
                    >
                      {/* Pinned Left Details Column */}
                      <div className="w-36 sm:w-56 md:w-64 shrink-0 border-r px-2.5 sm:px-4 py-2 bg-card sticky left-0 z-[9] flex items-center justify-between shadow-[4px_0_12px_-2px_rgba(0,0,0,0.12)]">
                        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
                          <span
                            className={`size-2 sm:size-2.5 rounded-full shrink-0 ${
                              isDone
                                ? 'bg-emerald-500'
                                : isInProgress
                                ? 'bg-primary animate-pulse'
                                : 'bg-muted-foreground/40'
                            }`}
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="truncate text-xs font-semibold text-foreground">
                                {milestone.title}
                              </span>
                              {isActiveToday && (
                                <Badge
                                  variant="outline"
                                  className="border-primary/40 bg-primary/10 text-primary text-[9px] h-3.5 px-1 font-medium shrink-0 animate-pulse hidden sm:inline-flex"
                                >
                                  Active
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-muted-foreground font-mono truncate">
                              {formatDateRange(milestone.start_date, milestone.due_date)}
                            </span>
                          </div>
                        </div>

                        {/* Actions 3-dot dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="xs"
                                className="size-6 p-0 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                              >
                                <DotsThreeVertical className="size-3.5" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setMilestoneToEdit(milestone)}>
                              <PencilSimple className="size-3.5 mr-2" />
                              Edit Milestone
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'not_started')}>
                              <CircleDashed className="size-3.5 mr-2" />
                              Mark Not Started
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'in_progress')}>
                              <Play className="size-3.5 mr-2 text-primary" />
                              Mark In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'done')}>
                              <CheckCircle className="size-3.5 mr-2 text-emerald-500" />
                              Mark Done
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setMilestoneToDelete(milestone)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash className="size-3.5 mr-2" />
                              Delete Milestone
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Right Timeline Grid Area */}
                      <div
                        className="relative h-[56px] flex items-center shrink-0 z-0"
                        style={{ width: `${totalTimelineWidth}px` }}
                      >
                        {/* Vertical Grid Lines for EVERY Single Day */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {calendarDays.map((day) => (
                            <div
                              key={day.dateStr}
                              style={{ width: `${DAY_WIDTH}px` }}
                              className={`h-full border-r border-border/40 shrink-0 ${
                                day.isWeekend ? 'bg-muted/15' : ''
                              }`}
                            />
                          ))}
                        </div>

                        {/* Today Marker Line (Vertical) */}
                        {todayIndex >= 0 && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-primary/70 z-1 pointer-events-none"
                            style={{ left: `${todayIndex * DAY_WIDTH + DAY_WIDTH / 2}px` }}
                          />
                        )}

                        {/* Project Deadline Marker Line (Vertical Across Rows) */}
                        {deadlineIndex >= 0 && (
                          <div
                            onMouseEnter={() => setIsHoveringDeadline(true)}
                            onMouseLeave={() => setIsHoveringDeadline(false)}
                            className="absolute top-0 bottom-0 -translate-x-1/2 z-2 cursor-help flex justify-center w-4"
                            style={{ left: `${(deadlineIndex + 1) * DAY_WIDTH}px` }}
                          >
                            <div
                              className={`h-full w-0.5 border-l-2 border-dashed border-destructive transition-all ${
                                isHoveringDeadline
                                  ? 'shadow-[0_0_14px_rgba(239,68,68,0.9)] opacity-100'
                                  : 'shadow-[0_0_8px_rgba(239,68,68,0.5)] opacity-80'
                              }`}
                            />
                          </div>
                        )}

                        {/* Gantt Bar */}
                        <motion.div
                          initial={{ opacity: 0, scaleX: 0.95 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          transition={{ duration: 0.2 }}
                          style={{ left: `${barLeft}px`, width: `${barWidth}px` }}
                          className={`absolute z-10 flex h-7 items-center justify-between rounded-md px-2.5 text-xs shadow-xs font-medium transition-all ${
                            isDone
                              ? 'bg-emerald-600 text-white'
                              : isInProgress
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted border border-border text-foreground'
                          } ${
                            isActiveToday
                              ? 'ring-2 ring-primary ring-offset-1 ring-offset-background shadow-md'
                              : ''
                          }`}
                          title={`${milestone.title}: ${formatDateRange(milestone.start_date, milestone.due_date)} (${endDayIndex - startDayIndex + 1} days)`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isDone ? (
                              <CheckCircle className="size-3.5 shrink-0 text-white" />
                            ) : isInProgress ? (
                              <Play className="size-3 shrink-0" />
                            ) : (
                              <CircleDashed className="size-3 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate">{milestone.title}</span>
                          </div>

                          <span className="font-mono text-[10px] opacity-90 shrink-0 ml-1.5">
                            {progress}%
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        /* CLEAN HIGH-DENSITY TIMELINE LIST (LINEAR STYLE) */
        <div className="relative flex flex-col gap-3 pl-2 sm:pl-4">
          {/* Vertical Connecting Guide Line */}
          <div className="absolute bottom-4 left-[5.4rem] top-3 w-px bg-border sm:left-[6.9rem]" />

          {sortedMilestones.map((milestone) => {
            const totalTasks = milestone.tasks?.length || 0
            const doneTasks = milestone.tasks?.filter((t) => t.status === 'done').length || 0
            const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
            const isDone = milestone.status === 'done'
            const isInProgress = milestone.status === 'in_progress'
            const isActiveToday = isMilestoneActiveToday(milestone)
            const dueInfo = getDueInfo(milestone.due_date, milestone.status)

            return (
              <motion.div
                key={milestone.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="relative flex items-center gap-4 sm:gap-6"
              >
                {/* Date on the Left */}
                <div className="w-16 sm:w-20 shrink-0 text-right font-mono text-xs">
                  <div className="font-semibold text-foreground">
                    {milestone.due_date ? milestone.due_date.slice(5) : '—'}
                  </div>
                  <div className={`text-[10px] ${dueInfo.className}`}>{dueInfo.label}</div>
                </div>

                {/* Timeline Center Node */}
                <div className="relative z-10 shrink-0">
                  <div
                    className={`flex size-5 items-center justify-center rounded-full border-2 bg-card transition-all ${
                      isDone
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : isInProgress
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30 text-muted-foreground'
                    } ${isActiveToday ? 'ring-4 ring-primary/25' : ''}`}
                  >
                    {isDone ? (
                      <CheckCircle className="size-3" />
                    ) : isInProgress ? (
                      <Play className="size-2.5 translate-x-0.5" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                </div>

                {/* Milestone Row Card */}
                <Card
                  className={`flex-1 transition-all duration-150 hover:border-foreground/20 ${
                    isActiveToday ? 'border-primary/50 bg-primary/[0.02] shadow-xs' : ''
                  }`}
                >
                  <div className="flex flex-col justify-between gap-2 p-3 sm:flex-row sm:items-center">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-sm font-semibold text-foreground">
                          {milestone.title}
                        </span>
                        <Badge
                          variant={isDone ? 'default' : isInProgress ? 'secondary' : 'outline'}
                          className="capitalize text-[10px] h-4 px-1.5"
                        >
                          {milestone.status.replace('_', ' ')}
                        </Badge>
                        {isActiveToday && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 bg-primary/10 text-primary text-[10px] h-4 px-1.5 font-medium animate-pulse"
                          >
                            Active Today
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <CalendarBlank className="size-3 text-muted-foreground" />
                          {formatDateRange(milestone.start_date, milestone.due_date)}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">
                          {doneTasks} of {totalTasks} tasks ({progress}%)
                        </span>
                      </div>
                    </div>

                    {/* Right side: Tasks link & Dropdown */}
                    <div className="flex items-center gap-2 self-start sm:self-auto pt-1 sm:pt-0">
                      <Button
                        variant="ghost"
                        size="xs"
                        nativeButton={false}
                        render={<Link href={`/projects/${projectSlug || projectId}/tasks`} />}
                        className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Kanban className="size-3" />
                        Tasks
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="xs" className="size-7 p-0 text-muted-foreground">
                              <DotsThreeVertical className="size-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setMilestoneToEdit(milestone)}>
                            <PencilSimple className="size-3.5 mr-2" />
                            Edit Milestone
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'not_started')}>
                            <CircleDashed className="size-3.5 mr-2" />
                            Mark Not Started
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'in_progress')}>
                            <Play className="size-3.5 mr-2 text-primary" />
                            Mark In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'done')}>
                            <CheckCircle className="size-3.5 mr-2 text-emerald-500" />
                            Mark Done
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setMilestoneToDelete(milestone)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash className="size-3.5 mr-2" />
                            Delete Milestone
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}

          {/* Project Deadline Landmark in Timeline */}
          {projectDeadline && (
            <div className="relative flex items-center gap-4 sm:gap-6 pt-2">
              <div className="w-16 sm:w-20 shrink-0 text-right font-mono text-xs">
                <div className="font-semibold text-destructive">{projectDeadline.slice(5)}</div>
                <div className="text-[10px] text-destructive font-semibold">Deadline</div>
              </div>
              <div className="relative z-10 shrink-0">
                <div className="flex size-5 items-center justify-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
                  <Flag className="size-2.5" />
                </div>
              </div>
              <div className="flex-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-destructive">Project Deadline</span>
                  <span className="font-mono text-muted-foreground">• {formatDate(projectDeadline)}</span>
                </div>
                <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">
                  Final Target Due
                </Badge>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Milestone Dialog */}
      <EditMilestoneDialog
        open={!!milestoneToEdit}
        onOpenChange={(open) => !open && setMilestoneToEdit(null)}
        milestone={milestoneToEdit}
        projectId={projectId}
        onSuccess={handleMilestoneUpdated}
      />

      {/* Reusable Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!milestoneToDelete}
        onOpenChange={(open) => !open && setMilestoneToDelete(null)}
        title="Delete Milestone"
        description={`Are you sure you want to delete "${milestoneToDelete?.title}"? Any linked tasks will not be deleted, but will no longer be attached to this milestone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        icon="trash"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
