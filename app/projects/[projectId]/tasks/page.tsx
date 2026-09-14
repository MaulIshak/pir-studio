import { getTasksByProjectId } from '@/actions/tasks'
import { getMilestonesByProjectId } from '@/actions/milestones'
import { KanbanBoard } from '@/components/tasks/kanban-board'

import { TaskItem } from '@/components/tasks/task-card'

interface TasksPageProps {
  params: Promise<{ projectId: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectTasksPage({ params }: TasksPageProps) {
  const { projectId } = await params
  const [tasks, milestones] = await Promise.all([
    getTasksByProjectId(projectId),
    getMilestonesByProjectId(projectId),
  ])

  return (
    <div className="flex flex-col gap-6">
      <KanbanBoard
        projectId={projectId}
        initialTasks={tasks as unknown as TaskItem[]}
        milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
      />
    </div>
  )
}
