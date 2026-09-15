import { getMilestonesByProjectId } from '@/actions/milestones'
import { getProjectById } from '@/actions/projects'
import { MilestoneList, type MilestoneItem } from '@/components/milestones/milestone-list'

interface MilestonesPageProps {
  params: Promise<{ projectId: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectMilestonesPage({ params }: MilestonesPageProps) {
  const { projectId } = await params
  const [milestones, project] = await Promise.all([
    getMilestonesByProjectId(projectId),
    getProjectById(projectId),
  ])

  return (
    <div className="flex flex-col gap-6">
      <MilestoneList
        projectId={projectId}
        initialMilestones={milestones as unknown as MilestoneItem[]}
        projectStartDate={project?.start_date}
        projectDeadline={project?.deadline}
      />
    </div>
  )
}
