'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCurrentUser,
  requireBoardAccess,
  requireBoardWriteAccess,
  requireOrgAdmin,
  requireProjectAccess,
} from '@/lib/auth/permissions'
import { createTask } from '@/actions/tasks'
import {
  deleteBoardStoragePrefix,
  deleteFileFromStorage,
  getS3Bucket,
  getS3Client,
} from '@/lib/storage/s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import {
  BUILT_IN_BOARD_TEMPLATES,
  builtInToTemplateRecord,
  getBuiltInTemplateById,
} from '@/lib/whiteboards/templates'
import {
  buildInitialBoardSnapshot,
  encodeByteaHex,
} from '@/lib/whiteboards/snapshot'
import type {
  BoardRecord,
  BoardStatus,
  BoardTaskLinkRecord,
  BoardTemplateCategory,
  BoardTemplateRecord,
  TaskLinkedBoardItem,
} from '@/lib/whiteboards/types'

const CreateBoardSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(120),
  templateId: z.string().optional().nullable(),
})

const SaveTemplateSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(100),
  category: z.enum(['brainstorm', 'gameplay', 'scope', 'level', 'ui', 'custom']).default('custom'),
  description: z.string().trim().max(240).optional().nullable(),
  elements: z.array(z.record(z.string(), z.unknown())).max(5000),
})

const CreateTasksFromElementsSchema = z.object({
  boardId: z.string().uuid(),
  projectId: z.string().uuid(),
  items: z
    .array(
      z.object({
        elementId: z.string().min(1).max(120),
        title: z.string().trim().min(1, 'Title is required').max(150),
        description: z.string().optional().nullable(),
        status: z.enum(['todo', 'in_progress', 'review', 'done']).default('todo'),
        milestone_id: z.string().uuid().optional().nullable(),
        assignee_id: z.string().uuid().optional().nullable(),
        due_date: z.string().optional().nullable(),
      })
    )
    .min(1)
    .max(50),
})

export async function getBoardsByProjectId(projectId: string): Promise<BoardRecord[]> {
  await requireProjectAccess(projectId)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('boards')
    .select(
      `
      id,
      project_id,
      title,
      status,
      is_locked,
      thumbnail_key,
      created_by,
      created_at,
      updated_at,
      creator:created_by (
        id,
        name,
        avatar_url
      )
    `
    )
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  if (error || !data) {
    console.error('Failed to fetch boards:', error)
    return []
  }

  return data.map((row) => ({
    ...row,
    status: row.status as BoardStatus,
    creator: Array.isArray(row.creator) ? (row.creator[0] ?? null) : (row.creator ?? null),
  })) as BoardRecord[]
}

export async function createBoard(input: {
  projectId: string
  title: string
  templateId?: string | null
}) {
  const parsed = CreateBoardSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Authentication required' }
  }

  const { organizationId } = await requireProjectAccess(parsed.data.projectId)
  const supabase = await createClient()

  // Resolve optional template elements BEFORE inserting snapshot
  let templateElements: Record<string, unknown>[] = []
  if (parsed.data.templateId && parsed.data.templateId !== 'blank') {
    const builtIn = getBuiltInTemplateById(parsed.data.templateId)
    if (builtIn) {
      templateElements = builtIn.elements
    } else if (organizationId) {
      const { data: orgTpl } = await supabase
        .from('board_templates')
        .select('content, organization_id, is_system')
        .eq('id', parsed.data.templateId)
        .maybeSingle()

      if (orgTpl && (orgTpl.is_system || orgTpl.organization_id === organizationId)) {
        const content = orgTpl.content as { elements?: Record<string, unknown>[] } | null
        if (Array.isArray(content?.elements)) {
          templateElements = content.elements
        }
      }
    }
  }

  const { data: board, error: insertError } = await supabase
    .from('boards')
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      status: 'active',
      is_locked: false,
      created_by: user.id,
    })
    .select(
      `
      id,
      project_id,
      title,
      status,
      is_locked,
      thumbnail_key,
      created_by,
      created_at,
      updated_at
    `
    )
    .single()

  if (insertError || !board) {
    return { error: insertError?.message ?? 'Failed to create board' }
  }

  // Seed initial Yjs snapshot into server-only board_snapshots table if template has elements
  if (templateElements.length > 0) {
    try {
      const admin = createAdminClient()
      const { state, elementCount } = buildInitialBoardSnapshot(templateElements)
      const { error: snapError } = await admin.from('board_snapshots').upsert(
        {
          board_id: board.id,
          state: encodeByteaHex(state),
          version: 1,
          element_count: elementCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'board_id' }
      )
      if (snapError) {
        console.error('Failed to seed template snapshot:', snapError)
      }
    } catch (err) {
      console.error('Template snapshot seeding error:', err)
    }
  }

  revalidatePath('/projects/[slug]/boards', 'page')
  return { success: true, board: board as BoardRecord }
}

