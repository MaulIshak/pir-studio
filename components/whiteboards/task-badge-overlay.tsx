'use client'

import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  CircleDashed,
  Eye,
  Play,
} from '@phosphor-icons/react'
import type { TaskItem } from '@/components/tasks/task-card'
import type { BoardTaskLinkRecord } from '@/lib/whiteboards/types'

export interface OverlayElementRect {
  id: string
  x: number
  y: number
  width: number
  height: number
  linkedTaskId?: string
}

interface TaskBadgeOverlayProps {
  elements: OverlayElementRect[]
  links: BoardTaskLinkRecord[]
  tasksById: Map<string, TaskItem>
  scrollX: number
  scrollY: number
  zoom: number
  onSelectTask: (task: TaskItem) => void
}

const STATUS_STYLE = {
  todo: {
    label: 'To Do',
    icon: CircleDashed,
    className:
      'bg-background/95 text-muted-foreground border-border hover:border-foreground/40',
  },
  in_progress: {
    label: 'In Progress',
    icon: Play,
    className:
      'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/35 hover:bg-blue-500/25',
  },
  review: {
    label: 'Review',
    icon: Eye,
    className:
      'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35 hover:bg-amber-500/25',
  },
  done: {
    label: 'Done',
    icon: CheckCircle,
    className:
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/25',
  },
} as const

/**
 * Pure client-side presentation layer rendering live task status badges
 * over linked Excalidraw elements. Task status is NEVER copied into Yjs;
 * it always reads from live Supabase task state.
 */
export function TaskBadgeOverlay({
  elements,
  links,
  tasksById,
  scrollX,
  scrollY,
  zoom,
  onSelectTask,
}: TaskBadgeOverlayProps) {
  if (elements.length === 0 || tasksById.size === 0) {
    return null
  }

  // Combine DB links (authoritative) + element customData.linkedTaskId
  const taskIdByElementId = new Map<string, string>()
  for (const link of links) {
    if (link.element_id && tasksById.has(link.task_id)) {
      taskIdByElementId.set(link.element_id, link.task_id)
    }
  }
  for (const el of elements) {
    if (el.linkedTaskId && tasksById.has(el.linkedTaskId) && !taskIdByElementId.has(el.id)) {
      taskIdByElementId.set(el.id, el.linkedTaskId)
    }
  }

  if (taskIdByElementId.size === 0) {
    return null
  }

  return (
    <div
      aria-label="Linked task badges"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {elements.map((el) => {
        const taskId = taskIdByElementId.get(el.id)
        if (!taskId) return null
        const task = tasksById.get(taskId)
        if (!task) return null

        const screenX = (el.x + el.width + scrollX) * zoom
        const screenY = (el.y + scrollY) * zoom

        // Skip badges clearly outside reasonable screen bounds
        if (screenX < -200 || screenY < -100 || screenX > 5000 || screenY > 5000) {
          return null
        }

        const cfg = STATUS_STYLE[task.status] ?? STATUS_STYLE.todo
        const Icon = cfg.icon
        const assigneeInitial = task.profiles?.name?.trim()?.charAt(0)?.toUpperCase()

        return (
          <div
            key={`${el.id}:${task.id}`}
            style={{
              transform: `translate(${Math.round(screenX - 8)}px, ${Math.round(screenY - 12)}px)`,
            }}
            className="pointer-events-auto absolute top-0 left-0 -translate-x-full"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelectTask(task)
              }}
              title={`${task.title} — ${cfg.label}`}
              className="cursor-pointer focus:outline-none"
            >
              <Badge
                variant="outline"
                className={`h-5 gap-1 px-1.5 text-[10px] font-medium shadow-sm backdrop-blur-sm transition-colors ${cfg.className}`}
              >
                <Icon className="size-3 shrink-0" />
                <span className="max-w-[110px] truncate">{cfg.label}</span>
                {assigneeInitial && (
                  <span className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold">
                    {assigneeInitial}
                  </span>
                )}
              </Badge>
            </button>
          </div>
        )
      })}
    </div>
  )
}

