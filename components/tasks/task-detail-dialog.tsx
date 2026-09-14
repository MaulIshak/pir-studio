'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Flag,
  CalendarBlank,
  ClockCountdown,
  User,
  PencilSimple,
  Trash,
  CircleDashed,
  Play,
  Eye,
  CheckCircle,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import type { TaskItem } from './task-card'

interface TaskDetailDialogProps {
  task: TaskItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onStatusChange?: (taskId: string, status: 'todo' | 'in_progress' | 'review' | 'done') => void
}

const statusConfig = {
  todo: {
    label: 'To Do',
    icon: CircleDashed,
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
  in_progress: {
    label: 'In Progress',
    icon: Play,
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  review: {
    label: 'Review',
    icon: Eye,
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  done: {
    label: 'Done',
    icon: CheckCircle,
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
} as const

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskDetailDialogProps) {
  let isOverdue = false
  if (task.due_date && task.status !== 'done') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(task.due_date)
    dueDate.setHours(0, 0, 0, 0)
    if (dueDate < today) {
      isOverdue = true
    }
  }

  const currentStatus = statusConfig[task.status] || statusConfig.todo
  const StatusIcon = currentStatus.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="gap-2.5 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <Badge variant="outline" className={cn('gap-1.5 font-mono text-xs', currentStatus.badgeClass)}>
              <StatusIcon className="size-3" />
              {currentStatus.label}
            </Badge>

            {task.due_date && (
              <Badge
                variant={isOverdue ? 'destructive' : 'secondary'}
                className="gap-1.5 font-mono text-xs"
              >
                {isOverdue ? (
                  <ClockCountdown className="size-3" />
                ) : (
                  <CalendarBlank className="size-3" />
                )}
                {task.due_date} {isOverdue && '(Overdue)'}
              </Badge>
            )}
          </div>

          <DialogTitle className="text-base font-bold text-foreground leading-snug break-words">
            {task.title}
          </DialogTitle>
        </DialogHeader>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3 text-xs">
          {/* Assignee */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Assignee
            </span>
            <div className="flex items-center gap-2 font-medium text-foreground">
              {task.profiles?.avatar_url ? (
                <img
                  src={task.profiles.avatar_url}
                  alt={task.profiles.name || 'Member'}
                  className="size-5 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <User className="size-3" />
                </div>
              )}
              <span className="truncate">{task.profiles?.name || 'Unassigned'}</span>
            </div>
          </div>

          {/* Milestone */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Milestone
            </span>
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Flag className="size-3.5 text-primary" />
              <span className="truncate">{task.milestones?.title || 'None'}</span>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="flex flex-col gap-1.5 py-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Description
          </span>
          <div className="rounded-md border border-border/50 bg-background/50 p-3 min-h-[90px] text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {task.description ? (
              task.description
            ) : (
              <span className="italic text-muted-foreground">No description provided for this task.</span>
            )}
          </div>
        </div>

        {/* Quick Status Move buttons */}
        {onStatusChange && (
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Move Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(['todo', 'in_progress', 'review', 'done'] as const).map((st) => {
                const cfg = statusConfig[st]
                const isCurrent = task.status === st
                return (
                  <Button
                    key={st}
                    variant={isCurrent ? 'default' : 'outline'}
                    size="xs"
                    disabled={isCurrent}
                    onClick={() => {
                      onStatusChange(task.id, st)
                    }}
                    className="h-7 text-xs font-normal"
                  >
                    {cfg.label}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <DialogFooter className="flex-row items-center justify-between border-t pt-3 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
          >
            <Trash className="size-3.5" />
            Delete
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onEdit}
              className="gap-1.5"
            >
              <PencilSimple className="size-3.5" />
              Edit Task
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
