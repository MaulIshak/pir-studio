'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfileName } from '@/actions/profile'
import { notifyProfileChanged } from '@/lib/events'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Check, CircleNotch, User, LockSimple } from '@phosphor-icons/react'

interface ProfileFormProps {
  initialProfile: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    createdAt: string
  }
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [name, setName] = useState(initialProfile.name)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const res = await updateProfileName(name.trim())
      if (res.error) {
        setError(res.error)
      } else if (res.success && res.name) {
        setSuccess('Profile updated successfully')
        notifyProfileChanged(res.name)
        router.refresh()
        setTimeout(() => setSuccess(null), 3000)
      }
    })
  }

  const hasChanged = name.trim() !== initialProfile.name.trim()

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Personal Details</CardTitle>
            <CardDescription className="text-xs">
              Update your display name visible across projects and tasks.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10 py-2 text-xs text-emerald-500">
              <AlertDescription className="flex items-center gap-1.5">
                <Check className="size-3.5" />
                <span>{success}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Avatar and Info Row */}
          <div className="flex items-center gap-3.5 rounded-lg border border-border/60 bg-muted/20 p-3">
            <Avatar className="size-12 border border-border">
              {initialProfile.avatarUrl && (
                <AvatarImage src={initialProfile.avatarUrl} alt={name || 'User'} />
              )}
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {(name || 'U').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate">
                {name || 'User'}
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                {initialProfile.email}
              </span>
              <span className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">
                Member since {new Date(initialProfile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-1.5">
            <label htmlFor="displayName" className="text-xs font-medium text-foreground">
              Display Name
            </label>
            <Input
              id="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              disabled={isPending}
              maxLength={60}
              className="text-xs"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              This name is shown on task assignments, milestone updates, and organization rosters.
            </p>
          </div>

          {/* Email Field (Read Only) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="userEmail" className="text-xs font-medium text-foreground">
                Email Address
              </label>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 gap-1">
                <LockSimple className="size-2.5" />
                <span>Verified</span>
              </Badge>
            </div>
            <Input
              id="userEmail"
              value={initialProfile.email}
              readOnly
              disabled
              className="text-xs bg-muted/40 cursor-not-allowed text-muted-foreground"
            />
            <p className="text-[10px] text-muted-foreground">
              Your email is linked to your Google account and cannot be modified directly.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-end border-t border-border/60 pt-4">
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !hasChanged || !name.trim()}
            className="text-xs gap-1.5"
          >
            {isPending ? (
              <>
                <CircleNotch className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
