import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/actions/profile'
import { getUserOrganizations, getActiveOrg } from '@/actions/organizations'
import { ProfileForm } from '@/components/profile/profile-form'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Buildings, ShieldCheck, HardDrives, CaretRight } from '@phosphor-icons/react/dist/ssr'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/profile')
  }

  const [profile, organizations, activeOrg] = await Promise.all([
    getUserProfile(),
    getUserOrganizations(),
    getActiveOrg(),
  ])

  if (!profile) {
    redirect('/login')
  }

  // Check Drive token status for this user
  const { data: token } = await supabase
    .from('oauth_tokens')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle()

  const hasDriveToken = !!token

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3.5 py-4 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
          Profile Settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage your personal account details, display name, and team memberships.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Column: Edit Profile Name Form */}
        <div className="lg:col-span-2">
          <ProfileForm initialProfile={profile} />
        </div>

        {/* Sidebar Column: Organizations & Integration Status */}
        <div className="flex flex-col gap-5">
          {/* Organization Memberships */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Buildings className="size-3.5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Organizations</CardTitle>
                  <CardDescription className="text-[11px]">
                    Teams you collaborate with
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {organizations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  No organization memberships found.
                </p>
              ) : (
                organizations.map((org) => {
                  const isActive = activeOrg?.id === org.id
                  return (
                    <Link
                      key={org.id}
                      href={`/orgs/${org.slug}`}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                          : 'border-border/60 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {org.name}
                          </span>
                          {isActive && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary">
                              Active
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {org.role === 'leader' ? 'Leader' : org.role === 'co_leader' ? 'Co-Leader' : 'Member'}
                        </span>
                      </div>
                      <CaretRight className="size-3 text-muted-foreground shrink-0" />
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Storage & Connected Services */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                  <HardDrives className="size-3.5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Cloud Storage</CardTitle>
                  <CardDescription className="text-[11px]">
                    Google Drive provisioning
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground">Google Drive</span>
                  <span className="text-[10px] text-muted-foreground">
                    {hasDriveToken ? 'Connected for file uploads' : 'Not connected'}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    hasDriveToken
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px]'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px]'
                  }
                >
                  <ShieldCheck className="size-3 mr-1" />
                  {hasDriveToken ? 'Active' : 'Disconnected'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
