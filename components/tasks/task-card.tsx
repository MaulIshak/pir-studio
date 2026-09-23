'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  DotsThreeVertical,
  DotsSixVertical,
  PencilSimple,
  Trash,
  Flag,
  CalendarBlank,
  User,
  ClockCountdown,
  Package,
  ListChecks,
  Eye,
  CircleDashed,
  Play,
  CheckCircle,
} from '@phosphor-icons/react'
import { cn } from 'cn'
import { Checkbox } from '@/components/ui/checkbox'
import { EditTaskDialog } from './edit-task-dialog'
import { TaskDetailDialog } from './task-detail-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { SubtaskItem } from '@/actions/tasks'
import type { Asset } from '@/actions/assets'

export interface ProfileItem {
  id: string
  name: string | null
  email?: string | null
  avatar_url?: string | null
}

export interface TaskItem {
  id: string
  project_id?: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'review' | 'done'
  due_date: string | null
  milestone_id?: string | null
  assignee_id?: string | null
  milestones?: { id: string; title: string } | null
  profiles?: { id: string; name: string; avatar_url?: string | null } | null
  assets?: Asset[]
  subtasks?: SubtaskItem[]
}

interface TaskCardProps {
  task: TaskItem
  projectId: string
  milestones?: Array<{ id: string; title: string }>
  profiles?: ProfileItem[]
  onStatusChange: (taskId: string, status: 'todo' | 'in_progress' | 'review' | 'done') => void
  onUpdateTask?: (updatedTask: TaskItem) => void
  onDelete: (taskId: string) => void
  onToggleSubtask?: (subtaskId: string, currentStatus: 'todo' | 'done', taskId: string) => void
  isDragging?: boolean
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void
}

