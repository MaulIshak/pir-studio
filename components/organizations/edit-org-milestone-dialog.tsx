'use client'

import { useState } from 'react'
import { updateOrgMilestone, type OrgMilestoneItem } from '@/actions/org-milestones'
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
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Folder, Users, Info } from '@phosphor-icons/react'

interface ProjectOption {
  id: string
  name: string
  slug: string
  status: string
}

interface MemberOption {
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
}

interface EditOrgMilestoneDialogProps {
  milestone: OrgMilestoneItem | null
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ProjectOption[]
  members: MemberOption[]
  onSuccess?: (milestone?: OrgMilestoneItem) => void
}

export function EditOrgMilestoneDialog({
  milestone,
  organizationId,
  open,
  onOpenChange,
  projects,
  members,
  onSuccess,
}: EditOrgMilestoneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Edit Organization Milestone</DialogTitle>
        </DialogHeader>

        {milestone && open && (
          <EditOrgMilestoneForm
            key={milestone.id}
            milestone={milestone}
            organizationId={organizationId}
            projects={projects}
            members={members}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditOrgMilestoneForm({
  milestone,
  organizationId,
  projects,
  members,
  onOpenChange,
  onSuccess,
}: {
  milestone: OrgMilestoneItem
  organizationId: string
  projects: ProjectOption[]
  members: MemberOption[]
  onOpenChange: (open: boolean) => void
  onSuccess?: (milestone?: OrgMilestoneItem) => void
}) {
  const [title, setTitle] = useState(milestone.title)
  const [description, setDescription] = useState(milestone.description || '')
  const [startDate, setStartDate] = useState(milestone.start_date || '')
  const [dueDate, setDueDate] = useState(milestone.due_date || '')
  const [status, setStatus] = useState<'not_started' | 'in_progress' | 'done'>(milestone.status)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    milestone.project_id || 'none'
  )

  const regularMembers = members.filter((m) => m.role === 'member')
  const initialSelectedMemberIds = milestone.members?.map((m) => m.userId) || []
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(initialSelectedMemberIds)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAllMembersSelected =
    regularMembers.length > 0 && selectedMemberIds.length === regularMembers.length

  const handleToggleSelectAll = () => {
    if (isAllMembersSelected) {
      setSelectedMemberIds([])
    } else {
      setSelectedMemberIds(regularMembers.map((m) => m.userId))
    }
  }

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

    const isConnectedToProject = selectedProjectId !== 'none' && selectedProjectId !== ''

    const res = await updateOrgMilestone(milestone.id, organizationId, {
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate || null,
      due_date: dueDate || null,
      status,
      project_id: isConnectedToProject ? selectedProjectId : null,
      member_ids: isConnectedToProject ? [] : selectedMemberIds,
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    onOpenChange(false)
    onSuccess?.(res.milestone as unknown as OrgMilestoneItem)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 pt-2">
      {error && (
        <Alert variant="destructive" className="py-2 text-xs">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Title *</label>
        <Input
          placeholder="e.g. Q4 Studio Showcase or Game Jam Submission"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <Textarea
          placeholder="Milestone goals, deliverables, or review criteria..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Connected Project</label>
          <Select
            value={selectedProjectId}
            onValueChange={(val) => {
              if (val) setSelectedProjectId(val)
            }}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="None (Organization-wide)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Organization-wide)</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <label className="text-xs font-medium text-foreground">Due Date</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* Access Control Notice or Member Selection */}
      {selectedProjectId !== 'none' && selectedProjectId !== '' ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2 text-xs">
          <Folder className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-primary">Connected to Project</span>
            <p className="text-[11px] text-muted-foreground">
              Visibility is automatically synced with project access. Leaders, Co-Leaders, and members assigned to this project can view this milestone.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="size-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Member Visibility</span>
            </div>
            {regularMembers.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleToggleSelectAll}
                className="h-6 text-[11px] px-2 text-primary hover:text-primary/90"
              >
                {isAllMembersSelected ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Info className="size-3 text-muted-foreground shrink-0" />
            Leaders & Co-Leaders always have access. Select regular members who can view this milestone:
          </p>

          {regularMembers.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic py-1">
              No regular members in this organization yet.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 pt-1">
              {regularMembers.map((m) => {
                const isChecked = selectedMemberIds.includes(m.userId)
                return (
                  <div
                    key={m.userId}
                    onClick={() => handleToggleMember(m.userId)}
                    className="flex items-center justify-between p-2 rounded-md border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={isChecked} />
                      <Avatar className="size-6">
                        <AvatarImage src={m.avatarUrl || undefined} />
                        <AvatarFallback className="text-[9px]">
                          {m.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs font-medium text-foreground">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground">{m.email}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                      Member
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={loading}
          className="text-xs"
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={loading} className="text-xs">
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
