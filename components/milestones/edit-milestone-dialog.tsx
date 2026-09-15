'use client'

import { useState, useEffect } from 'react'
import { updateMilestone } from '@/actions/milestones'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { MilestoneItem } from './milestone-list'

interface EditMilestoneDialogProps {
  milestone: MilestoneItem | null
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (milestone?: any) => void
}

export function EditMilestoneDialog({
  milestone,
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: EditMilestoneDialogProps) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<'not_started' | 'in_progress' | 'done'>('not_started')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (milestone && open) {
      setTitle(milestone.title)
      setStartDate(milestone.start_date || '')
      setDueDate(milestone.due_date || '')
      setStatus(milestone.status)
      setError(null)
    }
  }, [milestone, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!milestone) return

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      setError('End date must be on or after start date')
      return
    }

    setLoading(true)
    setError(null)

    const res = await updateMilestone(milestone.id, projectId, {
      title: title.trim(),
      start_date: startDate || null,
      due_date: dueDate || null,
      status,
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    onOpenChange(false)
    onSuccess?.(res.milestone)
  }

  if (!milestone) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Edit Milestone</DialogTitle>
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
              placeholder="e.g. Core Mechanics Prototype"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Status</label>
            <Select
              value={status}
              onValueChange={(val) => {
                if (val === 'not_started' || val === 'in_progress' || val === 'done') {
                  setStatus(val)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">End Date / Due</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
