'use client'

import React, { useState } from 'react'
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
  CaretRight,
  ListChecks,
  Plus,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
import { createSubtask, deleteSubtask } from '@/actions/tasks'
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
  onToggleSubtask?: (subtaskId: string, currentStatus: 'todo' | 'done', taskId: string) => void
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
  onToggleSubtask,
}: TaskTableProps) {
  const [selectedDetailTask, setSelectedDetailTask] = useState<TaskItem | null>(null)
  const [selectedEditTask, setSelectedEditTask] = useState<TaskItem | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({})
  const [isAddingSubtask, setIsAddingSubtask] = useState<Record<string, boolean>>({})

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const handleInlineAddSubtask = async (taskId: string) => {
    const title = (subtaskInputs[taskId] || '').trim()
    if (!title || isAddingSubtask[taskId]) return

    setIsAddingSubtask((prev) => ({ ...prev, [taskId]: true }))
    try {
      const res = await createSubtask(taskId, title, projectId)
      if (res.success && res.subtask) {
        setSubtaskInputs((prev) => ({ ...prev, [taskId]: '' }))
        const task = tasks.find((t) => t.id === taskId)
        if (task) {
          const updatedSubtasks = [...(task.subtasks || []), res.subtask]
          onUpdateTask?.({
            ...task,
            subtasks: updatedSubtasks,
          })
        }
      }
    } finally {
      setIsAddingSubtask((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  const handleInlineDeleteSubtask = async (subtaskId: string, taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      const updatedSubtasks = (task.subtasks || []).filter((st) => st.id !== subtaskId)
      onUpdateTask?.({
        ...task,
        subtasks: updatedSubtasks,
      })
    }
    await deleteSubtask(subtaskId, projectId)
  }

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
        <>
          {/* Mobile View: Card List (< md) */}
          <div className="flex md:hidden flex-col gap-3">
        {tasks.map((task) => {
          const currentStatus = statusConfig[task.status] || statusConfig.todo
          const StatusIcon = currentStatus.icon
          const isExpanded = expandedTaskIds.has(task.id)

          const subtasks = task.subtasks || []
          const totalSubtasks = subtasks.length
          const completedSubtasks = subtasks.filter((s) => s.status === 'done').length

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
              })
            : null

          const assetCount = task.assets?.length || 0

          return (
            <div
              key={task.id}
              className="flex flex-col gap-2.5 rounded-lg border bg-card p-3.5 shadow-2xs"
            >
              {/* Header: Title & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedDetailTask(task)}
                    className="text-left font-medium text-foreground hover:text-primary transition-colors text-xs line-clamp-2 cursor-pointer"
                  >
                    {task.title}
                  </button>
                  {isOverdue && (
                    <Badge variant="destructive" className="h-4 px-1 text-[10px] font-mono mt-1">
                      Overdue
                    </Badge>
                  )}
                </div>

                <Select
                  value={task.status}
                  onValueChange={(val) =>
                    val && onStatusChange(task.id, val as 'todo' | 'in_progress' | 'review' | 'done')
                  }
                >
                  <SelectTrigger className={`h-6 text-[11px] px-2 py-0 gap-1 shrink-0 ${currentStatus.class}`}>
                    <StatusIcon className="size-2.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Badges & Meta */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                {/* Assignee */}
                <div className="flex items-center gap-1">
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
                  <span className="text-[11px] truncate max-w-[100px]">{task.profiles?.name || 'Unassigned'}</span>
                </div>

                {/* Milestone */}
                {task.milestones && (
                  <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 gap-1 truncate max-w-[110px]">
                    <Flag className="size-2.5 text-primary shrink-0" />
                    <span className="truncate">{task.milestones.title}</span>
                  </Badge>
                )}

                {/* Due date */}
                {formattedDate && (
                  <span className={cn("text-[11px] font-mono flex items-center gap-1", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                    <CalendarBlank className="size-3" />
                    {formattedDate}
                  </span>
                )}

                {/* Assets */}
                {assetCount > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 gap-1 border-purple-500/30 bg-purple-500/10 text-purple-400">
                    <Package className="size-2.5" />
                    {assetCount}
                  </Badge>
                )}
              </div>

              {/* Subtasks summary & trigger */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => toggleExpand(task.id)}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[11px] cursor-pointer"
                >
                  <CaretRight className={cn("size-3 transition-transform", isExpanded && "rotate-90 text-primary")} />
                  <span>Subtasks {totalSubtasks > 0 ? `(${completedSubtasks}/${totalSubtasks})` : ''}</span>
                </button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setSelectedDetailTask(task)}
                    className="size-6 p-0 text-muted-foreground"
                  >
                    <Eye className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setSelectedEditTask(task)}
                    className="size-6 p-0 text-muted-foreground"
                  >
                    <PencilSimple className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setTaskToDelete(task)}
                    className="size-6 p-0 text-destructive"
                  >
                    <Trash className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Inline subtasks for mobile */}
              {isExpanded && (
                <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2.5 border border-border/60 mt-1">
                  {subtasks.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground italic">No subtasks yet.</span>
                  ) : (
                    subtasks.map((st) => (
                      <div key={st.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Checkbox
                            checked={st.status === 'done'}
                            onCheckedChange={() => onToggleSubtask?.(st.id, st.status, task.id)}
                            className="size-3.5"
                          />
                          <span className={cn("truncate text-xs", st.status === 'done' && "line-through text-muted-foreground")}>
                            {st.title}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => handleInlineDeleteSubtask(st.id, task.id)}
                          className="size-5 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash className="size-2.5" />
                        </Button>
                      </div>
                    ))
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Input
                      placeholder="Add subtask..."
                      value={subtaskInputs[task.id] || ''}
                      onChange={(e) => setSubtaskInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleInlineAddSubtask(task.id)
                        }
                      }}
                      disabled={isAddingSubtask[task.id]}
                      className="h-7 text-xs bg-background"
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      onClick={() => handleInlineAddSubtask(task.id)}
                      disabled={!subtaskInputs[task.id]?.trim() || isAddingSubtask[task.id]}
                      className="h-7 text-xs px-2"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop View: Table (md and up) */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="hidden md:block rounded-md border bg-card/60 overflow-hidden"
      >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36px] px-2"></TableHead>
                <TableHead className="min-w-[180px]">Task</TableHead>
                <TableHead className="w-[125px]">Status</TableHead>
                <TableHead className="w-[130px]">Subtasks</TableHead>
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
                const isExpanded = expandedTaskIds.has(task.id)

                const subtasks = task.subtasks || []
                const totalSubtasks = subtasks.length
                const completedSubtasks = subtasks.filter((s) => s.status === 'done').length
                const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0

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
                  <React.Fragment key={task.id}>
                    <TableRow
                      className={cn(
                        "hover:bg-muted/40 transition-colors",
                        isExpanded && "border-b-0 bg-muted/10"
                      )}
                    >
                      {/* Expand / Collapse Button */}
                      <TableCell className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleExpand(task.id)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer inline-flex items-center justify-center"
                          title={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                        >
                          <CaretRight
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              isExpanded && "rotate-90 text-primary"
                            )}
                          />
                        </button>
                      </TableCell>

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

                      {/* Subtasks Progress */}
                      <TableCell>
                        {totalSubtasks > 0 ? (
                          <div
                            className="flex flex-col gap-1 w-24 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => toggleExpand(task.id)}
                            title={`${completedSubtasks}/${totalSubtasks} subtasks completed`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                              <span className="flex items-center gap-1 font-sans">
                                <ListChecks className="size-3 text-primary" />
                                {completedSubtasks}/{totalSubtasks}
                              </span>
                              <span>{progressPercent}%</span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-300",
                                  completedSubtasks === totalSubtasks ? "bg-emerald-500" : "bg-primary"
                                )}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleExpand(task.id)}
                            className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors cursor-pointer"
                          >
                            + Add subtask
                          </button>
                        )}
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

                    {/* Expandable Subtask Tree Row */}
                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/80">
                        <TableCell colSpan={9} className="p-0">
                          <div className="py-2.5 px-8 ml-6 my-1 border-l-2 border-primary/40 flex flex-col gap-2 bg-background/50 rounded-r-md">
                            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5 text-foreground">
                                <ListChecks className="size-3.5 text-primary" />
                                Subtasks {totalSubtasks > 0 && `(${completedSubtasks}/${totalSubtasks})`}
                              </span>
                              {totalSubtasks > 0 && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {progressPercent}% Complete
                                </span>
                              )}
                            </div>

                            {/* Subtasks List */}
                            {totalSubtasks === 0 ? (
                              <p className="text-xs text-muted-foreground italic py-1">
                                No subtasks yet. Add one below.
                              </p>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {subtasks.map((st) => {
                                  const isDone = st.status === 'done'
                                  return (
                                    <div
                                      key={st.id}
                                      className="group/st flex items-center justify-between gap-2.5 rounded px-2 py-1 bg-card hover:bg-accent/40 border border-border/40 transition-colors"
                                    >
                                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <span className="text-muted-foreground/50 text-xs select-none">└</span>
                                        <Checkbox
                                          checked={isDone}
                                          onCheckedChange={() => onToggleSubtask?.(st.id, st.status, task.id)}
                                          className="size-3.5"
                                        />
                                        <span
                                          className={cn(
                                            "text-xs truncate flex-1 select-none",
                                            isDone ? "line-through text-muted-foreground" : "text-foreground font-medium"
                                          )}
                                        >
                                          {st.title}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[10px] font-mono h-5 px-1.5",
                                            isDone
                                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                          )}
                                        >
                                          {isDone ? 'Done' : 'To Do'}
                                        </Badge>

                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="xs"
                                          onClick={() => handleInlineDeleteSubtask(st.id, task.id)}
                                          className="size-5 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover/st:opacity-100 transition-opacity"
                                          title="Delete subtask"
                                        >
                                          <Trash className="size-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Quick Add Subtask Input */}
                            <div className="flex items-center gap-2 pt-1">
                              <Input
                                placeholder="Add subtask..."
                                value={subtaskInputs[task.id] || ''}
                                onChange={(e) =>
                                  setSubtaskInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleInlineAddSubtask(task.id)
                                  }
                                }}
                                disabled={isAddingSubtask[task.id]}
                                className="h-7 text-xs max-w-sm bg-background"
                              />
                              <Button
                                type="button"
                                size="xs"
                                variant="secondary"
                                onClick={() => handleInlineAddSubtask(task.id)}
                                disabled={!subtaskInputs[task.id]?.trim() || isAddingSubtask[task.id]}
                                className="h-7 text-xs gap-1 px-2.5"
                              >
                                <Plus className="size-3" />
                                Add
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </motion.div>
      </>
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
          onToggleSubtask={onToggleSubtask}
          onUpdateTask={onUpdateTask}
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
