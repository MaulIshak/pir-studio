'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateTask } from '@/actions/tasks'
import type { TaskItem, ProfileItem } from './task-card'

interface EditTaskDialogProps {
  task: TaskItem
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  milestones?: Array<{ id: string; title: string }>
  profiles?: ProfileItem[]
  onSuccess?: (updatedTask: TaskItem) => void
}

interface EditTaskFormProps {
  task: TaskItem
  projectId: string
  milestones: Array<{ id: string; title: string }>
  profiles: ProfileItem[]
  onClose: () => void
  onSuccess?: (updatedTask: TaskItem) => void
}

function EditTaskForm({
  task,
  projectId,
  milestones,
  profiles,
  onClose,
  onSuccess,
}: EditTaskFormProps) {
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'review' | 'done'>(task.status)
  const [milestoneId, setMilestoneId] = useState<string>(
    task.milestones?.id || task.milestone_id || 'none'
  )
  const [assigneeId, setAssigneeId] = useState<string>(
    task.profiles?.id || task.assignee_id || 'none'
  )
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [description, setDescription] = useState(task.description || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError(null)

    const res = await updateTask(task.id, projectId, {
      title: title.trim(),
      status,
      milestone_id: milestoneId === 'none' ? null : milestoneId,
      assignee_id: assigneeId === 'none' ? null : assigneeId,
      due_date: dueDate || null,
      description: description.trim() || null,
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    onClose()
    if (res.task) {
      onSuccess?.(res.task as unknown as TaskItem)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 pt-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Title</label>
        <Input
          placeholder="Task name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Status</label>
          <Select
            value={status}
            onValueChange={(val) => {
              if (
                val === 'todo' ||
                val === 'in_progress' ||
                val === 'review' ||
                val === 'done'
              ) {
                setStatus(val)
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
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
          <label className="text-xs font-medium text-foreground">Assignee</label>
          <Select value={assigneeId} onValueChange={(val) => setAssigneeId(val as string)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" label="Unassigned">
                Unassigned
              </SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id} label={p.name || p.email || 'Member'}>
                  {p.name || p.email || 'Member'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Milestone</label>
          <Select value={milestoneId} onValueChange={(val) => setMilestoneId(val as string)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" label="None">
                None
              </SelectItem>
              {milestones.map((m) => (
                <SelectItem key={m.id} value={m.id} label={m.title}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Due Date</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <Textarea
          placeholder="Task details or acceptance criteria"
          rows={3}
          className="max-h-36 overflow-y-auto resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

export function EditTaskDialog({
  task,
  projectId,
  open,
  onOpenChange,
  milestones = [],
  profiles = [],
  onSuccess,
}: EditTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Edit Task</DialogTitle>
        </DialogHeader>

        {open && (
          <EditTaskForm
            key={task.id}
            task={task}
            projectId={projectId}
            milestones={milestones}
            profiles={profiles}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
