'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { updateTaskStatus, deleteTask } from '@/actions/tasks'
import { TaskCard, type TaskItem } from './task-card'
import { CreateTaskDialog } from './create-task-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { CircleDashed, Play, Eye, CheckCircle, Funnel, ArrowDown } from '@phosphor-icons/react'
import { cn } from 'cn'

const COLUMNS = [
  {
    id: 'todo',
    label: 'To Do',
    icon: CircleDashed,
    color: 'text-slate-400',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    cardBorder: 'border-slate-500/20 bg-slate-500/[0.02]',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    icon: Play,
    color: 'text-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    cardBorder: 'border-blue-500/20 bg-blue-500/[0.02]',
  },
  {
    id: 'review',
    label: 'Review',
    icon: Eye,
    color: 'text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cardBorder: 'border-amber-500/20 bg-amber-500/[0.02]',
  },
  {
    id: 'done',
    label: 'Done',
    icon: CheckCircle,
    color: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cardBorder: 'border-emerald-500/20 bg-emerald-500/[0.02]',
  },
] as const

interface KanbanBoardProps {
  projectId: string
  initialTasks: TaskItem[]
  milestones: Array<{ id: string; title: string }>
}

export function KanbanBoard({ projectId, initialTasks, milestones }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks)
  const [selectedMilestone, setSelectedMilestone] = useState<string>('all')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [activeDropColId, setActiveDropColId] = useState<string | null>(null)
  const supabase = createClient()

  // Realtime subscription on tasks table
  useEffect(() => {
    const channel = supabase
      .channel(`tasks_realtime_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as TaskItem
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) return prev
              return [newTask, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TaskItem
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setTasks((prev) => prev.filter((t) => t.id !== deletedId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, supabase])

  // Handle status update (Optimistic)
  const handleStatusChange = async (
    taskId: string,
    newStatus: 'todo' | 'in_progress' | 'review' | 'done'
  ) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )

    const res = await updateTaskStatus(taskId, projectId, newStatus)
    if (res.error) {
      console.error('Failed to update task status:', res.error)
    }
  }

  // Handle delete (Optimistic)
  const handleDelete = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await deleteTask(taskId, projectId)
  }

  // Filter tasks by milestone
  const displayedTasks = tasks.filter((t) => {
    if (selectedMilestone === 'all') return true
    return t.milestones?.id === selectedMilestone
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Funnel className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filter milestone:</span>
          <Select value={selectedMilestone} onValueChange={(val) => setSelectedMilestone(val as string)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All milestones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="All milestones">All milestones</SelectItem>
              {milestones.map((m) => (
                <SelectItem key={m.id} value={m.id} label={m.title}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CreateTaskDialog
          projectId={projectId}
          milestones={milestones}
          onSuccess={() => {}}
        />
      </div>

      {/* 4-Column Kanban Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = displayedTasks.filter((t) => t.status === col.id)
          const Icon = col.icon
          const isDropTarget = activeDropColId === col.id
          const draggedTask = draggedTaskId ? tasks.find((t) => t.id === draggedTaskId) : null
          const isSourceCol = draggedTask?.status === col.id

          return (
            <Card
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (activeDropColId !== col.id) {
                  setActiveDropColId(col.id)
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                setActiveDropColId(col.id)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setActiveDropColId((prev) => (prev === col.id ? null : prev))
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                setActiveDropColId(null)
                const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId
                if (taskId) {
                  const task = tasks.find((t) => t.id === taskId)
                  if (task && task.status !== col.id) {
                    handleStatusChange(taskId, col.id as 'todo' | 'in_progress' | 'review' | 'done')
                  }
                }
                setDraggedTaskId(null)
              }}
              className={cn(
                "flex min-h-[500px] flex-col rounded-lg transition-all duration-200",
                col.cardBorder,
                isDropTarget && !isSourceCol && "ring-2 ring-primary/40 border-primary/60 bg-primary/[0.04] shadow-md"
              )}
            >
              <CardHeader className="border-b pb-3 bg-card/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`size-4 ${col.color}`} />
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      {col.label}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className={`font-mono text-xs ${col.badgeClass}`}>
                    {colTasks.length}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-3 p-3">
                {colTasks.length === 0 ? (
                  <div
                    className={cn(
                      "flex flex-1 flex-col items-center justify-center border border-dashed rounded-md py-8 text-center text-xs transition-all gap-1.5",
                      isDropTarget && !isSourceCol
                        ? "border-primary/60 bg-primary/10 text-primary font-medium scale-[1.01]"
                        : "border-border/60 text-muted-foreground"
                    )}
                  >
                    {isDropTarget && !isSourceCol ? (
                      <>
                        <ArrowDown className="size-4 animate-bounce text-primary" />
                        <span>Release to move to {col.label}</span>
                      </>
                    ) : (
                      <span>No tasks in {col.label}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-3">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          isDragging={draggedTaskId === task.id}
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragEnd={() => {
                            setDraggedTaskId(null)
                            setActiveDropColId(null)
                          }}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                        />
                      ))}
                    </AnimatePresence>
                    {isDropTarget && !isSourceCol && (
                      <div className="flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-primary/50 bg-primary/10 py-3 text-xs font-medium text-primary transition-all animate-pulse">
                        <ArrowDown className="size-3.5" />
                        Drop to move to {col.label}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
