import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/actions/projects'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Kanban, Flag, ArrowRight } from '@phosphor-icons/react/dist/ssr'

interface ProjectPageProps {
  params: Promise<{ projectId: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectOverviewPage({ params }: ProjectPageProps) {
  const { projectId } = await params
  const project = await getProjectById(projectId)

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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm">{project.start_date || 'None'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Deadline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm">{project.deadline || 'None'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Drive Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm">
              {project.drive_folder_id ? 'Provisioned' : 'Pending'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress & Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Kanban className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Task Kanban</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Overall Progress</span>
              <span className="font-mono">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{doneTasks} of {totalTasks} tasks completed</span>
              <Button
                variant="ghost"
                size="xs"
                nativeButton={false}
                render={<Link href={`/projects/${projectId}/tasks`} />}
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
              <Flag className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Milestones</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              {project.milestones?.length || 0} milestones tracked under this project.
            </p>
            <div className="flex items-center justify-end pt-4">
              <Button
                variant="ghost"
                size="xs"
                nativeButton={false}
                render={<Link href={`/projects/${projectId}/milestones`} />}
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
