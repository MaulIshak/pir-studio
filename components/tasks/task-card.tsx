'use client'

import { useState, useRef } from 'react'
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
} from '@phosphor-icons/react'
import { cn } from 'cn'
import { EditTaskDialog } from './edit-task-dialog'
import { TaskDetailDialog } from './task-detail-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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
}

interface TaskCardProps {
  task: TaskItem
  projectId: string
  milestones?: Array<{ id: string; title: string }>
  profiles?: ProfileItem[]
  onStatusChange: (taskId: string, status: 'todo' | 'in_progress' | 'review' | 'done') => void
  onUpdateTask?: (updatedTask: TaskItem) => void
  onDelete: (taskId: string) => void
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
  isDragging = false,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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

            <CardContent className="flex flex-wrap items-center gap-1.5 pt-0 pl-7">
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
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                {task.profiles?.avatar_url ? (
                  <img
                    src={task.profiles.avatar_url}
                    alt={task.profiles.name || 'Assignee'}
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
