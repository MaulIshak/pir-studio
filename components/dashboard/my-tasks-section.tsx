'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateTaskStatus, type MyTaskItem } from '@/actions/tasks'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Kanban,
  Flag,
  CalendarBlank,
  CheckCircle,
  ClockCountdown,
  ArrowRight,
  ListChecks,
} from '@phosphor-icons/react'

interface MyTasksSectionProps {
  initialTasks: MyTaskItem[]
}

type FilterStatus = 'all' | 'todo' | 'in_progress' | 'review' | 'done'

export function MyTasksSection({ initialTasks }: MyTasksSectionProps) {
  const [tasks, setTasks] = useState<MyTaskItem[]>(initialTasks)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleStatusChange = (task: MyTaskItem, newStatus: 'todo' | 'in_progress' | 'review' | 'done') => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    )

    startTransition(async () => {
      await updateTaskStatus(task.id, task.project_id, newStatus)
      router.refresh()
    })
  }

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'all') return true
    return t.status === filter
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'todo':
        return (
          <Badge variant="outline" className="border-slate-500/30 bg-slate-500/10 text-slate-400 text-[10px]">
            To Do
          </Badge>
        )
      case 'in_progress':
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px]">
            In Progress
          </Badge>
        )
      case 'review':
        return (
          <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px]">
            Review
          </Badge>
        )
      case 'done':
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
            Done
          </Badge>
        )
      default:
        return null
    }
  }

  const getDueDateLabel = (dueDateStr: string | null) => {
    if (!dueDateStr) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDateStr)
    due.setHours(0, 0, 0, 0)

    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-destructive font-medium">
          <ClockCountdown className="size-3" />
          Overdue ({Math.abs(diffDays)}d)
        </span>
      )
    } else if (diffDays === 0) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-destructive font-semibold">
          <ClockCountdown className="size-3" />
          Due Today
        </span>
      )
    } else if (diffDays <= 3) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
          <ClockCountdown className="size-3" />
          Due in {diffDays}d
        </span>
      )
    }

    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <CalendarBlank className="size-3" />
        {dueDateStr}
      </span>
    )
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Kanban className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">My Tasks</CardTitle>
            <p className="text-xs text-muted-foreground">
              Tasks assigned to you with quick status actions.
            </p>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {(['all', 'todo', 'in_progress', 'review', 'done'] as FilterStatus[]).map((st) => (
            <Button
              key={st}
              variant={filter === st ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setFilter(st)}
              className="text-xs h-7 px-2.5 capitalize"
            >
              {st === 'all' ? 'All' : st.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium text-foreground">No tasks found</p>
            <p className="text-[11px] text-muted-foreground">
              {filter === 'all'
                ? 'You have no assigned tasks in your active organization.'
                : `No tasks in ${filter.replace('_', ' ')} status.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredTasks.map((task) => {
              const completedSubtasks = task.subtasks?.filter((s) => s.status === 'done').length ?? 0
              const totalSubtasks = task.subtasks?.length ?? 0

              return (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2.5 transition-colors hover:bg-muted/20 px-2 rounded-lg"
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground break-words">
                        {task.title}
                      </span>
                      {getStatusBadge(task.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                      {task.projects && (
                        <Link
                          href={`/projects/${task.projects.slug}/tasks`}
                          className="inline-flex items-center text-[10px] font-medium text-primary hover:underline"
                        >
                          {task.projects.name}
                        </Link>
                      )}

                      {task.milestones && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Flag className="size-3 text-purple-400" />
                          {task.milestones.title}
                        </span>
                      )}

                      {totalSubtasks > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                          <ListChecks className="size-3 text-sky-400" />
                          {completedSubtasks}/{totalSubtasks}
                        </span>
                      )}

                      {getDueDateLabel(task.due_date)}
                    </div>
                  </div>

                  {/* Quick Actions Bar */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Select
                      value={task.status}
                      onValueChange={(val) => {
                        if (val) handleStatusChange(task, val as 'todo' | 'in_progress' | 'review' | 'done')
                      }}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>

                    {task.projects && (
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={<Link href={`/projects/${task.projects.slug}/tasks`} />}
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Go to project kanban"
                      >
                        <ArrowRight className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
