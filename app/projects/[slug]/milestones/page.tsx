import { notFound } from 'next/navigation'
import { getMilestonesByProjectId } from '@/actions/milestones'
import { getProjectBySlug } from '@/actions/projects'
import { MilestoneList, type MilestoneItem } from '@/components/milestones/milestone-list'

interface MilestonesPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectMilestonesPage({ params }: MilestonesPageProps) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) {
    notFound()
  }

  const milestones = await getMilestonesByProjectId(project.id)

  return (
    <div className="flex flex-col gap-6">
      <MilestoneList
        projectId={project.id}
        projectSlug={project.slug}
        initialMilestones={milestones as unknown as MilestoneItem[]}
        projectStartDate={project.start_date}
        projectDeadline={project.deadline}
      />
    </div>
  )
}
