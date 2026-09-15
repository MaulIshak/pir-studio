'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { updateTaskStatus, deleteTask, updateSubtaskStatus, type SubtaskItem } from '@/actions/tasks'
import { TaskCard, type TaskItem, type ProfileItem } from './task-card'
import { CreateTaskDialog } from './create-task-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { CircleDashed, Play, Eye, CheckCircle, Funnel, ArrowDown, User, Kanban, Table as TableIcon } from '@phosphor-icons/react'
import { TaskTable } from './task-table'
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
  profiles?: ProfileItem[]
}

export function KanbanBoard({
  projectId,
  initialTasks,
  milestones,
  profiles = [],
}: KanbanBoardProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks)

  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks)
  if (prevInitialTasks !== initialTasks) {
    setPrevInitialTasks(initialTasks)
    setTasks(initialTasks)
  }
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [selectedMilestone, setSelectedMilestone] = useState<string>('all')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [activeDropColId, setActiveDropColId] = useState<string | null>(null)
  const supabase = createClient()

  // Realtime subscription on tasks and subtasks tables
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
              return [{ ...newTask, subtasks: [] }, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TaskItem
            setTasks((prev) =>
              prev.map((t) =>
                t.id === updated.id
                  ? { ...t, ...updated, subtasks: t.subtasks || [] }
                  : t
              )
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setTasks((prev) => prev.filter((t) => t.id !== deletedId))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subtasks',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newSubtask = payload.new as SubtaskItem
            setTasks((prev) =>
              prev.map((t) => {
                if (t.id === newSubtask.task_id) {
                  const currentSubtasks = t.subtasks || []
                  if (currentSubtasks.some((s) => s.id === newSubtask.id)) return t
                  return { ...t, subtasks: [...currentSubtasks, newSubtask] }
                }
                return t
              })
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as SubtaskItem
            setTasks((prev) =>
              prev.map((t) => {
                if (t.id === updated.task_id) {
                  return {
                    ...t,
                    subtasks: (t.subtasks || []).map((s) =>
                      s.id === updated.id ? { ...s, ...updated } : s
                    ),
                  }
                }
                return t
              })
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setTasks((prev) =>
              prev.map((t) => ({
                ...t,
                subtasks: (t.subtasks || []).filter((s) => s.id !== deletedId),
              }))
            )
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

  // Handle subtask status toggle (Optimistic)
  const handleToggleSubtask = async (
    subtaskId: string,
    currentStatus: 'todo' | 'done',
    taskId: string
  ) => {
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done'
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: (t.subtasks || []).map((s) =>
              s.id === subtaskId ? { ...s, status: nextStatus } : s
            ),
          }
        }
        return t
      })
    )

    const res = await updateSubtaskStatus(subtaskId, nextStatus, projectId)
    if (res.error) {
      console.error('Failed to update subtask status:', res.error)
    }
  }

  // Handle task edit update
  const handleUpdateTask = (updated: TaskItem) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
    )
  }

  // Handle delete (Optimistic)
  const handleDelete = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await deleteTask(taskId, projectId)
  }

  // Filter tasks by milestone, assignee, and status
  const displayedTasks = tasks.filter((t) => {
    const matchMilestone =
      selectedMilestone === 'all' ||
      t.milestones?.id === selectedMilestone ||
      t.milestone_id === selectedMilestone

    const matchAssignee =
      selectedAssignee === 'all'
        ? true
        : selectedAssignee === 'unassigned'
        ? !t.profiles && !t.assignee_id
        : t.profiles?.id === selectedAssignee || t.assignee_id === selectedAssignee

    const matchStatus =
      viewMode === 'kanban' || selectedStatus === 'all'
        ? true
        : t.status === selectedStatus

    return matchMilestone && matchAssignee && matchStatus
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setViewMode('kanban')}
              className={cn(
                "h-7 gap-1.5 px-2.5 text-xs transition-all",
                viewMode === 'kanban'
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Kanban className="size-3.5 text-primary" />
              Kanban
            </Button>
            <Button
              type="button"
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setViewMode('table')}
              className={cn(
                "h-7 gap-1.5 px-2.5 text-xs transition-all",
                viewMode === 'table'
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TableIcon className="size-3.5 text-primary" />
              Table
            </Button>
          </div>

          {/* Milestone Filter */}
          <div className="flex items-center gap-1.5">
            <Funnel className="size-3.5 text-muted-foreground" />
            <Select value={selectedMilestone} onValueChange={(val) => val && setSelectedMilestone(val)}>
              <SelectTrigger className="w-36">
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

          {/* Assignee Filter */}
          <div className="flex items-center gap-1.5">
            <User className="size-3.5 text-muted-foreground" />
            <Select value={selectedAssignee} onValueChange={(val) => val && setSelectedAssignee(val)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="All assignees">All assignees</SelectItem>
                <SelectItem value="unassigned" label="Unassigned">Unassigned</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} label={p.name || p.email || 'Member'}>
                    {p.name || p.email || 'Member'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter (Active in Table View) */}
          {viewMode === 'table' && (
            <div className="flex items-center gap-1.5">
              <CircleDashed className="size-3.5 text-muted-foreground" />
              <Select value={selectedStatus} onValueChange={(val) => val && setSelectedStatus(val)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <CreateTaskDialog
          projectId={projectId}
          milestones={milestones}
          profiles={profiles}
          onSuccess={(newTask) => {
            if (newTask) {
              setTasks((prev) => {
                if (prev.some((t) => t.id === newTask.id)) return prev
                return [newTask, ...prev]
              })
            }
            router.refresh()
          }}
        />
      </div>

      {/* View Content (Kanban or Table) */}
      {viewMode === 'kanban' ? (
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
                          projectId={projectId}
                          milestones={milestones}
                          profiles={profiles}
                          isDragging={draggedTaskId === task.id}
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragEnd={() => {
                            setDraggedTaskId(null)
                            setActiveDropColId(null)
                          }}
                          onStatusChange={handleStatusChange}
                          onUpdateTask={handleUpdateTask}
                          onDelete={handleDelete}
                          onToggleSubtask={handleToggleSubtask}
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
      ) : (
        <TaskTable
          tasks={displayedTasks}
          projectId={projectId}
          milestones={milestones}
          profiles={profiles}
          onStatusChange={handleStatusChange}
          onUpdateTask={handleUpdateTask}
          onDelete={handleDelete}
          onToggleSubtask={handleToggleSubtask}
        />
      )}
    </div>
  )
}
