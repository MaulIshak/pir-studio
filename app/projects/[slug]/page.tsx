import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProjectBySlug } from '@/actions/projects'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProjectCharts } from '@/components/projects/project-charts'
import {
  Kanban,
  Flag,
  Package,
  Certificate,
  Link as LinkIcon,
  ArrowRight,
  CalendarBlank,
  ClockCountdown,
  CheckCircle,
} from '@phosphor-icons/react/dist/ssr'

interface ProjectPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectOverviewPage({ params }: ProjectPageProps) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) {
    notFound()
  }

  const totalTasks = project.tasks?.length || 0
  const doneTasks = project.tasks?.filter((t: { status: string }) => t.status === 'done').length || 0
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const totalMilestones = project.milestones?.length || 0
  const doneMilestones = project.milestones?.filter((m: { status: string }) => m.status === 'done').length || 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  type MilestoneRow = {
    id: string
    title: string
    start_date?: string | null
    due_date?: string | null
    status: string
  }

  const milestonesList: MilestoneRow[] = (project.milestones as MilestoneRow[]) ?? []
  const activeMilestones = milestonesList.filter((m) => {
    if (m.status === 'done') return false
    if (m.start_date && m.due_date) {
      return todayStr >= m.start_date && todayStr <= m.due_date
    }
    if (m.start_date && !m.due_date) {
      return todayStr >= m.start_date
    }
    if (!m.start_date && m.due_date) {
      return todayStr <= m.due_date && m.status === 'in_progress'
    }
    return m.status === 'in_progress'
  })

  const upcomingMilestone = milestonesList
    .filter((m) => m.status !== 'done' && (m.due_date ? m.due_date >= todayStr : true))
    .sort((a, b) => {
      const aDate = a.start_date || a.due_date || '9999'
      const bDate = b.start_date || b.due_date || '9999'
      return aDate.localeCompare(bDate)
    })[0]

  const totalAssets = project.assets?.length || 0
  const readyAssets = project.assets?.filter((a: { status: string }) => a.status === 'implemented' || a.status === 'done').length || 0

  const totalCredits = project.credits?.length || 0
  const totalArtifacts = project.artifact_links?.length || 0

  return (
    <div className="flex flex-col gap-6">
      {project.description && (
        <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p>
      )}

      {/* Metric Cards with Meaningful Icons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Start Date */}
        <Card className="transition-all duration-200 hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Start Date</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CalendarBlank className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm font-semibold text-foreground">
              {project.start_date || 'Not set'}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Deadline */}
        <Card className="transition-all duration-200 hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Deadline</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <ClockCountdown className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm font-semibold text-foreground">
              {project.deadline || 'No deadline'}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Tasks Completed */}
        <Card className="transition-all duration-200 hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Tasks Shipped</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm font-semibold text-foreground">
              {doneTasks} of {totalTasks} <span className="text-xs font-normal text-muted-foreground">({progressPercent}%)</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Current Active Milestone(s) */}
        <Card className="transition-all duration-200 hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Current Milestone</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Flag className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            {activeMilestones.length === 1 ? (
              <div className="flex flex-col">
                <span className="truncate text-sm font-semibold text-foreground" title={activeMilestones[0].title}>
                  {activeMilestones[0].title}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {activeMilestones[0].due_date ? `Due ${activeMilestones[0].due_date.slice(5)}` : 'In progress'}
                </span>
              </div>
            ) : activeMilestones.length > 1 ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-sm font-semibold text-foreground" title={activeMilestones.map((m) => m.title).join(', ')}>
                    {activeMilestones[0].title}
                  </span>
                  <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.2 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    +{activeMilestones.length - 1}
                  </span>
                </div>
                <span className="truncate text-[11px] text-muted-foreground" title={activeMilestones.map((m) => m.title).join(', ')}>
                  {activeMilestones.slice(1).map((m) => m.title).join(', ')}
                </span>
              </div>
            ) : upcomingMilestone ? (
              <div className="flex flex-col">
                <span className="truncate text-xs font-medium text-foreground" title={upcomingMilestone.title}>
                  Next: {upcomingMilestone.title}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {upcomingMilestone.due_date ? `Due ${upcomingMilestone.due_date.slice(5)}` : 'Upcoming target'}
                </span>
              </div>
            ) : totalMilestones > 0 && doneMilestones === totalMilestones ? (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  All Completed
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {totalMilestones} targets reached
                </span>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">
                  None Active
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {totalMilestones} defined
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards (Positioned above charts) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Card 1: Task Kanban */}
        <Card className="flex flex-col justify-between sm:col-span-1 lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Kanban className="size-4" />
              </div>
              <CardTitle className="text-base">Task Kanban</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall Progress</span>
                <span className="font-mono font-medium text-foreground">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>{doneTasks} of {totalTasks} tasks completed</span>
              <Button
                variant="default"
                size="sm"
                nativeButton={false}
                render={<Link href={`/projects/${project.slug}/tasks`} />}
              >
                Open Kanban
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Milestones */}
        <Card className="flex flex-col justify-between sm:col-span-1 lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Flag className="size-4" />
              </div>
              <CardTitle className="text-base">Milestones</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">
                {totalMilestones} milestone target{totalMilestones === 1 ? '' : 's'} tracked for this project build.
              </p>
              {activeMilestones.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Current:</span>
                  <span className="font-medium text-foreground truncate">
                    {activeMilestones.map((m) => m.title).join(', ')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>{doneMilestones} of {totalMilestones} completed</span>
              <Button
                variant="default"
                size="sm"
                nativeButton={false}
                render={<Link href={`/projects/${project.slug}/milestones`} />}
              >
                View Milestones
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Assets */}
        <Card className="flex flex-col justify-between sm:col-span-1 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Package className="size-4" />
              </div>
              <CardTitle className="text-base">Assets</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {totalAssets} production asset{totalAssets === 1 ? '' : 's'} across 2D, 3D, and audio.
            </p>
            <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>{readyAssets} of {totalAssets} ready</span>
              <Button
                variant="default"
                size="sm"
                nativeButton={false}
                render={<Link href={`/projects/${project.slug}/assets`} />}
              >
                Open Assets
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Credits */}
        <Card className="flex flex-col justify-between sm:col-span-1 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Certificate className="size-4" />
              </div>
              <CardTitle className="text-base">Credits</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {totalCredits} attribution record{totalCredits === 1 ? '' : 's'} for third-party licenses.
            </p>
            <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>{totalCredits} entries logged</span>
              <Button
                variant="default"
                size="sm"
                nativeButton={false}
                render={<Link href={`/projects/${project.slug}/credits`} />}
              >
                View Credits
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Artifacts */}
        <Card className="flex flex-col justify-between sm:col-span-2 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <LinkIcon className="size-4" />
              </div>
              <CardTitle className="text-base">Artifacts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {totalArtifacts} external resource{totalArtifacts === 1 ? '' : 's'} including GDD, Figma, and builds.
            </p>
            <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>{totalArtifacts} links recorded</span>
              <Button
                variant="default"
                size="sm"
                nativeButton={false}
                render={<Link href={`/projects/${project.slug}/artifacts`} />}
              >
                View Artifacts
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Charts: Status Distribution & Daily/Weekly Completion */}
      <ProjectCharts tasks={project.tasks ?? []} />
    </div>
  )
}