export async function renameBoard(boardId: string, title: string) {
  const cleanTitle = title.trim()
  if (!cleanTitle || cleanTitle.length > 120) {
    return { error: 'Title must be between 1 and 120 characters' }
  }

  try {
    await requireBoardWriteAccess(boardId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('boards')
    .update({ title: cleanTitle })
    .eq('id', boardId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]/boards', 'page')
  revalidatePath('/projects/[slug]/boards/[boardId]', 'page')
  return { success: true, board: data as BoardRecord }
}

export async function toggleBoardLock(boardId: string, isLocked: boolean) {
  try {
    const access = await requireBoardAccess(boardId)
    if (!access.canManage) {
      return { error: 'Only leaders and co-leaders can lock or unlock boards' }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('boards')
    .update({ is_locked: isLocked })
    .eq('id', boardId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]/boards', 'page')
  revalidatePath('/projects/[slug]/boards/[boardId]', 'page')
  return { success: true, board: data as BoardRecord }
}

export async function updateBoardStatus(boardId: string, status: BoardStatus) {
  try {
    const access = await requireBoardAccess(boardId)
    if (!access.canManage) {
      return { error: 'Only leaders and co-leaders can archive or restore boards' }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('boards')
    .update({ status })
    .eq('id', boardId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]/boards', 'page')
  revalidatePath('/projects/[slug]/boards/[boardId]', 'page')
  return { success: true, board: data as BoardRecord }
}

export async function deleteBoard(boardId: string) {
  let projectId: string | null = null
  try {
    const access = await requireBoardAccess(boardId)
    if (!access.canManage) {
      return { error: 'Only leaders and co-leaders can delete boards' }
    }
    projectId = access.projectId
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('boards').delete().eq('id', boardId)

  if (error) {
    return { error: error.message }
  }

  // Clean up Garage objects for this board (best-effort)
  if (projectId) {
    try {
      await deleteBoardStoragePrefix(projectId, boardId)
    } catch (storageErr) {
      console.error('Failed to clean up Garage objects for deleted board:', storageErr)
    }
  }

  revalidatePath('/projects/[slug]/boards', 'page')
  return { success: true }
}

export async function getBoardTemplates(organizationId: string): Promise<BoardTemplateRecord[]> {
  const supabase = await createClient()

  const { data: orgTemplates } = await supabase
    .from('board_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_system', false)
    .order('created_at', { ascending: false })

  const builtIns = BUILT_IN_BOARD_TEMPLATES.map(builtInToTemplateRecord)
  const custom = (orgTemplates ?? []).map((row) => ({
    ...row,
    category: row.category as BoardTemplateCategory,
    content: (row.content as BoardTemplateRecord['content']) ?? { elements: [] },
  })) as BoardTemplateRecord[]

  return [...builtIns, ...custom]
}

export async function saveBoardAsTemplate(input: {
  boardId: string
  title: string
  category?: BoardTemplateCategory
  description?: string | null
  elements: Record<string, unknown>[]
}) {
  const parsed = SaveTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Authentication required' }
  }

  let organizationId: string | null = null
  try {
    const access = await requireBoardAccess(parsed.data.boardId)
    organizationId = access.organizationId
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  if (!organizationId) {
    return { error: 'Organization not found' }
  }

  // Strip deleted elements, embedded images (which are board-scoped), and task links
  const cleanedElements = parsed.data.elements
    .filter((el) => el && el.isDeleted !== true && el.type !== 'image')
    .map((el) => {
      const next = { ...el }
      if (next.customData && typeof next.customData === 'object') {
        const custom = { ...(next.customData as Record<string, unknown>) }
        delete custom.linkedTaskId
        next.customData = Object.keys(custom).length > 0 ? custom : undefined
      }
      return next
    })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('board_templates')
    .insert({
      organization_id: organizationId,
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description || null,
      content: { elements: cleanedElements },
      is_system: false,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]/boards', 'page')
  return { success: true, template: data as BoardTemplateRecord }
}

export async function deleteOrgTemplate(templateId: string) {
  const supabase = await createClient()
  const { data: tpl } = await supabase
    .from('board_templates')
    .select('id, organization_id, is_system')
    .eq('id', templateId)
    .maybeSingle()

  if (!tpl || tpl.is_system || !tpl.organization_id) {
    return { error: 'Template cannot be deleted' }
  }

  try {
    await requireOrgAdmin(tpl.organization_id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  const { error } = await supabase
    .from('board_templates')
    .delete()
    .eq('id', templateId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]/boards', 'page')
  return { success: true }
}

/**
 * Create one or more project tasks from selected whiteboard elements using
 * the EXACT same `createTask` Server Action as the Kanban UI, then record links
 * in `board_task_links`.
 */
export async function createTasksFromElements(
  input: z.infer<typeof CreateTasksFromElementsSchema>
) {
  const parsed = CreateTasksFromElementsSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Authentication required' }
  }

  let accessProjectId: string | null = null
  try {
    const access = await requireBoardWriteAccess(parsed.data.boardId)
    accessProjectId = access.projectId
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  if (accessProjectId !== parsed.data.projectId) {
    return { error: 'Board does not belong to this project' }
  }

  const supabase = await createClient()
  const created: Array<{
    elementId: string
    task: Record<string, unknown>
    link: BoardTaskLinkRecord
  }> = []
  const errors: string[] = []

  for (const item of parsed.data.items) {
    const taskRes = await createTask({
      project_id: parsed.data.projectId,
      title: item.title,
      description: item.description ?? null,
      status: item.status,
      milestone_id: item.milestone_id ?? null,
      assignee_id: item.assignee_id ?? null,
      due_date: item.due_date ?? null,
    })

    if (taskRes.error || !taskRes.task) {
      errors.push(`${item.title}: ${taskRes.error ?? 'Failed to create task'}`)
      continue
    }

    const { data: linkRow, error: linkError } = await supabase
      .from('board_task_links')
      .insert({
        board_id: parsed.data.boardId,
        task_id: taskRes.task.id,
        element_id: item.elementId,
        created_by: user.id,
      })
      .select()
      .single()

    if (linkError || !linkRow) {
      errors.push(`${item.title}: task created but failed to link`)
      continue
    }

    created.push({
      elementId: item.elementId,
      task: taskRes.task as unknown as Record<string, unknown>,
      link: linkRow as BoardTaskLinkRecord,
    })
  }

  revalidatePath('/projects/[slug]/tasks', 'page')
  revalidatePath('/projects/[slug]/boards/[boardId]', 'page')

  if (created.length === 0 && errors.length > 0) {
    return { error: errors[0] }
  }

  return {
    success: true,
    created,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export async function linkExistingTaskToElement(input: {
  boardId: string
  taskId: string
  elementId: string
}) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Authentication required' }

  let projectId: string | null = null
  try {
    const access = await requireBoardWriteAccess(input.boardId)
    projectId = access.projectId
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  const supabase = await createClient()

  // Verify the task belongs to the same project
  const { data: taskRow } = await supabase
    .from('tasks')
    .select('id, project_id')
    .eq('id', input.taskId)
    .maybeSingle()

  if (!taskRow || taskRow.project_id !== projectId) {
    return { error: 'Task not found in this project' }
  }

  const { data: existing } = await supabase
    .from('board_task_links')
    .select('*')
    .eq('board_id', input.boardId)
    .eq('task_id', input.taskId)
    .eq('element_id', input.elementId)
    .maybeSingle()

  if (existing) {
    return { success: true, link: existing as BoardTaskLinkRecord }
  }

  const { data, error } = await supabase
    .from('board_task_links')
    .insert({
      board_id: input.boardId,
      task_id: input.taskId,
      element_id: input.elementId,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]/tasks', 'page')
  return { success: true, link: data as BoardTaskLinkRecord }
}

export async function unlinkTaskFromElement(input: {
  boardId: string
  taskId: string
  elementId?: string | null
}) {
  try {
    await requireBoardWriteAccess(input.boardId)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  const supabase = await createClient()
  let query = supabase
    .from('board_task_links')
    .delete()
    .eq('board_id', input.boardId)
    .eq('task_id', input.taskId)

  if (input.elementId) {
    query = query.eq('element_id', input.elementId)
  }

  const { error } = await query
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]/tasks', 'page')
  return { success: true }
}

export async function cleanupDeletedElementLinks(
  boardId: string,
  deletedElementIds: string[]
) {
  if (deletedElementIds.length === 0) return { success: true }
  try {
    await requireBoardWriteAccess(boardId)
  } catch {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()
  await supabase
    .from('board_task_links')
    .delete()
    .eq('board_id', boardId)
    .in('element_id', deletedElementIds)

  return { success: true }
}

export async function getBoardTaskLinks(boardId: string): Promise<BoardTaskLinkRecord[]> {
  await requireBoardAccess(boardId)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('board_task_links')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data as BoardTaskLinkRecord[]
}

export async function getTaskLinkedBoards(taskId: string): Promise<TaskLinkedBoardItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('board_task_links')
    .select(
      `
      id,
      board_id,
      element_id,
      boards:board_id (
        id,
        title,
        status,
        projects:project_id (
          slug
        )
      )
    `
    )
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  const results: TaskLinkedBoardItem[] = []
  for (const row of data) {
    const board = Array.isArray(row.boards) ? row.boards[0] : row.boards
    if (!board) continue
    const project = Array.isArray(board.projects) ? board.projects[0] : board.projects
    if (!project?.slug) continue
    results.push({
      link_id: row.id,
      board_id: board.id,
      board_title: board.title,
      board_status: board.status as BoardStatus,
      project_slug: project.slug,
      element_id: row.element_id,
    })
  }

  return results
}

export async function uploadBoardThumbnail(boardId: string, dataUrl: string) {
  let access
  try {
    access = await requireBoardWriteAccess(boardId)
  } catch {
    return { error: 'Unauthorized' }
  }

  if (!access.projectId || !access.board) {
    return { error: 'Board not found' }
  }

  const match = dataUrl.match(/^data:(image\/(?:webp|png|jpeg));base64,(.+)$/)
  if (!match) {
    return { error: 'Invalid thumbnail image' }
  }

  const mimeType = match[1]
  const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg'
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > 512 * 1024) {
    return { error: 'Thumbnail too large' }
  }

  const storageKey = `projects/${access.projectId}/whiteboards/${boardId}/thumbnail-${Date.now()}.${ext}`
  const client = getS3Client()
  const bucket = getS3Bucket()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.byteLength,
    })
  )

  const previousKey = access.board.thumbnail_key
  const supabase = await createClient()
  const { error } = await supabase
    .from('boards')
    .update({ thumbnail_key: storageKey })
    .eq('id', boardId)

  if (error) {
    await deleteFileFromStorage(storageKey).catch(() => {})
    return { error: error.message }
  }

  if (previousKey && previousKey !== storageKey) {
    await deleteFileFromStorage(previousKey).catch(() => {})
  }

  return { success: true, thumbnailKey: storageKey }
}

