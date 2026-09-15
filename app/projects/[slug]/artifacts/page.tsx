import { notFound } from 'next/navigation'
import { getProjectById } from '@/actions/projects'
import { getArtifactLinksByProjectId } from '@/actions/artifacts'
import { CreateArtifactDialog } from '@/components/artifacts/create-artifact-dialog'
import { UploadArtifactDialog } from '@/components/artifacts/upload-artifact-dialog'
import { ArtifactList } from '@/components/artifacts/artifact-list'

interface ArtifactsPageProps {
  params: Promise<{ projectId: string }>
}

export default async function ArtifactsPage({ params }: ArtifactsPageProps) {
  const { projectId } = await params
  const project = await getProjectById(projectId)

  if (!project) {
    notFound()
  }

  const artifacts = await getArtifactLinksByProjectId(projectId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">Artifacts</h2>
          <p className="text-sm text-muted-foreground">
            Centralized access to design files, playable builds, and game documentation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <UploadArtifactDialog projectId={projectId} />
          <CreateArtifactDialog projectId={projectId} />
        </div>
      </div>

      <ArtifactList artifacts={artifacts} projectId={projectId} />
    </div>
  )
}
