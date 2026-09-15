import { notFound } from 'next/navigation'
import { getProjectBySlug } from '@/actions/projects'
import { getTasksByProjectId, getProfiles } from '@/actions/tasks'
import { getMilestonesByProjectId } from '@/actions/milestones'
import { KanbanBoard } from '@/components/tasks/kanban-board'
import { TaskItem, ProfileItem } from '@/components/tasks/task-card'

interface TasksPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectTasksPage({ params }: TasksPageProps) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) {
    notFound()
  }

  const [tasks, milestones, profiles] = await Promise.all([
    getTasksByProjectId(project.id),
    getMilestonesByProjectId(project.id),
    getProfiles(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <KanbanBoard
        projectId={project.id}
        initialTasks={tasks as unknown as TaskItem[]}
        milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
        profiles={profiles as unknown as ProfileItem[]}
      />
    </div>
  )
}

