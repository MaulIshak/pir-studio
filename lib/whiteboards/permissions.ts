import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoardStatus } from './types'

export type OrgRole = 'leader' | 'co_leader' | 'member'

export interface BoardAccessResult {
  hasAccess: boolean
  canWrite: boolean
  canManage: boolean
  role: OrgRole | null
  projectId: string | null
  projectSlug: string | null
  projectName: string | null
  organizationId: string | null
  board: {
    id: string
    title: string
    status: BoardStatus
    is_locked: boolean
    project_id: string
    thumbnail_key: string | null
    created_by: string | null
    created_at: string
    updated_at: string
  } | null
}

const EMPTY_ACCESS: BoardAccessResult = {
  hasAccess: false,
  canWrite: false,
  canManage: false,
  role: null,
  projectId: null,
  projectSlug: null,
  projectName: null,
  organizationId: null,
  board: null,
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Single source of truth for board authorization.
 * Used by BOTH the Next.js app (Server Components, Server Actions, API routes)
 * and the standalone Hocuspocus realtime server.
 *
 * Rules:
 * - Board permissions are strictly inherited from the owning project.
 * - `leader` and `co_leader` of the owning organization have access to all projects in that org
 *   and have management permissions (`canManage`: lock/unlock, archive/restore, delete).
 * - `member` must be explicitly assigned to the project via `project_members`.
 * - Write access (`canWrite`) requires project access AND an active, unlocked board.
 */
export async function resolveBoardAccess(
  supabase: SupabaseClient,
  boardId: string,
  userId: string
): Promise<BoardAccessResult> {
  if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(userId)) {
    return EMPTY_ACCESS
  }

  const { data: boardRow, error: boardError } = await supabase
    .from('boards')
    .select(
      `
      id,
      title,
      status,
      is_locked,
      project_id,
      thumbnail_key,
      created_by,
      created_at,
      updated_at,
      projects:project_id (
        id,
        slug,
        name,
        organization_id
      )
    `
    )
    .eq('id', boardId)
    .maybeSingle()

  if (boardError || !boardRow) {
    return EMPTY_ACCESS
  }

  const projectData = Array.isArray(boardRow.projects)
    ? boardRow.projects[0]
    : boardRow.projects

  if (!projectData || !projectData.organization_id) {
    return EMPTY_ACCESS
  }

  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', projectData.organization_id)
    .eq('user_id', userId)
    .maybeSingle()

  const role = (orgMember?.role as OrgRole | undefined) ?? null
  if (!role) {
    return EMPTY_ACCESS
  }

  let hasAccess = role === 'leader' || role === 'co_leader'

  if (!hasAccess) {
    const { data: projectMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectData.id)
      .eq('user_id', userId)
      .maybeSingle()

    hasAccess = !!projectMember
  }

  if (!hasAccess) {
    return EMPTY_ACCESS
  }

  const canManage = role === 'leader' || role === 'co_leader'
  const status = boardRow.status as BoardStatus
  const isLocked = Boolean(boardRow.is_locked)
  const canWrite = status === 'active' && !isLocked

  return {
    hasAccess: true,
    canWrite,
    canManage,
    role,
    projectId: projectData.id,
    projectSlug: projectData.slug,
    projectName: projectData.name,
    organizationId: projectData.organization_id,
    board: {
      id: boardRow.id,
      title: boardRow.title,
      status,
      is_locked: isLocked,
      project_id: boardRow.project_id,
      thumbnail_key: boardRow.thumbnail_key,
      created_by: boardRow.created_by,
      created_at: boardRow.created_at,
      updated_at: boardRow.updated_at,
    },
  }
}

