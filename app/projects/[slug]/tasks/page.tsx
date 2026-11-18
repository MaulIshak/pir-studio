import { notFound } from 'next/navigation'
import { getProjectBySlug, getProjectMembers } from '@/actions/projects'
import { getTasksByProjectId } from '@/actions/tasks'
import { getMilestonesByProjectId } from '@/actions/milestones'
import { getCurrentUser, hasProjectAccess } from '@/lib/auth/permissions'
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

  const [tasks, milestones, projectMembers, currentUser] = await Promise.all([
    getTasksByProjectId(project.id),
    getMilestonesByProjectId(project.id),
    getProjectMembers(project.id),
    getCurrentUser(),
  ])

  const access = currentUser ? await hasProjectAccess(project.id, currentUser.id) : null

  const profiles: ProfileItem[] = projectMembers.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
    avatar_url: m.avatarUrl,
    role: m.role,
  }))

  const defaultAssigneeId =
    currentUser &&
    access?.role &&
    access.role !== 'leader' &&
    profiles.some((p) => p.id === currentUser.id)
      ? currentUser.id
      : 'all'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Tasks</h2>
        <p className="text-xs text-muted-foreground">
          Track workflow stages, assignees, and subtasks across this build.
        </p>
      </div>

      <KanbanBoard
        projectId={project.id}
        initialTasks={tasks as unknown as TaskItem[]}
        milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
        profiles={profiles}
        defaultAssigneeId={defaultAssigneeId}
      />
    </div>
  )
}

