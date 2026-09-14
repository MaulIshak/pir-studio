'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CircleDashed,
  Play,
  Eye,
  CheckCircle,
  Flag,
  CalendarBlank,
  ClockCountdown,
  User,
  PencilSimple,
  Trash,
  Package,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TaskDetailDialog } from './task-detail-dialog'
import { EditTaskDialog } from './edit-task-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from 'cn'
import type { TaskItem, ProfileItem } from './task-card'

interface TaskTableProps {
  tasks: TaskItem[]
  projectId: string
  milestones?: Array<{ id: string; title: string }>
  profiles?: ProfileItem[]
  onStatusChange: (taskId: string, status: 'todo' | 'in_progress' | 'review' | 'done') => void
  onUpdateTask?: (updatedTask: TaskItem) => void
  onDelete: (taskId: string) => void
}

const statusConfig = {
  todo: {
    label: 'To Do',
    icon: CircleDashed,
    class: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
  in_progress: {
    label: 'In Progress',
    icon: Play,
    class: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  review: {
    label: 'Review',
    icon: Eye,
    class: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  done: {
    label: 'Done',
    icon: CheckCircle,
    class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
} as const

export function TaskTable({
  tasks,
  projectId,
  milestones = [],
  profiles = [],
  onStatusChange,
  onUpdateTask,
  onDelete,
}: TaskTableProps) {
  const [selectedDetailTask, setSelectedDetailTask] = useState<TaskItem | null>(null)
  const [selectedEditTask, setSelectedEditTask] = useState<TaskItem | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null)

  // Keep detail and edit references updated with active tasks state
  const activeDetailTask = selectedDetailTask
    ? tasks.find((t) => t.id === selectedDetailTask.id) || selectedDetailTask
    : null
  const activeEditTask = selectedEditTask
    ? tasks.find((t) => t.id === selectedEditTask.id) || selectedEditTask
    : null

  return (
    <div className="flex flex-col gap-4">
      {tasks.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground">
          No tasks found matching your filters.
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-md border bg-card/60 overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Task</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead className="w-[140px]">Assignee</TableHead>
                <TableHead className="w-[130px]">Milestone</TableHead>
                <TableHead className="w-[125px]">Due Date</TableHead>
                <TableHead className="w-[110px]">Linked Assets</TableHead>
                <TableHead className="w-[90px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const currentStatus = statusConfig[task.status] || statusConfig.todo
                const StatusIcon = currentStatus.icon

                // Check overdue status
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

                const formattedDate = task.due_date
                  ? new Date(task.due_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null

                const assetCount = task.assets?.length || 0

                return (
                  <TableRow key={task.id} className="hover:bg-muted/40 transition-colors">
                    {/* Task Title */}
                    <TableCell className="font-medium max-w-[240px]">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailTask(task)}
                        className="group flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity cursor-pointer truncate max-w-full"
                        title={task.title}
                      >
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {task.title}
                        </span>
                        {isOverdue && (
                          <Badge
                            variant="destructive"
                            className="h-4 px-1 text-[10px] font-mono shrink-0"
                          >
                            Overdue
                          </Badge>
                        )}
                      </button>
                    </TableCell>

                    {/* Status Dropdown */}
                    <TableCell>
                      <Select
                        value={task.status}
                        onValueChange={(val) =>
                          val && onStatusChange(task.id, val as 'todo' | 'in_progress' | 'review' | 'done')
                        }
                      >
                        <SelectTrigger className={`h-7 w-[125px] text-xs gap-1.5 ${currentStatus.class}`}>
                          <StatusIcon className="size-3" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Assignee */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs">
                        {task.profiles?.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={task.profiles.avatar_url}
                            alt={task.profiles.name || 'Member'}
                            className="size-4 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex size-4 items-center justify-center rounded-full bg-secondary text-muted-foreground shrink-0">
                            <User className="size-2.5" />
                          </div>
                        )}
                        <span className="truncate max-w-[110px]" title={task.profiles?.name || 'Unassigned'}>
                          {task.profiles?.name || 'Unassigned'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Milestone */}
                    <TableCell>
                      {task.milestones ? (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 text-xs font-normal max-w-[120px] truncate"
                          title={task.milestones.title}
                        >
                          <Flag className="size-3 text-primary shrink-0" />
                          <span className="truncate">{task.milestones.title}</span>
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Due Date */}
                    <TableCell>
                      {formattedDate ? (
                        <div
                          className={cn(
                            'flex items-center gap-1 text-xs font-mono',
                            isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                          )}
                        >
                          {isOverdue ? (
                            <ClockCountdown className="size-3 shrink-0" />
                          ) : (
                            <CalendarBlank className="size-3 shrink-0" />
                          )}
                          <span>{formattedDate}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Linked Assets */}
                    <TableCell>
                      {assetCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 w-fit text-xs border-purple-500/30 bg-purple-500/10 text-purple-400"
                        >
                          <Package className="size-3 shrink-0" />
                          {assetCount} {assetCount === 1 ? 'Asset' : 'Assets'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelectedDetailTask(task)}
                          className="text-muted-foreground hover:text-foreground"
                          title="View Details"
                        >
                          <Eye className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelectedEditTask(task)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Edit Task"
                        >
                          <PencilSimple className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setTaskToDelete(task)}
                          className="text-destructive hover:text-destructive"
                          title="Delete Task"
                        >
                          <Trash className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {/* Task Details Dialog */}
      {activeDetailTask && (
        <TaskDetailDialog
          task={activeDetailTask}
          projectId={projectId}
          open={!!selectedDetailTask}
          onOpenChange={(open) => !open && setSelectedDetailTask(null)}
          onEdit={() => {
            const current = activeDetailTask
            setSelectedDetailTask(null)
            setSelectedEditTask(current)
          }}
          onDelete={() => {
            const current = activeDetailTask
            setSelectedDetailTask(null)
            setTaskToDelete(current)
          }}
          onStatusChange={(taskId, newStatus) => onStatusChange(taskId, newStatus)}
        />
      )}

      {/* Edit Task Dialog */}
      {activeEditTask && (
        <EditTaskDialog
          task={activeEditTask}
          projectId={projectId}
          milestones={milestones}
          profiles={profiles}
          open={!!selectedEditTask}
          onOpenChange={(open) => !open && setSelectedEditTask(null)}
          onSuccess={(updatedTask) => {
            onUpdateTask?.(updatedTask)
            setSelectedEditTask(null)
          }}
        />
      )}

      {/* Confirm Delete Task Dialog */}
      <ConfirmDialog
        open={!!taskToDelete}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        title="Delete Task"
        description={`Are you sure you want to delete "${taskToDelete?.title}"? This will unassign any linked assets.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        icon="trash"
        onConfirm={() => {
          if (taskToDelete) {
            onDelete(taskToDelete.id)
            setTaskToDelete(null)
          }
        }}
      />
    </div>
  )
}
