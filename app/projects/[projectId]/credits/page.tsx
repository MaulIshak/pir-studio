import { notFound } from 'next/navigation'
import { getProjectById } from '@/actions/projects'
import { getCreditsByProjectId } from '@/actions/credits'
import { getAssetsByProjectId } from '@/actions/assets'
import { CreateCreditDialog } from '@/components/credits/create-credit-dialog'
import { ExportCreditsButton } from '@/components/credits/export-credits-button'
import { CreditTable } from '@/components/credits/credit-table'

interface CreditsPageProps {
  params: Promise<{ projectId: string }>
}

export default async function CreditsPage({ params }: CreditsPageProps) {
  const { projectId } = await params
  const project = await getProjectById(projectId)

  if (!project) {
    notFound()
  }

  const [credits, assets] = await Promise.all([
    getCreditsByProjectId(projectId),
    getAssetsByProjectId(projectId),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight">Credits</h2>
          <p className="text-sm text-muted-foreground">
            Manage third-party licenses, attributions, and export distribution records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportCreditsButton projectId={projectId} hasCredits={credits.length > 0} />
          <CreateCreditDialog projectId={projectId} assets={assets} />
        </div>
      </div>

      <CreditTable credits={credits} projectId={projectId} assets={assets} />
    </div>
  )
}
