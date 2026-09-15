import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getProjectBySlug, getProjectById } from '@/actions/projects'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RetryDriveButton } from '@/components/projects/retry-drive-button'
import { EditProjectDialog } from '@/components/projects/edit-project-dialog'
import { CaretLeft, Folder } from '@phosphor-icons/react/dist/ssr'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { slug } = await params
  let project = await getProjectBySlug(slug)

  // Backward-compatibility: If param is a UUID, attempt to resolve by ID and redirect to canonical slug URL
  if (!project && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
    project = await getProjectById(slug)
    if (project?.slug) {
      redirect(`/projects/${project.slug}`)
    }
  }

  if (!project) {
    notFound()
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              nativeButton={false}
              render={<Link href="/projects" />}
            >
              <CaretLeft className="size-3" />
              Projects
            </Button>
            {project.type === 'jam' ? (
              <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 capitalize">
                Jam
              </Badge>
            ) : project.type === 'competition' ? (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 capitalize">
                Competition
              </Badge>
            ) : (
              <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 capitalize">
                Internal
              </Badge>
            )}
            {project.status === 'active' ? (
              <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium capitalize">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </Badge>
            ) : project.status === 'completed' ? (
              <Badge variant="outline" className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium capitalize">
                <span className="size-1.5 rounded-full bg-blue-500" />
                Completed
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400 font-medium capitalize">
                <span className="size-1.5 rounded-full bg-slate-400" />
                Archived
              </Badge>
            )}
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {project.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <EditProjectDialog project={project} />
          {project.drive_folder_id ? (
            <Button
              variant="outline"
              size="sm"
              className="bg-card text-foreground hover:bg-accent"
              nativeButton={false}
              render={
                <a
                  href={`https://drive.google.com/drive/folders/${project.drive_folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Folder className="size-3.5 text-primary" />
              Open Drive
            </Button>
          ) : (
            <RetryDriveButton projectId={project.id} />
          )}
        </div>
      </div>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  )
}
