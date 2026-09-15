import { notFound } from 'next/navigation'
import { getProjectById } from '@/actions/projects'
import { getAssetsByProjectId, checkAssetsMigrationStatus } from '@/actions/assets'
import { getTasksByProjectId } from '@/actions/tasks'
import { CreateAssetDialog } from '@/components/assets/create-asset-dialog'
import { UploadBundleDialog } from '@/components/assets/upload-bundle-dialog'
import { AssetTable } from '@/components/assets/asset-table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { WarningCircle } from '@phosphor-icons/react/dist/ssr'

interface AssetsPageProps {
  params: Promise<{ projectId: string }>
}

export default async function AssetsPage({ params }: AssetsPageProps) {
  const { projectId } = await params
  const project = await getProjectById(projectId)

  if (!project) {
    notFound()
  }

  const [assets, rawTasks, isMigrationApplied] = await Promise.all([
    getAssetsByProjectId(projectId),
    getTasksByProjectId(projectId),
    checkAssetsMigrationStatus(),
  ])

  const tasks = rawTasks.map((t) => ({ id: t.id, title: t.title }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">Assets</h2>
          <p className="text-sm text-muted-foreground">
            Plan required art deliverables, attach visual references, and stream files to Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <UploadBundleDialog projectId={projectId} assets={assets} />
          <CreateAssetDialog projectId={projectId} tasks={tasks} />
        </div>
      </div>

      {!isMigrationApplied && (
        <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-500 rounded-md">
          <WarningCircle className="size-4" />
          <div>
            <AlertTitle className="text-xs font-semibold text-amber-500">
              Database Migration Pending
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              To enable task links, texture atlas bundles, and reference galleries, please execute the SQL script in{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                supabase/migrations/20260914000001_revamp_assets_feature.sql
              </code>{' '}
              inside your Supabase Dashboard SQL Editor.
            </AlertDescription>
          </div>
        </Alert>
      )}

      <AssetTable assets={assets} projectId={projectId} tasks={tasks} />
    </div>
  )
}
