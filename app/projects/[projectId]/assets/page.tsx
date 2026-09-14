import { notFound } from 'next/navigation'
import { getProjectById } from '@/actions/projects'
import { getAssetsByProjectId } from '@/actions/assets'
import { CreateAssetDialog } from '@/components/assets/create-asset-dialog'
import { AssetTable } from '@/components/assets/asset-table'

interface AssetsPageProps {
  params: Promise<{ projectId: string }>
}

export default async function AssetsPage({ params }: AssetsPageProps) {
  const { projectId } = await params
  const project = await getProjectById(projectId)

  if (!project) {
    notFound()
  }

  const assets = await getAssetsByProjectId(projectId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">Assets</h2>
          <p className="text-sm text-muted-foreground">
            Track game art, audio, and VFX with automated Google Drive storage.
          </p>
        </div>

        <CreateAssetDialog projectId={projectId} />
      </div>

      <AssetTable assets={assets} projectId={projectId} />
    </div>
  )
}
