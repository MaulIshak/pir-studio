import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationBySlug } from '@/actions/organizations'
import { getUserOrgRole } from '@/lib/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrgNav } from '@/components/organizations/org-nav'
import { Buildings, Plus, CaretLeft } from '@phosphor-icons/react/dist/ssr'

interface OrgLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const org = await getOrganizationBySlug(slug)
  if (!org) {
    notFound()
  }

  const userRole = await getUserOrgRole(org.id, user.id)
  if (!userRole) {
    redirect('/')
  }

  const isLeader = userRole === 'leader'
  const isCoLeader = userRole === 'co_leader'
  const canManage = isLeader || isCoLeader

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 sm:gap-6 px-3.5 py-4 sm:p-6">
      {/* Top Organization Header */}
      <div className="flex flex-col justify-between gap-4 border-b pb-4 sm:pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="xs"
              nativeButton={false}
              render={<Link href="/" />}
            >
              <CaretLeft className="size-3" />
              Dashboard
            </Button>
            <Badge
              variant="outline"
              className={
                isLeader
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px] capitalize'
                  : isCoLeader
                  ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px] capitalize'
                  : 'border-muted-foreground/30 bg-muted/40 text-muted-foreground text-[10px] capitalize'
              }
            >
              {userRole === 'co_leader' ? 'Co-Leader' : userRole}
            </Badge>
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Buildings className="size-4.5" />
            </div>
            <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl truncate">
              {org.name}
            </h1>
          </div>
          {org.description && (
            <p className="text-xs text-muted-foreground max-w-2xl">{org.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <Button
              nativeButton={false}
              render={<Link href="/projects/new" />}
              size="sm"
              className="gap-1 text-xs"
            >
              <Plus className="size-3.5" />
              <span>New Project</span>
            </Button>
          )}
        </div>
      </div>

      {/* Organization Navigation Tabs */}
      <OrgNav orgSlug={org.slug} canManage={canManage} />

      {/* Page Content */}
      <div>{children}</div>
    </div>
  )
}
