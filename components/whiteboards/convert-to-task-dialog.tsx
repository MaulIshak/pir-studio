'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckSquareOffset, Link as LinkIcon } from '@phosphor-icons/react'
import {
  createTasksFromElements,
  linkExistingTaskToElement,
} from '@/actions/boards'
import type { ProfileItem, TaskItem } from '@/components/tasks/task-card'
import type { BoardTaskLinkRecord } from '@/lib/whiteboards/types'

export interface SelectedElementDraft {
  elementId: string
  suggestedTitle: string
}

interface ConvertToTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  projectId: string
  selectedElements: SelectedElementDraft[]
  milestones: Array<{ id: string; title: string }>
  profiles: ProfileItem[]
  existingTasks: TaskItem[]
  onTasksLinked: (
    pairs: Array<{ elementId: string; task: TaskItem; link: BoardTaskLinkRecord }>
  ) => void
}

const STATUS_LABELS: Record<'todo' | 'in_progress' | 'review' | 'done', string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

export function ConvertToTaskDialog({
  open,
  onOpenChange,
  boardId,
  projectId,
  selectedElements,
  milestones,
  profiles,
  existingTasks,
  onTasksLinked,
}: ConvertToTaskDialogProps) {
  const [tab, setTab] = useState<'create' | 'link'>('create')
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'review' | 'done'>('todo')
  const [milestoneId, setMilestoneId] = useState<string>('none')
  const [assigneeId, setAssigneeId] = useState<string>('none')
  const [dueDate, setDueDate] = useState('')
  const [selectedExistingTaskId, setSelectedExistingTaskId] = useState<string>('none')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)

  if (open && !prevOpen) {
    setPrevOpen(true)
    const nextTitles: Record<string, string> = {}
    for (const el of selectedElements) {
      nextTitles[el.elementId] = el.suggestedTitle
    }
    setTitles(nextTitles)
    setDescription('')
    setStatus('todo')
    setMilestoneId('none')
    setAssigneeId('none')
    setDueDate('')
    setSelectedExistingTaskId('none')
    setError(null)
    setTab('create')
  } else if (!open && prevOpen) {
    setPrevOpen(false)
  }

  const selectedMilestoneLabel =
    milestoneId === 'none'
      ? 'No Milestone'
      : milestones.find((m) => m.id === milestoneId)?.title ?? 'No Milestone'

  const selectedAssigneeLabel =
    assigneeId === 'none'
      ? 'Unassigned'
      : profiles.find((p) => p.id === assigneeId)?.name ?? 'Unassigned'

  const selectedExistingTaskLabel =
    selectedExistingTaskId === 'none'
      ? 'Select Task'
      : existingTasks.find((t) => t.id === selectedExistingTaskId)?.title ?? 'Select Task'

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedElements.length === 0) return

    const items = selectedElements.map((el) => ({
      elementId: el.elementId,
      title: (titles[el.elementId] ?? el.suggestedTitle).trim(),
      description: selectedElements.length === 1 ? description.trim() || null : null,
      status,
      milestone_id: milestoneId === 'none' ? null : milestoneId,
      assignee_id: assigneeId === 'none' ? null : assigneeId,
      due_date: dueDate || null,
    }))

    if (items.some((i) => !i.title)) {
      setError('Every task needs a title')
      return
    }

    setLoading(true)
    setError(null)

    const res = await createTasksFromElements({
      boardId,
      projectId,
      items,
    })

    setLoading(false)

    if (res.error || !res.created) {
      setError(res.error ?? 'Failed to create tasks')
      return
    }

    onTasksLinked(
      res.created.map((c) => ({
        elementId: c.elementId,
        task: c.task as unknown as TaskItem,
        link: c.link,
      }))
    )
    onOpenChange(false)
  }

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetElement = selectedElements[0]
    if (!targetElement || selectedExistingTaskId === 'none') {
      setError('Select a task to link')
      return
    }

    setLoading(true)
    setError(null)

    const res = await linkExistingTaskToElement({
      boardId,
      taskId: selectedExistingTaskId,
      elementId: targetElement.elementId,
    })

    setLoading(false)

    if (res.error || !res.link) {
      setError(res.error ?? 'Failed to link task')
      return
    }

    const existing = existingTasks.find((t) => t.id === selectedExistingTaskId)
    if (existing) {
      onTasksLinked([
        {
          elementId: targetElement.elementId,
          task: existing,
          link: res.link,
        },
      ])
    }
    onOpenChange(false)
  }

  const isBatch = selectedElements.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckSquareOffset className="size-4 text-primary" />
            {isBatch ? 'Create Tasks' : 'Task Link'}
            {isBatch && (
              <Badge variant="secondary" className="font-mono text-xs">
                {selectedElements.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as 'create' | 'link')
            setError(null)
          }}
        >
          {!isBatch && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">New Task</TabsTrigger>
              <TabsTrigger value="link">Link Existing</TabsTrigger>
            </TabsList>
          )}

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="create" className="mt-3">
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  {isBatch ? 'Task Titles' : 'Title'}
                </label>
                <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                  {selectedElements.map((el) => (
                    <Input
                      key={el.elementId}
                      value={titles[el.elementId] ?? ''}
                      onChange={(e) =>
                        setTitles((prev) => ({
                          ...prev,
                          [el.elementId]: e.target.value,
                        }))
                      }
                      placeholder="Task title"
                      required
                    />
                  ))}
                </div>
              </div>

              {!isBatch && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Description
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes"
                    rows={2}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Status</label>
                  <Select
                    value={status}
                    onValueChange={(v) =>
                      setStatus(v as 'todo' | 'in_progress' | 'review' | 'done')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>{STATUS_LABELS[status]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Due Date</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Milestone</label>
                  <Select
                    value={milestoneId}
                    onValueChange={(v) => setMilestoneId(v ?? 'none')}
                  >
                    <SelectTrigger>
                      <SelectValue>{selectedMilestoneLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Milestone</SelectItem>
                      {milestones.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Assignee</label>
                  <Select
                    value={assigneeId}
                    onValueChange={(v) => setAssigneeId(v ?? 'none')}
                  >
                    <SelectTrigger>
                      <SelectValue>{selectedAssigneeLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? 'Creating...' : isBatch ? 'Create Tasks' : 'Create Task'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {!isBatch && (
            <TabsContent value="link" className="mt-3">
              <form onSubmit={handleLinkSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Task</label>
                  <Select
                    value={selectedExistingTaskId}
                    onValueChange={(v) => setSelectedExistingTaskId(v ?? 'none')}
                  >
                    <SelectTrigger>
                      <SelectValue>{selectedExistingTaskLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select Task</SelectItem>
                      {existingTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loading || selectedExistingTaskId === 'none'}
                    className="gap-1.5"
                  >
                    <LinkIcon className="size-3.5" />
                    {loading ? 'Linking...' : 'Link Task'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
