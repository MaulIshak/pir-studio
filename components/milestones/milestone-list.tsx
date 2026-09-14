'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { EmptyState } from '@/components/projects/empty-state'
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
} from '@phosphor-icons/react'

export interface MilestoneItem {
  id: string
  project_id: string
  title: string
  due_date: string | null
  status: 'not_started' | 'in_progress' | 'done'
  tasks?: Array<{ id: string; title?: string; status: string }>
}

interface MilestoneListProps {
  projectId: string
  initialMilestones: MilestoneItem[]
  projectStartDate?: string | null
  projectDeadline?: string | null
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'No due date'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
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
    return { label: 'Due today', className: 'text-amber-500 font-semibold' }
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays}d`, className: 'text-amber-500 font-medium' }
  }
  return { label: `Due in ${diffDays}d`, className: 'text-muted-foreground' }
}

export function MilestoneList({
  projectId,
  initialMilestones,
  projectStartDate,
  projectDeadline,
}: MilestoneListProps) {
  const [milestones, setMilestones] = useState<MilestoneItem[]>(initialMilestones)
  const [viewMode, setViewMode] = useState<'gantt' | 'timeline'>('gantt')

  const totalCount = milestones.length
  const completedCount = milestones.filter((m) => m.status === 'done').length

  // Sort chronologically
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const handleStatusChange = async (
    milestoneId: string,
    status: 'not_started' | 'in_progress' | 'done'
  ) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === milestoneId ? { ...m, status } : m))
    )
    await updateMilestone(milestoneId, projectId, { status })
  }

  const handleDelete = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return
    setMilestones((prev) => prev.filter((m) => m.id !== milestoneId))
    await deleteMilestone(milestoneId, projectId)
  }

  // --- Gantt Scale Calculations ---
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const nowTime = today.getTime()

  let minTime = projectStartDate ? new Date(projectStartDate).getTime() : nowTime - 7 * 86400000
  let maxTime = projectDeadline ? new Date(projectDeadline).getTime() : nowTime + 30 * 86400000

  // Expand bounds to cover all milestone due dates
  for (const m of milestones) {
    if (m.due_date) {
      const dTime = new Date(m.due_date).getTime()
      if (dTime < minTime) minTime = dTime - 5 * 86400000
      if (dTime > maxTime) maxTime = dTime + 7 * 86400000
    }
  }

  // Ensure at least 14 days range
  if (maxTime - minTime < 14 * 86400000) {
    maxTime = minTime + 14 * 86400000
  }

  const totalSpan = maxTime - minTime

  // Generate 5 ruler ticks
  const tickCount = 5
  const ticks = Array.from({ length: tickCount }).map((_, i) => {
    const t = minTime + (totalSpan * i) / (tickCount - 1)
    const dateObj = new Date(t)
    return {
      label: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      percent: (i / (tickCount - 1)) * 100,
    }
  })

  // Today marker position
  const todayPercent = ((nowTime - minTime) / totalSpan) * 100
  const isTodayVisible = todayPercent >= 0 && todayPercent <= 100

  return (
    <div className="flex flex-col gap-5">
      {/* Clean, Professional Header without gimmick widgets */}
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

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === 'gantt' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setViewMode('gantt')}
              className="gap-1.5 text-xs font-medium"
            >
              <ChartBarHorizontal className="size-3.5" />
              Gantt
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setViewMode('timeline')}
              className="gap-1.5 text-xs font-medium"
            >
              <Rows className="size-3.5" />
              Timeline
            </Button>
          </div>

          <CreateMilestoneDialog projectId={projectId} />
        </div>
      </div>

      {/* Main Content */}
      {milestones.length === 0 ? (
        <EmptyState
          title="No milestones defined"
          description="Define key milestones to schedule your game's development phases and track completion."
          icon={<Flag className="size-7" />}
          action={<CreateMilestoneDialog projectId={projectId} />}
        />
      ) : viewMode === 'gantt' ? (
        /* PROFESSIONAL GANTT ROADMAP CHART */
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-lg border bg-card shadow-xs overflow-hidden"
        >
          <div className="flex flex-col">
            {/* Gantt Header: Left Table Title + Right Timeline Ruler */}
            <div className="flex border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              <div className="w-72 shrink-0 border-r px-4 py-2.5 font-semibold text-foreground">
                Phase / Milestone
              </div>
              <div className="relative flex-1 px-4 py-2.5 overflow-hidden">
                <div className="relative h-4 w-full">
                  {ticks.map((tick, i) => (
                    <span
                      key={i}
                      className="absolute -translate-x-1/2 font-mono text-[11px] text-muted-foreground whitespace-nowrap"
                      style={{ left: `${tick.percent}%` }}
                    >
                      {tick.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Gantt Body: Rows */}
            <div className="divide-y divide-border/60">
              {sortedMilestones.map((milestone) => {
                const totalTasks = milestone.tasks?.length || 0
                const doneTasks = milestone.tasks?.filter((t) => t.status === 'done').length || 0
                const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
                const isDone = milestone.status === 'done'
                const isInProgress = milestone.status === 'in_progress'

                // Calculate Gantt bar bounds
                let barLeft = 5
                let barWidth = 25

                if (milestone.due_date) {
                  const dTime = new Date(milestone.due_date).getTime()
                  const startTime = dTime - 10 * 86400000 // 10-day span default
                  barLeft = Math.max(0, Math.min(85, ((startTime - minTime) / totalSpan) * 100))
                  const endPct = Math.max(barLeft + 15, Math.min(100, ((dTime - minTime) / totalSpan) * 100))
                  barWidth = Math.max(16, endPct - barLeft)
                }

                return (
                  <div
                    key={milestone.id}
                    className="group flex min-h-[58px] items-center hover:bg-muted/20 transition-colors"
                  >
                    {/* Left Milestone Details Column */}
                    <div className="flex w-72 shrink-0 items-center justify-between border-r px-4 py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`size-2.5 rounded-full shrink-0 ${
                            isDone
                              ? 'bg-emerald-500'
                              : isInProgress
                              ? 'bg-primary animate-pulse'
                              : 'bg-muted-foreground/40'
                          }`}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-xs font-semibold text-foreground">
                            {milestone.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {formatDate(milestone.due_date)}
                          </span>
                        </div>
                      </div>

                      {/* Dropdown status changer */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="xs"
                              className="size-6 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <DotsThreeVertical className="size-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'not_started')}>
                            <CircleDashed className="size-3.5 mr-2" />
                            Not Started
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'in_progress')}>
                            <Play className="size-3.5 mr-2 text-primary" />
                            In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'done')}>
                            <CheckCircle className="size-3.5 mr-2 text-emerald-500" />
                            Done
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(milestone.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash className="size-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Right Timeline Grid & Gantt Bar */}
                    <div className="relative flex-1 h-[58px] px-4 overflow-hidden flex items-center">
                      {/* Vertical Background Grid Lines */}
                      {ticks.map((tick, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-border/40"
                          style={{ left: `${tick.percent}%` }}
                        />
                      ))}

                      {/* Today Line Indicator */}
                      {isTodayVisible && (
                        <div
                          className="absolute top-0 bottom-0 w-px border-l border-dashed border-destructive/50 z-0"
                          style={{ left: `${todayPercent}%` }}
                        />
                      )}

                      {/* Gantt Bar */}
                      <motion.div
                        initial={{ opacity: 0, scaleX: 0.9 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ duration: 0.3 }}
                        style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                        className={`relative z-10 flex h-7 items-center justify-between rounded-md px-2.5 text-xs shadow-xs font-medium transition-all ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isInProgress
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted border border-border text-foreground'
                        }`}
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
                    className={`flex size-5 items-center justify-center rounded-full border-2 bg-card ${
                      isDone
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : isInProgress
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30 text-muted-foreground'
                    }`}
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
                <Card className="flex-1 transition-all duration-150 hover:border-foreground/20">
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
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <CalendarBlank className="size-3 text-muted-foreground" />
                          {formatDate(milestone.due_date)}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">
                          {doneTasks} of {totalTasks} tasks ({progress}%)
                        </span>
                      </div>
                    </div>

                    {/* Right side: Tasks link & Dropdown */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="xs"
                        nativeButton={false}
                        render={<Link href={`/projects/${projectId}/tasks`} />}
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'not_started')}>
                            <CircleDashed className="size-3.5 mr-2" />
                            Not Started
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'in_progress')}>
                            <Play className="size-3.5 mr-2 text-primary" />
                            In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(milestone.id, 'done')}>
                            <CheckCircle className="size-3.5 mr-2 text-emerald-500" />
                            Done
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(milestone.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash className="size-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
