import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationBySlug } from '@/actions/organizations'
import { getUserOrgRole } from '@/lib/auth/permissions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProjectListClient } from '@/components/projects/project-list-client'
import {
  Users,
  GameController,
  Kanban,
  Flag,
  ArrowRight,
} from '@phosphor-icons/react/dist/ssr'

interface OrgPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function OrganizationDashboardPage({ params }: OrgPageProps) {
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

  // Fetch projects in this org
  let projectQuery = supabase
    .from('projects')
    .select('*, tasks(id, status)')
    .eq('organization_id', org.id)
    .order('deadline', { ascending: true, nullsFirst: false })

  if (userRole === 'member') {
    const { data: assigned } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const allowedIds = assigned?.map((a) => a.project_id) ?? []
    projectQuery = projectQuery.in('id', allowedIds.length > 0 ? allowedIds : ['00000000-0000-0000-0000-000000000000'])
  }

  const [{ data: projects }, { count: memberCount }, { count: milestoneCount }] = await Promise.all([
    projectQuery,
    supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
    supabase
      .from('organization_milestones')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
  ])

  const allProjects = projects ?? []
  const activeProjects = allProjects.filter((p) => p.status === 'active')
  const completedProjects = allProjects.filter((p) => p.status === 'completed')

  // Total active tasks
  const activeTasksCount = allProjects.reduce((acc, p) => {
    const taskList = (p.tasks as Array<{ status: string }>) ?? []
    return acc + taskList.filter((t) => t.status !== 'done').length
  }, 0)

  const isLeader = userRole === 'leader'
  const isCoLeader = userRole === 'co_leader'
  const canManage = isLeader || isCoLeader

  return (
    <div className="flex flex-col gap-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="border-border/80 bg-card transition-colors hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Projects</CardTitle>
            <div className="flex size-7 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
              <GameController className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold tracking-tight text-foreground">{allProjects.length}</div>
            <p className="text-[11px] text-muted-foreground pt-1">{activeProjects.length} active</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card transition-colors hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Milestones</CardTitle>
            <div className="flex size-7 items-center justify-center border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Flag className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold tracking-tight text-foreground">{milestoneCount ?? 0}</div>
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Roadmap targets</span>
              <Link
                href={`/orgs/${org.slug}/milestones`}
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
              >
                <span>View</span>
                <ArrowRight className="size-2.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card transition-colors hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Team Size</CardTitle>
            <div className="flex size-7 items-center justify-center border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Users className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold tracking-tight text-foreground">{memberCount ?? 0}</div>
            <p className="text-[11px] text-muted-foreground pt-1">Active members</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card transition-colors hover:border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Active Tasks</CardTitle>
            <div className="flex size-7 items-center justify-center border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Kanban className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold tracking-tight text-foreground">{activeTasksCount}</div>
            <p className="text-[11px] text-muted-foreground pt-1">{completedProjects.length} shipped projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Projects</h2>
        </div>
        <ProjectListClient initialProjects={allProjects} canCreateProject={canManage} />
      </div>
    </div>
  )
}
