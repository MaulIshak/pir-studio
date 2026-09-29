'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptOrgInvitation, declineOrgInvitation } from '@/actions/notifications'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Buildings, Check, X, ShieldCheck } from '@phosphor-icons/react'
import { notifyOrgChanged, notifyProjectsChanged } from '@/lib/events'

interface InvitationCardProps {
  invitation: {
    id: string
    token: string
    role: string
    status: string
    expiresAt: string | null
    organization: {
      id: string
      name: string
      slug: string
      description: string | null
      leaderName?: string | null
      leaderAvatar?: string | null
      leaderEmail?: string | null
    }
    inviter: {
      name: string | null
      email: string | null
      avatarUrl: string | null
    }
  }
  currentUser: {
    id: string
    name: string | null
    email: string | null
    avatarUrl: string | null
  }
}

export function InvitationCard({ invitation, currentUser }: InvitationCardProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleAccept = () => {
    setError(null)
    startTransition(async () => {
      const res = await acceptOrgInvitation(invitation.id)
      if (res.error) {
        setError(res.error)
      } else {
        notifyOrgChanged(res.organizationId)
        notifyProjectsChanged()
        router.push(`/orgs/${res.organizationSlug || invitation.organization.slug}`)
        router.refresh()
      }
    })
  }

  const handleDecline = () => {
    setError(null)
    startTransition(async () => {
      const res = await declineOrgInvitation(invitation.id)
      if (res.error) {
        setError(res.error)
      } else {
        router.push('/')
        router.refresh()
      }
    })
  }

  const roleLabel = invitation.role === 'co_leader' ? 'Co-Leader' : 'Member'

  return (
    <Card className="border-border/80 shadow-lg max-w-lg mx-auto">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary mb-2">
          <Buildings className="size-6" />
        </div>
        <CardTitle className="text-xl font-bold font-heading">
          Join {invitation.organization.name}
        </CardTitle>
        <CardDescription className="text-xs">
          You have been invited to collaborate with this organization.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" className="py-2 text-xs">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Organization Info Box */}
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Organization</span>
            <span className="text-xs font-semibold text-foreground">
              {invitation.organization.name}
            </span>
          </div>

          {invitation.organization.description && (
            <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
              {invitation.organization.description}
            </p>
          )}

          {/* Leader Info */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Organization Leader</span>
            <div className="flex items-center gap-1.5">
              <Avatar className="size-5">
                <AvatarImage src={invitation.organization.leaderAvatar || undefined} />
                <AvatarFallback className="text-[9px]">
                  {invitation.organization.leaderName?.slice(0, 2).toUpperCase() || 'LD'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-foreground">
                {invitation.organization.leaderName || 'Leader'}
              </span>
            </div>
          </div>

          {/* Invited Role */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Assigned Role</span>
            <Badge
              variant="outline"
              className={
                invitation.role === 'co_leader'
                  ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 font-semibold text-xs'
                  : 'border-primary/30 bg-primary/10 text-primary font-semibold text-xs'
              }
            >
              <ShieldCheck className="size-3 mr-1" />
              {roleLabel}
            </Badge>
          </div>
        </div>

        {/* Currently Logged-in Account Banner */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="size-8 shrink-0 border border-primary/20">
              <AvatarImage src={currentUser.avatarUrl || undefined} />
              <AvatarFallback className="text-xs font-semibold">
                {currentUser.name?.slice(0, 2).toUpperCase() || 'ME'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-muted-foreground font-medium">
                Signed in as
              </span>
              <span className="text-xs font-semibold text-foreground truncate">
                {currentUser.name || 'Current User'}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {currentUser.email}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
            Active Account
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="flex items-center gap-3 pt-2 border-t border-border/60">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDecline}
          disabled={isPending}
          className="flex-1 text-xs gap-1"
        >
          <X className="size-3.5" />
          Decline
        </Button>
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={isPending}
          className="flex-1 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Check className="size-3.5" />
          {isPending ? 'Joining...' : 'Accept Invitation'}
        </Button>
      </CardFooter>
    </Card>
  )
}
