'use client'

import { useState } from 'react'
import { createTask } from '@/actions/tasks'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus } from '@phosphor-icons/react/dist/ssr'
import type { ProfileItem } from './task-card'

interface CreateTaskDialogProps {
  projectId: string
  defaultStatus?: 'todo' | 'in_progress' | 'review' | 'done'
  milestones: Array<{ id: string; title: string }>
  profiles?: ProfileItem[]
  onSuccess?: () => void
}

export function CreateTaskDialog({
  projectId,
  defaultStatus = 'todo',
  milestones,
  profiles = [],
  onSuccess,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'review' | 'done'>(defaultStatus)
  const [milestoneId, setMilestoneId] = useState<string>('none')
  const [assigneeId, setAssigneeId] = useState<string>('none')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
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

    const res = await createTask({
      project_id: projectId,
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

    // Reset and close
    setTitle('')
    setDescription('')
    setDueDate('')
    setMilestoneId('none')
    setAssigneeId('none')
    setOpen(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" />
        New Task
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
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
                  if (val === 'todo' || val === 'in_progress' || val === 'review' || val === 'done') {
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
                  <SelectItem value="none" label="None">None</SelectItem>
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
              rows={2}
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
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
