'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createOrganization } from '@/actions/organizations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash, Buildings, UserPlus } from '@phosphor-icons/react'

interface InvitationRow {
  email: string
  role: 'co_leader' | 'member'
}

export function CreateOrgForm() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleAddInvitation = () => {
    setInvitations((prev) => [...prev, { email: '', role: 'member' }])
  }

  const handleRemoveInvitation = (index: number) => {
    setInvitations((prev) => prev.filter((_, i) => i !== index))
  }

  const handleInvitationChange = (
    index: number,
    field: 'email' | 'role',
    value: string
  ) => {
    setInvitations((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Organization name is required')
      return
    }

    setError(null)
    startTransition(async () => {
      const validInvitations = invitations
        .map((inv) => ({ email: inv.email.trim(), role: inv.role }))
        .filter((inv) => inv.email.length > 0)

      const res = await createOrganization({
        name: name.trim(),
        description: description.trim() || null,
        invitations: validInvitations.length > 0 ? validInvitations : undefined,
      })

      if (res.error) {
        setError(res.error)
      } else if (res.organization) {
        router.push(`/orgs/${res.organization.slug}`)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-border/80 shadow-md">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Buildings className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">New Organization</CardTitle>
              <CardDescription className="text-xs">
                You will automatically become the Leader of this organization.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Organization Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pir Berkacamata"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description (Optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the studio or team..."
              rows={2}
              disabled={isPending}
            />
          </div>

          <div className="pt-2 border-t border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <UserPlus className="size-3.5 text-primary" />
                  Invite Members
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Send invitations now, or invite team members later from settings.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleAddInvitation}
                disabled={isPending}
                className="gap-1 text-xs"
              >
                <Plus className="size-3" />
                Add Member
              </Button>
            </div>

            {invitations.length > 0 && (
              <div className="space-y-2 pt-1">
                {invitations.map((inv, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="teammate@example.com"
                      value={inv.email}
                      onChange={(e) => handleInvitationChange(idx, 'email', e.target.value)}
                      disabled={isPending}
                      className="h-8 text-xs flex-1"
                    />
                    <Select
                      value={inv.role}
                      onValueChange={(val) => {
                        if (val) handleInvitationChange(idx, 'role', val)
                      }}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="co_leader">Co-Leader</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveInvitation(idx)}
                      disabled={isPending}
                      className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            disabled={isPending}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending} className="text-xs">
            {isPending ? 'Creating...' : 'Create Organization'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
