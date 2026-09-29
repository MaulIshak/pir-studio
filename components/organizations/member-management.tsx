'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateMemberRole,
  removeMember,
  inviteMember,
  assignProjectsToMember,
  getMemberAssignedProjectIds,
} from '@/actions/organizations'
import type { OrgRole } from '@/lib/auth/permissions'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserPlus, Copy, Check, Trash, Folder, ShieldCheck } from '@phosphor-icons/react'

export interface MemberRow {
  memberId: string
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: OrgRole
  joinedAt: string
  assignedProjectsCount: number
}

interface ProjectOption {
  id: string
  name: string
  status: string
}

interface MemberManagementProps {
  organizationId: string
  organizationName: string
  currentUserRole: OrgRole
  currentUserId: string
  members: MemberRow[]
  allProjects: ProjectOption[]
}

export function MemberManagement({
  organizationId,
  organizationName,
  currentUserRole,
  currentUserId,
  members,
  allProjects,
}: MemberManagementProps) {
  const [memberList, setMemberList] = useState<MemberRow[]>(members)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()

  // Invite Dialog State
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'co_leader' | 'member'>('member')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Project Assignment Dialog State
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null)
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([])
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(false)

  const isLeader = currentUserRole === 'leader'
  const isCoLeader = currentUserRole === 'co_leader'
  const canManage = isLeader || isCoLeader

  // Invite Member Submit
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setError(null)
    setGeneratedLink(null)
    startTransition(async () => {
      const res = await inviteMember(organizationId, inviteEmail.trim(), inviteRole)
      if (res.error) {
        setError(res.error)
      } else if (res.inviteLink) {
        const fullLink = `${window.location.origin}${res.inviteLink}`
        setGeneratedLink(fullLink)
        setSuccessMessage(`Invitation sent to ${inviteEmail}`)
        setInviteEmail('')
      }
    })
  }

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Open Project Assignment Dialog
  const handleOpenAssign = async (member: MemberRow) => {
    setSelectedMember(member)
    setIsLoadingAssigned(true)
    setAssignOpen(true)
    try {
      const ids = await getMemberAssignedProjectIds(organizationId, member.userId)
      setAssignedProjectIds(ids)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingAssigned(false)
    }
  }

  const handleToggleProject = (projectId: string) => {
    setAssignedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    )
  }

  const handleSaveAssignments = () => {
    if (!selectedMember) return
    startTransition(async () => {
      const res = await assignProjectsToMember(organizationId, selectedMember.userId, assignedProjectIds)
      if (res.error) {
        setError(res.error)
      } else {
        setMemberList((prev) =>
          prev.map((m) =>
            m.userId === selectedMember.userId
              ? { ...m, assignedProjectsCount: assignedProjectIds.length }
              : m
          )
        )
        setAssignOpen(false)
        router.refresh()
      }
    })
  }

  // Change Role
  const handleRoleChange = (member: MemberRow, newRole: 'co_leader' | 'member') => {
    startTransition(async () => {
      const res = await updateMemberRole(organizationId, member.userId, newRole)
      if (res.error) {
        setError(res.error)
      } else {
        setMemberList((prev) =>
          prev.map((m) => (m.userId === member.userId ? { ...m, role: newRole } : m))
        )
        router.refresh()
      }
    })
  }

  // Remove Member
  const handleRemoveMember = (member: MemberRow) => {
    if (!confirm(`Are you sure you want to remove ${member.name} from ${organizationName}?`)) return

    startTransition(async () => {
      const res = await removeMember(organizationId, member.userId)
      if (res.error) {
        setError(res.error)
      } else {
        setMemberList((prev) => prev.filter((m) => m.userId !== member.userId))
        router.refresh()
      }
    })
  }

  const renderRoleBadge = (role: OrgRole) => {
    switch (role) {
      case 'leader':
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs capitalize">
            Leader
          </Badge>
        )
      case 'co_leader':
        return (
          <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs capitalize">
            Co-Leader
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-muted-foreground/30 bg-muted/40 text-muted-foreground text-xs capitalize">
            Member
          </Badge>
        )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="destructive" className="py-2 text-xs">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 py-2 text-xs">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Header with Invite Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Team Members</h2>
          <p className="text-xs text-muted-foreground">
            Manage member permissions and project access for {organizationName}.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setError(null)
              setGeneratedLink(null)
              setInviteOpen(true)
            }}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            <UserPlus className="size-3.5" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Members Table */}
      <Card className="border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Project Access</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberList.map((m) => {
              const isCurrentUser = m.userId === currentUserId
              const canEditThisMemberRole = isLeader && !isCurrentUser && m.role !== 'leader'
              const canRemoveThisMember = isLeader && !isCurrentUser && m.role !== 'leader'

              return (
                <TableRow key={m.memberId}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarImage src={m.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs font-semibold">
                          {m.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {m.name}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                              You
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate">{m.email}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {canEditThisMemberRole ? (
                      <Select
                        value={m.role}
                        onValueChange={(val) => {
                          if (val) handleRoleChange(m, val as 'co_leader' | 'member')
                        }}
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="co_leader">Co-Leader</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      renderRoleBadge(m.role)
                    )}
                  </TableCell>

                  <TableCell>
                    {m.role === 'leader' || m.role === 'co_leader' ? (
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <ShieldCheck className="size-3.5 text-primary" />
                        All Projects
                      </span>
                    ) : (
                      <span className="text-xs text-foreground font-mono">
                        {m.assignedProjectsCount} assigned
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Project assignment button for regular members */}
                      {canManage && m.role === 'member' && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenAssign(m)}
                          disabled={isPending}
                          className="h-7 text-xs gap-1"
                        >
                          <Folder className="size-3 text-primary" />
                          <span>Assign Projects</span>
                        </Button>
                      )}

                      {/* Remove member button */}
                      {canRemoveThisMember && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(m)}
                          disabled={isPending}
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title="Remove Member"
                        >
                          <Trash className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Invite to {organizationName}</DialogTitle>
            <DialogDescription className="text-xs">
              Send an in-app notification and generate a shareable invitation link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Email Address *</label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Role *</label>
              <Select
                value={inviteRole}
                onValueChange={(val) => {
                  if (val) setInviteRole(val as 'co_leader' | 'member')
                }}
                disabled={isPending}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member (Access to assigned projects only)</SelectItem>
                  <SelectItem value="co_leader">Co-Leader (Access to all projects & can invite)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generatedLink && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <span className="text-[11px] font-semibold text-primary">Invitation Link:</span>
                <div className="flex items-center gap-1.5">
                  <Input value={generatedLink} readOnly className="h-8 text-xs font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleCopyLink}
                    className="h-8 gap-1 shrink-0"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setInviteOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="text-xs">
                {isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Projects Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Assign Project Access</DialogTitle>
            <DialogDescription className="text-xs">
              Select which projects {selectedMember?.name} can access in this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
            {isLoadingAssigned ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading project assignments...</p>
            ) : allProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No projects in this organization yet.</p>
            ) : (
              allProjects.map((p) => {
                const isChecked = assignedProjectIds.includes(p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => handleToggleProject(p.id)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={isChecked} />
                      <span className="text-xs font-medium text-foreground">{p.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {p.status}
                    </Badge>
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAssignOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAssignments}
              disabled={isPending || isLoadingAssigned}
              className="text-xs"
            >
              {isPending ? 'Saving...' : 'Save Assignments'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
