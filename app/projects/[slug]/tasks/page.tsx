import { notFound } from 'next/navigation'
import { getProjectBySlug, getProjectMembers } from '@/actions/projects'
import { getTasksByProjectId } from '@/actions/tasks'
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

  const [tasks, milestones, projectMembers] = await Promise.all([
    getTasksByProjectId(project.id),
    getMilestonesByProjectId(project.id),
    getProjectMembers(project.id),
  ])

  const profiles: ProfileItem[] = projectMembers.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
    avatar_url: m.avatarUrl,
    role: m.role,
  }))

  return (
    <div className="flex flex-col gap-6">
      <KanbanBoard
        projectId={project.id}
        initialTasks={tasks as unknown as TaskItem[]}
        milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
        profiles={profiles}
      />
    </div>
  )
}