export function TaskCard({
  task,
  projectId,
  milestones = [],
  profiles = [],
  onStatusChange,
  onUpdateTask,
  onDelete,
  onToggleSubtask,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAllSubtasks, setShowAllSubtasks] = useState(false)
  const dragStartedRef = useRef(false)

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

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      await onDelete(task.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const subtasks = task.subtasks || []
  const totalSubtasks = subtasks.length
  const completedSubtasks = subtasks.filter((st) => st.status === 'done').length
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0

  return (
    <>
      <motion.div
        layout
        layoutId={task.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: isDragging ? 0 : -2, transition: { duration: 0.15 } }}
        transition={{ duration: 0.2 }}
        className="w-full"
      >
        <div
          draggable
          onDragStart={(e) => {
            dragStartedRef.current = true
            e.dataTransfer.setData('text/plain', task.id)
            e.dataTransfer.effectAllowed = 'move'
            onDragStart?.(e)
          }}
          onDragEnd={(e) => {
            setTimeout(() => {
              dragStartedRef.current = false
            }, 50)
            onDragEnd?.(e)
          }}
          onClick={() => {
            if (dragStartedRef.current || isDragging) return
            setIsDetailOpen(true)
          }}
          className={cn(
            "cursor-pointer select-none transition-opacity",
            isDragging && "opacity-40 cursor-grabbing"
          )}
        >
          <Card
            size="sm"
            className={cn(
              "group flex flex-col justify-between gap-2 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm bg-card hover:bg-accent/[0.02]",
              isDragging && "border-dashed border-primary/50 bg-primary/5 shadow-none"
            )}
          >
            <CardHeader className="pb-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5 min-w-0 flex-1">
                  <DotsSixVertical className="size-3.5 mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
                  <CardTitle className="text-xs font-semibold leading-snug break-words group-hover:text-primary transition-colors">
                    {task.title}
                  </CardTitle>
                </div>
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  draggable={false}
                  className="shrink-0"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="xs"
                          className="size-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DotsThreeVertical className="size-3.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsDetailOpen(true)
                        }}
                      >
                        <Eye className="size-3.5" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <PencilSimple className="size-3.5" />
                        Edit Task
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {task.status !== 'todo' && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(task.id, 'todo')
                          }}
                        >
                          <CircleDashed className="size-3.5 text-slate-400" />
                          Move to To Do
                        </DropdownMenuItem>
                      )}
                      {task.status !== 'in_progress' && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(task.id, 'in_progress')
                          }}
                        >
                          <Play className="size-3.5 text-blue-400" />
                          Move to In Progress
                        </DropdownMenuItem>
                      )}
                      {task.status !== 'review' && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(task.id, 'review')
                          }}
                        >
                          <Eye className="size-3.5 text-amber-400" />
                          Move to Review
                        </DropdownMenuItem>
                      )}
                      {task.status !== 'done' && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(task.id, 'done')
                          }}
                        >
                          <CheckCircle className="size-3.5 text-emerald-400" />
                          Move to Done
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsConfirmDeleteDialogOpen(true)
                        }}
                      >
                        <Trash className="size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {task.description && (
                <CardDescription className="line-clamp-2 text-xs pl-5">
                  {task.description}
                </CardDescription>
              )}
            </CardHeader>

            <CardContent className="flex flex-col gap-2 pt-0 pl-7 pr-3">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {task.milestones?.title && (
                  <Badge variant="outline" className="gap-1 text-[10px] bg-primary/5 border-primary/20 text-primary">
                    <Flag className="size-2.5" />
                    {task.milestones.title}
                  </Badge>
                )}
                {task.due_date && (
                  <Badge
                    variant={isOverdue ? 'destructive' : 'secondary'}
                    className="gap-1 text-[10px] font-mono"
                  >
                    {isOverdue ? (
                      <ClockCountdown className="size-2.5" />
                    ) : (
                      <CalendarBlank className="size-2.5" />
                    )}
                    {task.due_date}
                  </Badge>
                )}
                {task.assets && task.assets.length > 0 && (
                  <Badge variant="outline" className="gap-1 text-[10px] bg-purple-500/5 border-purple-500/20 text-purple-400">
                    <Package className="size-2.5" />
                    {task.assets.filter((a) => a.status === 'done' || a.status === 'implemented').length}/{task.assets.length} Assets
                  </Badge>
                )}
              </div>

              {/* Subtasks Hierarchy Block */}
              {totalSubtasks > 0 && (
                <div
                  className="mt-0.5 flex flex-col gap-1.5 rounded-md border border-border/60 bg-secondary/30 p-2 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span className="flex items-center gap-1 text-foreground/80 font-medium">
                      <ListChecks className="size-3 text-primary" />
                      Subtasks
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {completedSubtasks}/{totalSubtasks}
                    </span>
                  </div>

                  {/* Mini Progress Bar */}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        completedSubtasks === totalSubtasks ? "bg-emerald-500" : "bg-primary"
                      )}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Checklist items */}
                  <div className="flex flex-col gap-1 pt-0.5">
                    {(showAllSubtasks ? subtasks : subtasks.slice(0, 3)).map((st) => {
                      const isDone = st.status === 'done'
                      return (
                        <div
                          key={st.id}
                          className="group/st flex items-center gap-2 rounded px-1 py-0.5 hover:bg-background/60 transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleSubtask?.(st.id, st.status, task.id)
                          }}
                        >
                          <Checkbox
                            checked={isDone}
                            onCheckedChange={() => onToggleSubtask?.(st.id, st.status, task.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="size-3.5"
                          />
                          <span
                            className={cn(
                              "text-[11px] truncate flex-1 transition-all select-none",
                              isDone ? "line-through text-muted-foreground" : "text-foreground"
                            )}
                            title={st.title}
                          >
                            {st.title}
                          </span>
                        </div>
                      )
                    })}
                    {totalSubtasks > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowAllSubtasks(!showAllSubtasks)
                        }}
                        className="text-[10px] text-primary/80 hover:text-primary font-medium text-left pl-1 pt-0.5 cursor-pointer"
                      >
                        {showAllSubtasks ? 'Show less' : `+ ${totalSubtasks - 3} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                {task.profiles?.avatar_url ? (
                  <Image
                    src={task.profiles.avatar_url}
                    alt={task.profiles.name || 'Assignee'}
                    width={14}
                    height={14}
                    className="size-3.5 rounded-full object-cover"
                  />
                ) : (
                  <User className={cn("size-3", task.profiles ? "text-primary" : "text-muted-foreground")} />
                )}
                <span className={task.profiles ? "text-foreground" : "text-muted-foreground"}>
                  {task.profiles?.name || 'Unassigned'}
                </span>
              </span>
              <span className="capitalize font-mono text-[9px] text-muted-foreground">
                {task.status.replace('_', ' ')}
              </span>
            </CardFooter>
          </Card>
        </div>
      </motion.div>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={task}
        projectId={projectId}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={() => {
          setIsDetailOpen(false)
          setIsEditDialogOpen(true)
        }}
        onDelete={() => {
          setIsDetailOpen(false)
          setIsConfirmDeleteDialogOpen(true)
        }}
        onStatusChange={(taskId, newStatus) => {
          onStatusChange(taskId, newStatus)
        }}
        onToggleSubtask={onToggleSubtask}
        onUpdateTask={onUpdateTask}
      />

      {/* Edit Task Dialog */}
      <EditTaskDialog
        task={task}
        projectId={projectId}
        milestones={milestones}
        profiles={profiles}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={(updated) => {
          onUpdateTask?.(updated)
        }}
      />

      {/* Reusable Confirm Delete Dialog */}
      <ConfirmDialog
        open={isConfirmDeleteDialogOpen}
        onOpenChange={setIsConfirmDeleteDialogOpen}
        title="Delete Task"
        description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        icon="trash"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}
