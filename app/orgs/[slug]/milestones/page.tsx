import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationBySlug, getOrganizationMembers } from '@/actions/organizations'
import { getOrgMilestones, checkOrgMilestonesMigrationStatus } from '@/actions/org-milestones'
import { getUserOrgRole } from '@/lib/auth/permissions'
import { OrgMilestoneList } from '@/components/organizations/org-milestone-list'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { WarningCircle } from '@phosphor-icons/react/dist/ssr'

interface OrgMilestonesPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function OrgMilestonesPage({ params }: OrgMilestonesPageProps) {
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

  const canManage = userRole === 'leader' || userRole === 'co_leader'

  const [milestones, { data: projectsData }, rawMembers, isMigrationApplied] = await Promise.all([
    getOrgMilestones(org.id),
    supabase
      .from('projects')
      .select('id, name, slug, status')
      .eq('organization_id', org.id)
      .order('name', { ascending: true }),
    getOrganizationMembers(org.id),
    checkOrgMilestonesMigrationStatus(),
  ])

  const projects = projectsData ?? []
  const members = rawMembers.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatarUrl,
    role: m.role,
  }))

  return (
    <div className="flex flex-col gap-6">
      {!isMigrationApplied && (
        <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-500 rounded-md">
          <WarningCircle className="size-4 shrink-0" />
          <div className="space-y-1">
            <AlertTitle className="text-xs font-semibold text-amber-500">
              Database Migration Pending
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              To enable organization roadmap milestones and member-level timeline access, please execute the SQL script in{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                supabase/migrations/20261104000000_add_organization_milestones.sql
              </code>{' '}
              inside your Supabase Dashboard SQL Editor.
            </AlertDescription>
          </div>
        </Alert>
      )}

      <OrgMilestoneList
        organizationId={org.id}
        orgSlug={org.slug}
        initialMilestones={milestones}
        projects={projects}
        members={members}
        canManage={canManage}
      />
    </div>
  )
}
