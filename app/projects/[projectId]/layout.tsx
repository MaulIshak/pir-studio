import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/actions/projects'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RetryDriveButton } from '@/components/projects/retry-drive-button'
import { EditProjectDialog } from '@/components/projects/edit-project-dialog'
import { ProjectNav } from '@/components/projects/project-nav'
import { CaretLeft, Folder } from '@phosphor-icons/react/dist/ssr'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = await params
  const project = await getProjectById(projectId)

  if (!project) {
    notFound()
  }

  const typeLabel = project.type.charAt(0).toUpperCase() + project.type.slice(1)

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
            <Badge variant="secondary">{typeLabel}</Badge>
            <Badge variant="outline" className="capitalize">
              {project.status}
            </Badge>
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
              nativeButton={false}
              render={
                <a
                  href={`https://drive.google.com/drive/folders/${project.drive_folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Folder className="size-3.5" />
              Drive Folder
            </Button>
          ) : (
            <RetryDriveButton projectId={project.id} />
          )}
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <ProjectNav projectId={projectId} />

      {/* Page Content */}
      <div>{children}</div>
    </div>
  )
}
