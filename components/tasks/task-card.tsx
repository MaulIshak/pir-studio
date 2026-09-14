'use client'

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
  Trash,
  Flag,
  CalendarBlank,
  User,
  ClockCountdown,
} from '@phosphor-icons/react'
import { cn } from 'cn'

export interface TaskItem {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'review' | 'done'
  due_date: string | null
  milestones?: { id: string; title: string } | null
  profiles?: { id: string; name: string; avatar_url: string } | null
}

interface TaskCardProps {
  task: TaskItem
  onStatusChange: (taskId: string, status: 'todo' | 'in_progress' | 'review' | 'done') => void
  onDelete: (taskId: string) => void
  isDragging?: boolean
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void
}

export function TaskCard({
  task,
  onStatusChange,
  onDelete,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
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

  return (
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
          e.dataTransfer.setData('text/plain', task.id)
          e.dataTransfer.effectAllowed = 'move'
          onDragStart?.(e)
        }}
        onDragEnd={(e) => {
          onDragEnd?.(e)
        }}
        className={cn(
          "cursor-grab active:cursor-grabbing select-none transition-opacity",
          isDragging && "opacity-40"
        )}
      >
      <Card
        size="sm"
        className={cn(
          "group flex flex-col justify-between gap-2 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm bg-card",
          isDragging && "border-dashed border-primary/50 bg-primary/5 shadow-none"
        )}
      >
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 min-w-0 flex-1">
              <DotsSixVertical className="size-3.5 mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
              <CardTitle className="text-xs font-semibold leading-snug break-words">{task.title}</CardTitle>
            </div>
            <div onMouseDown={(e) => e.stopPropagation()} draggable={false} className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="xs" className="size-6 p-0 text-muted-foreground">
                      <DotsThreeVertical className="size-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  {task.status !== 'todo' && (
                    <DropdownMenuItem onClick={() => onStatusChange(task.id, 'todo')}>
                      Move to To Do
                    </DropdownMenuItem>
                  )}
                  {task.status !== 'in_progress' && (
                    <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
                      Move to In Progress
                    </DropdownMenuItem>
                  )}
                  {task.status !== 'review' && (
                    <DropdownMenuItem onClick={() => onStatusChange(task.id, 'review')}>
                      Move to Review
                    </DropdownMenuItem>
                  )}
                  {task.status !== 'done' && (
                    <DropdownMenuItem onClick={() => onStatusChange(task.id, 'done')}>
                      Move to Done
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(task.id)}
                  >
                    <Trash className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {task.description && (
            <CardDescription className="line-clamp-2 text-xs pl-5">{task.description}</CardDescription>
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
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="size-3 text-muted-foreground" />
            {task.profiles?.name || 'Unassigned'}
          </span>
          <span className="capitalize font-mono text-[9px] text-muted-foreground">
            {task.status.replace('_', ' ')}
          </span>
        </CardFooter>
      </Card>
      </div>
    </motion.div>
  )
}
