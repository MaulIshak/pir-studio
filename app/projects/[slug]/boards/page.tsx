import { notFound, redirect } from 'next/navigation'
import { getProjectBySlug } from '@/actions/projects'
import { getBoardsByProjectId, getBoardTemplates } from '@/actions/boards'
import { getCurrentUser, hasProjectAccess } from '@/lib/auth/permissions'
import { BoardListClient } from '@/components/whiteboards/board-list-client'

interface ProjectBoardsPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectBoardsPage({ params }: ProjectBoardsPageProps) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) {
    notFound()
  }

  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const access = await hasProjectAccess(project.id, user.id)
  if (!access.hasAccess || !access.organizationId) {
    redirect('/')
  }

  const canManage = access.role === 'leader' || access.role === 'co_leader'

  const [boards, templates] = await Promise.all([
    getBoardsByProjectId(project.id),
    getBoardTemplates(access.organizationId),
  ])

  return (
    <BoardListClient
      projectId={project.id}
      projectSlug={project.slug}
      initialBoards={boards}
      initialTemplates={templates}
      canManage={canManage}
    />
  )
}

