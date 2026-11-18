'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateMemberRole,
  removeMember,
  inviteMember,
  getOrCreateShareableInvite,
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  UserPlus,
  Copy,
  Check,
  Trash,
  Folder,
  ShieldCheck,
  Link as LinkIcon,
  ArrowClockwise,
  EnvelopeSimple,
  CircleNotch,
} from '@phosphor-icons/react'

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
  const [shareableLink, setShareableLink] = useState<string | null>(null)
  const [isLoadingLink, setIsLoadingLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Project Assignment Dialog State
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null)
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([])
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<MemberRow | null>(null)

  const isLeader = currentUserRole === 'leader'
  const isCoLeader = currentUserRole === 'co_leader'
  const canManage = isLeader || isCoLeader

  // Load or fetch shareable link for current role
  const loadShareableLink = useCallback(
    async (role: 'co_leader' | 'member', forceNew = false) => {
      setIsLoadingLink(true)
      setInviteError(null)
      try {
        const res = await getOrCreateShareableInvite(organizationId, role, forceNew)
        if ('error' in res && res.error) {
          setInviteError(res.error)
        } else if ('inviteLink' in res && res.inviteLink) {
          setShareableLink(`${window.location.origin}${res.inviteLink}`)
        }
      } catch (err: unknown) {
        setInviteError(err instanceof Error ? err.message : 'Failed to generate link')
      } finally {
        setIsLoadingLink(false)
      }
    },
    [organizationId]
  )

  const handleOpenInvite = () => {
    setError(null)
    setInviteError(null)
    setInviteSuccess(null)
    setInviteOpen(true)
    loadShareableLink(inviteRole)
  }

  // Direct Email Invite Submit
  const handleEmailInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviteError(null)
    setInviteSuccess(null)
    startTransition(async () => {
      const res = await inviteMember(organizationId, inviteEmail.trim(), inviteRole)
      if ('error' in res && res.error) {
        setInviteError(res.error)
      } else {
        setInviteSuccess(`Invitation sent to ${inviteEmail}`)
        setInviteEmail('')
      }
    })
  }

  const handleCopyLink = () => {
    if (shareableLink) {
      navigator.clipboard.writeText(shareableLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleResetLink = () => {
    loadShareableLink(inviteRole, true)
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
    setError(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await updateMemberRole(organizationId, member.userId, newRole)
      if (res.error) {
        setError(res.error)
      } else {
        setMemberList((prev) =>
          prev.map((m) => (m.userId === member.userId ? { ...m, role: newRole } : m))
        )
        setSuccessMessage(`Updated ${member.name} role to ${newRole === 'co_leader' ? 'Co-Leader' : 'Member'}`)
        router.refresh()
      }
    })
  }

  // Remove Member
  const handleConfirmRemoveMember = () => {
    if (!memberToRemove) return
    const target = memberToRemove

    setError(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await removeMember(organizationId, target.userId)
      if (res.error) {
        setError(res.error)
      } else {
        setMemberList((prev) => prev.filter((m) => m.userId !== target.userId))
        setSuccessMessage(`Removed ${target.name} from organization`)
        router.refresh()
      }
      setMemberToRemove(null)
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
            onClick={handleOpenInvite}
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
                          onClick={() => setMemberToRemove(m)}
                          disabled={isPending}
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title="Remove Member"
                          aria-label={`Remove ${m.name}`}
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
            <DialogTitle className="text-base font-semibold">Invite Member</DialogTitle>
            <DialogDescription className="text-xs">
              Share an invitation link or send an invite directly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {inviteError && (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}

            {inviteSuccess && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10 py-2 text-xs text-emerald-500">
                <AlertDescription>{inviteSuccess}</AlertDescription>
              </Alert>
            )}

            {/* Role Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Role</label>
              <Select
                value={inviteRole}
                onValueChange={(val) => {
                  if (val) {
                    const newRole = val as 'co_leader' | 'member'
                    setInviteRole(newRole)
                    loadShareableLink(newRole)
                  }
                }}
                disabled={isPending || isLoadingLink}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="co_leader">Co-Leader</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {inviteRole === 'co_leader'
                  ? 'Co-Leaders have full access to all projects and can invite members.'
                  : 'Members only have access to projects they are assigned to.'}
              </p>
            </div>

            {/* Shareable Link Box */}
            <div className="border border-primary/25 bg-primary/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <LinkIcon className="size-3.5" />
                  <span>Shareable Link</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleResetLink}
                  disabled={isLoadingLink}
                  className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground px-1.5"
                  title="Generate a new invitation link"
                >
                  <ArrowClockwise className={`size-3 ${isLoadingLink ? 'animate-spin' : ''}`} />
                  <span>Reset Link</span>
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Input
                  value={isLoadingLink ? 'Generating link...' : shareableLink || ''}
                  readOnly
                  className="h-8 text-xs font-mono bg-background"
                />
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  onClick={handleCopyLink}
                  disabled={!shareableLink || isLoadingLink}
                  className="h-8 gap-1 shrink-0 px-3 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Anyone with this link can join {organizationName} as {inviteRole === 'co_leader' ? 'Co-Leader' : 'Member'}.
              </p>
            </div>

            {/* Divider */}
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-popover px-2 text-muted-foreground font-mono">
                  Or Direct Email
                </span>
              </div>
            </div>

            {/* Direct Email Invite Form */}
            <form onSubmit={handleEmailInviteSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email Address</label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isPending}
                    className="h-8 text-xs"
                  />
                  <Button
                    type="submit"
                    size="xs"
                    disabled={isPending || !inviteEmail.trim()}
                    className="h-8 gap-1 shrink-0 px-3 text-xs"
                  >
                    {isPending ? (
                      <>
                        <CircleNotch className="size-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <EnvelopeSimple className="size-3.5" />
                        <span>Send Invite</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInviteOpen(false)}
                className="text-xs w-full"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
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
                  <label
                    key={p.id}
                    className="flex items-center justify-between p-2.5 border border-border/70 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleProject(p.id)}
                      />
                      <span className="text-xs font-medium text-foreground">{p.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {p.status}
                    </Badge>
                  </label>
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

      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Remove Member"
        description={`Remove ${memberToRemove?.name ?? 'this member'} from ${organizationName}? They will lose access to organization projects.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="destructive"
        icon="trash"
        isLoading={isPending}
        onConfirm={handleConfirmRemoveMember}
      />
    </div>
  )
}
