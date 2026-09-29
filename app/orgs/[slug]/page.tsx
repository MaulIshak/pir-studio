import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationBySlug } from '@/actions/organizations'
import { getUserOrgRole } from '@/lib/auth/permissions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProjectListClient } from '@/components/projects/project-list-client'
import {
  Buildings,
  Plus,
  Users,
  GameController,
  CheckCircle,
  Kanban,
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

  const [{ data: projects }, { count: memberCount }] = await Promise.all([
    projectQuery,
    supabase
      .from('organization_members')
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8 px-3.5 py-4 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b pb-4 sm:pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Buildings className="size-4" />
            </div>
            <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl truncate">
              {org.name}
            </h1>
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
          <p className="text-xs text-muted-foreground">
            {org.description || 'Organization dashboard and project management.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/orgs/${org.slug}/members`} />}
                className="gap-1.5 text-xs"
              >
                <Users className="size-3.5 text-primary" />
                <span>Members ({memberCount ?? 0})</span>
              </Button>

              <Button
                nativeButton={false}
                render={<Link href="/projects/new" />}
                size="sm"
                className="gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                <span>New Project</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Projects</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <GameController className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-foreground">{allProjects.length}</div>
            <p className="text-[11px] text-muted-foreground pt-1">{activeProjects.length} active</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Team Size</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
              <Users className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-foreground">{memberCount ?? 0}</div>
            <p className="text-[11px] text-muted-foreground pt-1">Members joined</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Active Tasks</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
              <Kanban className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-foreground">{activeTasksCount}</div>
            <p className="text-[11px] text-muted-foreground pt-1">Across all projects</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Completed</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <CheckCircle className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-emerald-500">{completedProjects.length}</div>
            <p className="text-[11px] text-muted-foreground pt-1">Shipped games & jams</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Projects</h2>
          {canManage && (
            <Button
              nativeButton={false}
              render={<Link href="/projects/new" />}
              size="xs"
              variant="outline"
              className="gap-1 text-xs"
            >
              <Plus className="size-3" />
              <span>Create Project</span>
            </Button>
          )}
        </div>
        <ProjectListClient initialProjects={allProjects} canCreateProject={canManage} />
      </div>
    </div>
  )
}
