import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getInvitationByToken } from '@/actions/notifications'
import { InvitationCard } from '@/components/organizations/invitation-card'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WarningCircle } from '@phosphor-icons/react/dist/ssr'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
  }

  const rawInvite = await getInvitationByToken(token)

  if (!rawInvite || rawInvite.status !== 'pending') {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center p-4">
        <Card className="w-full text-center border-border shadow-md">
          <CardHeader className="flex flex-col items-center gap-2">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <WarningCircle className="size-6" />
            </div>
            <CardTitle className="text-lg font-heading">
              Invitation Unavailable
            </CardTitle>
            <CardDescription className="text-xs">
              {rawInvite?.status === 'accepted'
                ? 'This invitation has already been accepted.'
                : rawInvite?.status === 'declined'
                ? 'This invitation was previously declined.'
                : 'This invitation link is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pt-2">
            <Button nativeButton={false} render={<Link href="/" />} size="sm" className="text-xs">
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const org = rawInvite.organizations as unknown as {
    id: string
    name: string
    slug: string
    description: string | null
    created_by: string | null
    profiles?: {
      id: string
      name: string | null
      email: string | null
      avatar_url: string | null
    }
  }

  const inviter = rawInvite.profiles as unknown as {
    id: string
    name: string | null
    email: string | null
    avatar_url: string | null
  }

  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-lg items-center justify-center p-4">
      <InvitationCard
        invitation={{
          id: rawInvite.id,
          token: rawInvite.token,
          role: rawInvite.role,
          status: rawInvite.status,
          expiresAt: rawInvite.expires_at,
          organization: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            description: org.description,
            leaderName: org.profiles?.name || null,
            leaderAvatar: org.profiles?.avatar_url || null,
            leaderEmail: org.profiles?.email || null,
          },
          inviter: {
            name: inviter?.name || null,
            email: inviter?.email || null,
            avatarUrl: inviter?.avatar_url || null,
          },
        }}
        currentUser={{
          id: user.id,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          email: user.email || null,
          avatarUrl: user.user_metadata?.avatar_url || null,
        }}
      />
    </div>
  )
}
