import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProjectBySlug } from '@/actions/projects'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProjectCharts } from '@/components/projects/project-charts'
import {
  Kanban,
  Flag,
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

        {/* Card 4: Milestones */}
        <Card className="transition-all duration-200 hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Milestones</CardTitle>
            <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Flag className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm font-semibold text-foreground">
              {project.milestones?.length || 0} milestones
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Charts: Status Distribution & Daily/Weekly Completion */}
      <ProjectCharts tasks={project.tasks ?? []} />

      {/* Progress & Navigation Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex flex-col justify-between">
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

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Flag className="size-4" />
              </div>
              <CardTitle className="text-base">Milestones</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {project.milestones?.length || 0} milestone targets tracked for this project build.
            </p>
            <div className="flex items-center justify-end border-t pt-3">
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
      </div>
    </div>
  )
}
