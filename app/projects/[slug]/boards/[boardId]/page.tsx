import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBoardAccess, getCurrentUser } from '@/lib/auth/permissions'
import { getBoardTaskLinks } from '@/actions/boards'
import { getTasksByProjectId } from '@/actions/tasks'
import { getMilestonesByProjectId } from '@/actions/milestones'
import { getProjectMembers } from '@/actions/projects'
import { WhiteboardEditorClient } from '@/components/whiteboards/whiteboard-editor-client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ProfileItem, TaskItem } from '@/components/tasks/task-card'

interface BoardEditorPageProps {
  params: Promise<{ slug: string; boardId: string }>
  searchParams: Promise<{ element?: string }>
}

export const dynamic = 'force-dynamic'

export default async function BoardEditorPage({
  params,
  searchParams,
}: BoardEditorPageProps) {
  const { slug, boardId } = await params
  const { element: highlightElementId } = await searchParams

  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const access = await getBoardAccess(boardId, user.id)
  if (!access.hasAccess || !access.board || !access.projectId || !access.projectSlug) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to open board</AlertTitle>
            <AlertDescription>
              This board does not exist or you do not have access to its project.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/projects/${slug}/boards`} />}
          >
            Back to Boards
          </Button>
        </div>
      </div>
    )
  }

  // Ensure URL slug matches board's owning project
  if (access.projectSlug !== slug) {
    notFound()
  }

  const supabase = await createClient()
  const [{ data: profile }, tasks, links, milestones, projectMembers] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
    getTasksByProjectId(access.projectId),
    getBoardTaskLinks(boardId),
    getMilestonesByProjectId(access.projectId),
    getProjectMembers(access.projectId),
  ])

  const profiles: ProfileItem[] = projectMembers.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
    avatar_url: m.avatarUrl,
    role: m.role,
  }))

  const wsUrl =
    process.env.NEXT_PUBLIC_COLLAB_WS_URL?.trim() || 'ws://localhost:1234'

  return (
    <WhiteboardEditorClient
      board={access.board}
      projectId={access.projectId}
      projectSlug={access.projectSlug}
      projectName={access.projectName || access.projectSlug}
      canWrite={access.canWrite}
      canManage={access.canManage}
      wsUrl={wsUrl}
      highlightElementId={highlightElementId ?? null}
      currentUser={{
        id: user.id,
        name:
          profile?.name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Teammate',
        avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || null,
      }}
      initialTasks={tasks as unknown as TaskItem[]}
      initialLinks={links}
      milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
      profiles={profiles}
    />
  )
}

