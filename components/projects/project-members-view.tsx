'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignMembersToProject } from '@/actions/organizations'
import type { ProjectMemberUser } from '@/actions/projects'
import type { OrgRole } from '@/lib/auth/permissions'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, UserPlus, ShieldCheck } from '@phosphor-icons/react'

interface OrgMemberOption {
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: OrgRole
}

interface ProjectMembersViewProps {
  projectId: string
  projectName: string
  currentUserRole: OrgRole
  members: ProjectMemberUser[]
  allOrgMembers: OrgMemberOption[]
}

export function ProjectMembersView({
  projectId,
  projectName,
  currentUserRole,
  members,
  allOrgMembers,
}: ProjectMembersViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Selected assigned user IDs
  const initialAssignedIds = members
    .filter((m) => m.accessType === 'assigned')
    .map((m) => m.userId)

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialAssignedIds)

  const canManage = currentUserRole === 'leader' || currentUserRole === 'co_leader'

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const res = await assignMembersToProject(projectId, selectedUserIds)
      if (res.error) {
        setError(res.error)
      } else {
        setDialogOpen(false)
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Project Members
          </h2>
          <p className="text-xs text-muted-foreground">
            People who have access to view, update tasks, and collaborate on {projectName}.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setSelectedUserIds(members.filter((m) => m.accessType === 'assigned').map((m) => m.userId))
              setDialogOpen(true)
            }}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            <UserPlus className="size-3.5" />
            Manage Members
          </Button>
        )}
      </div>

      {/* Members Table */}
      <Card className="border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Organization Role</TableHead>
              <TableHead className="text-xs">Access Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.userId}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      <AvatarImage src={m.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs font-semibold">
                        {m.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {m.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">{m.email}</span>
                    </div>
                  </div>
                </TableCell>

                <TableCell>{renderRoleBadge(m.role)}</TableCell>

                <TableCell>
                  {m.accessType === 'organization' ? (
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <ShieldCheck className="size-3.5 text-primary" />
                      Organization Admin
                    </span>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      Assigned Member
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Manage Members Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Manage Project Members</DialogTitle>
            <DialogDescription className="text-xs">
              Assign organization members to {projectName}. Leaders and Co-Leaders already have automatic access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[300px] overflow-y-auto">
            {allOrgMembers
              .filter((om) => om.role === 'member')
              .map((om) => {
                const isChecked = selectedUserIds.includes(om.userId)
                return (
                  <div
                    key={om.userId}
                    onClick={() => handleToggleUser(om.userId)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={isChecked} />
                      <Avatar className="size-7">
                        <AvatarImage src={om.avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {om.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">{om.name}</span>
                        <span className="text-[10px] text-muted-foreground">{om.email}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Member
                    </Badge>
                  </div>
                )
              })}

            {allOrgMembers.filter((om) => om.role === 'member').length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No regular organization members to assign.
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="text-xs"
            >
              {isPending ? 'Saving...' : 'Save Members'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
