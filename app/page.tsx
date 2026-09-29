import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrganization } from '@/lib/auth/active-org'
import { getProjects } from '@/actions/projects'
import { getMyTasks } from '@/actions/tasks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProjectListClient } from '@/components/projects/project-list-client'
import { MyTasksSection } from '@/components/dashboard/my-tasks-section'
import {
  Plus,
  GameController,
  ClockCountdown,
  CheckCircle,
  Kanban,
  Buildings,
  ArrowRight,
} from '@phosphor-icons/react/dist/ssr'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [activeOrg, activeProjects, completedProjects, archivedProjects, myTasks] = await Promise.all([
    getActiveOrganization(),
    getProjects('active'),
    getProjects('completed'),
    getProjects('archived'),
    getMyTasks(),
  ])

  const allAccessibleProjects = [...activeProjects, ...completedProjects, ...archivedProjects]
  const incompleteTasks = myTasks.filter((t) => t.status !== 'done')
  const completedTasks = myTasks.filter((t) => t.status === 'done')

  // Calculate tasks due soon (< 3 days)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const urgentTasksCount = incompleteTasks.filter((t) => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    d.setHours(0, 0, 0, 0)
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 3
  }).length

  const isLeader = activeOrg?.role === 'leader'
  const isCoLeader = activeOrg?.role === 'co_leader'
  const canCreateProject = isLeader || isCoLeader

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8 px-3.5 py-4 sm:p-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b pb-4 sm:pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-bold tracking-tight sm:text-3xl">
              Hello, {userName}
            </h1>
            {activeOrg && (
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
                {activeOrg.role === 'co_leader' ? 'Co-Leader' : activeOrg.role}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {activeOrg ? (
              <>
                <Buildings className="size-3.5 text-primary shrink-0" />
                <span>Working in <strong>{activeOrg.name}</strong></span>
              </>
            ) : (
              'Personal gamedev hub for tasks, milestones, and projects.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeOrg && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/orgs/${activeOrg.slug}`} />}
              className="gap-1.5 text-xs"
            >
              <Buildings className="size-3.5 text-primary" />
              <span>Org Overview</span>
            </Button>
          )}

          {canCreateProject && (
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="border-border/80 bg-card transition-all duration-200 hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">My Tasks</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Kanban className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-foreground">{incompleteTasks.length}</div>
            <p className="text-[11px] text-muted-foreground pt-1">Incomplete assigned</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/25 bg-destructive/5 transition-all duration-200 hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Due Soon</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-destructive/15 text-destructive">
              <ClockCountdown className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-destructive">
              {urgentTasksCount}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">Deadlines in &le; 3 days</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card transition-all duration-200 hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">My Projects</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
              <GameController className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-foreground">{activeProjects.length}</div>
            <p className="text-[11px] text-muted-foreground pt-1">Active accessible</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/25 bg-emerald-500/5 transition-all duration-200 hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Completed</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-500">
              <CheckCircle className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-emerald-500">{completedTasks.length}</div>
            <p className="text-[11px] text-muted-foreground pt-1">Tasks completed by you</p>
          </CardContent>
        </Card>
      </div>

      {/* Personal Tasks Section with Quick Actions */}
      <MyTasksSection initialTasks={myTasks} />

      {/* Projects List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Accessible Projects</h2>
          {activeOrg && (
            <Link
              href={`/orgs/${activeOrg.slug}`}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span>View Org Projects</span>
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
        <ProjectListClient
          initialProjects={allAccessibleProjects}
          canCreateProject={canCreateProject}
        />
      </div>
    </div>
  )
}
