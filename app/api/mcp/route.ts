import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { hashMcpToken } from '@/lib/mcp/tokens'
import { getOrCreateSubfolder, type ProjectSubfolder } from '@/lib/gdrive/upload'
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  UpdateTaskStatusSchema,
  CreateSubtaskSchema,
  UpdateSubtaskStatusSchema,
  UpdateSubtaskTitleSchema,
  DeleteTaskSchema,
  DeleteSubtaskSchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  DeleteMilestoneSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  ArchiveProjectSchema,
  CreateAssetSchema,
  UpdateAssetStatusSchema,
  DeleteAssetSchema,
  CreateCreditSchema,
  DeleteCreditSchema,
  ExportCreditsSchema,
  CreateArtifactSchema,
  DeleteArtifactSchema,
  UploadAssetFileSchema,
  UploadBundleSchema,
  UploadArtifactFileSchema,
} from '@/lib/ai/tools'
import { slugify } from '@/lib/slug'

export const runtime = 'nodejs'

const TOOL_NAMES = [
  'list_projects',
  'list_profiles',
  'get_project',
  'create_project',
  'update_project',
  'archive_project',
  'list_tasks',
  'create_task',
  'update_task',
  'update_task_status',
  'delete_task',
  'create_subtask',
  'update_subtask_status',
  'update_subtask_title',
  'delete_subtask',
  'list_milestones',
  'create_milestone',
  'update_milestone',
  'delete_milestone',
  'list_assets',
  'create_asset',
  'update_asset_status',
  'delete_asset',
  'list_bundles',
  'list_credits',
  'create_credit',
  'delete_credit',
  'export_credits',
  'list_artifacts',
  'create_artifact',
  'delete_artifact',
  'upload_asset_file',
  'upload_bundle',
  'upload_artifact_file',
]

async function checkAuth(req: Request): Promise<Response | { userId: string | null }> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Path 1: shared server secret (server-to-server, backward compatible).
  const secret = process.env.MCP_SECRET
  if (secret && token === secret) {
    return { userId: null }
  }

  // Path 2: per-user token issued from the MCP Setup page.
  try {
    const db = serviceDb()
    const { data, error } = await db
      .from('mcp_tokens')
      .select('id, user_id')
      .eq('token_hash', hashMcpToken(token))
      .is('revoked_at', null)
      .maybeSingle()
    if (error || !data) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const row = data as { id: string; user_id: string }
    await db
      .from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', row.id)
    return { userId: row.user_id }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

type DecodedUpload = { ok: true; buffer: Buffer } | { ok: false; error: string }

function decodeUpload(contentBase64: string): DecodedUpload {
  let buffer: Buffer
  try {
    buffer = Buffer.from(contentBase64, 'base64')
  } catch {
    return { ok: false, error: 'Invalid base64 content' }
  }
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'File must be non-empty and under 15MB' }
  }
  return { ok: true, buffer }
}

async function uploadToDrive(
  userId: string,
  parentFolderId: string,
  subfolder: ProjectSubfolder,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{ fileId: string; viewUrl: string }> {
  const db = serviceDb()
  const { data: tokenRecord, error } = await db
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle()
  if (error || !tokenRecord) {
    throw new Error('Google Drive not linked. Connect Drive in the web app first.')
  }
  const record = tokenRecord as { access_token: string; refresh_token: string | null; expires_at: string | null }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: record.access_token,
    refresh_token: record.refresh_token,
    expiry_date: record.expires_at ? new Date(record.expires_at).getTime() : undefined,
  })
  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  const subfolderId = await getOrCreateSubfolder(drive, parentFolderId, subfolder)
  const stream = new Readable()
  stream.push(fileBuffer)
  stream.push(null)
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [subfolderId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: stream },
    fields: 'id',
  })
  if (!res.data.id) {
    throw new Error('Google Drive upload did not return a file ID')
  }
  return {
    fileId: res.data.id,
    viewUrl: `https://drive.google.com/file/d/${res.data.id}/view`,
  }
}

async function getProjectDriveFolder(projectId: string): Promise<string | { error: string }> {
  const db = serviceDb()
  const { data, error } = await db
    .from('projects')
    .select('drive_folder_id')
    .eq('id', projectId)
    .single()
  if (error || !data) return { error: 'Project not found' }
  const folderId = (data as { drive_folder_id: string | null }).drive_folder_id
  if (!folderId) return { error: 'Project Drive folder missing. Retry Drive provisioning first.' }
  return folderId
}

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('MCP unavailable. Missing Supabase config.')
  }
  return createServiceClient(url, serviceKey, { auth: { persistSession: false } })
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

function buildServer(auth: { userId: string | null }) {
  const server = new McpServer({ name: 'pir-project', version: '1.0.0' })

  server.registerTool(
    'list_projects',
    { description: 'List all projects.' },
    async () => {
      const db = serviceDb()
      const { data, error } = await db
        .from('projects')
        .select('id, name, slug, type, status')
        .order('created_at', { ascending: false })
      if (error) return textResult({ error: error.message })
      return textResult(data ?? [])
    }
  )

  server.registerTool(
    'list_profiles',
    { description: 'List team members to resolve a name to assignee ID.' },
    async () => {
      const db = serviceDb()
      const { data, error } = await db
        .from('profiles')
        .select('id, name, email, avatar_url')
        .order('name', { ascending: true })
      if (error) return textResult({ error: error.message })
      return textResult(data ?? [])
    }
  )

  server.registerTool(
    'get_project',
    {
      description: 'Get a single project by ID.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const db = serviceDb()
      const { data, error } = await db.from('projects').select('*').eq('id', projectId).single()
      if (error) return textResult({ error: error.message })
      return textResult(data)
    }
  )

  server.registerTool(
    'list_tasks',
    {
      description: 'List tasks in a project.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const db = serviceDb()
      const { data, error } = await db
        .from('tasks')
        .select('*, subtasks(id, task_id, title, status, position)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) return textResult({ error: error.message })
      return textResult(data ?? [])
    }
  )

  server.registerTool(
    'create_task',
    {
      description: 'Create a task with optional subtasks.',
      inputSchema: {
        project_id: z.string().uuid(),
        title: z.string().min(1).max(150),
        description: z.string().optional().nullable(),
        status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
        milestone_id: z.string().uuid().optional().nullable(),
        assignee_id: z.string().uuid().optional().nullable(),
        due_date: z.string().optional().nullable(),
        subtasks: z.array(z.string().min(1)).optional(),
      },
    },
    async (args) => {
      const parsed = CreateTaskSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('tasks')
        .insert({
          project_id: parsed.data.project_id,
          title: parsed.data.title,
          description: parsed.data.description || null,
          status: parsed.data.status ?? 'todo',
          milestone_id: parsed.data.milestone_id || null,
          assignee_id: parsed.data.assignee_id || null,
          due_date: parsed.data.due_date || null,
        })
        .select()
        .single()
      if (error || !data) return textResult({ error: error?.message ?? 'Failed to create task' })
      if (parsed.data.subtasks?.length) {
        await db.from('subtasks').insert(
          parsed.data.subtasks.map((title, index) => ({
            task_id: (data as { id: string }).id,
            title: title.trim(),
            status: 'todo',
            position: index,
          }))
        )
      }
      return textResult({ success: true, task: data })
    }
  )

  server.registerTool(
    'update_task',
    {
      description: 'Update task fields by ID.',
      inputSchema: {
        taskId: z.string().uuid(),
        projectId: z.string().uuid(),
        title: z.string().min(1).max(150).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
        milestone_id: z.string().nullable().optional(),
        assignee_id: z.string().nullable().optional(),
        due_date: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const parsed = UpdateTaskSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      // Drop routing keys: tasks table has project_id, and it must not be overwritten.
      const { taskId, projectId: _projectId, ...fields } = parsed.data
      const db = serviceDb()
      const { data, error } = await db
        .from('tasks')
        .update({ ...fields })
        .eq('id', taskId)
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, task: data })
    }
  )

  server.registerTool(
    'update_task_status',
    {
      description: 'Move a task to a new status.',
      inputSchema: {
        taskId: z.string().uuid(),
        projectId: z.string().uuid(),
        newStatus: z.enum(['todo', 'in_progress', 'review', 'done']),
      },
    },
    async (args) => {
      const parsed = UpdateTaskStatusSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('tasks')
        .update({ status: parsed.data.newStatus })
        .eq('id', parsed.data.taskId)
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, task: data })
    }
  )

  server.registerTool(
    'create_subtask',
    {
      description: 'Add a subtask to a task.',
      inputSchema: { taskId: z.string().uuid(), title: z.string().min(1).max(200) },
    },
    async (args) => {
      const parsed = CreateSubtaskSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('subtasks')
        .insert({ task_id: parsed.data.taskId, title: parsed.data.title.trim(), status: 'todo' })
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, subtask: data })
    }
  )

  server.registerTool(
    'list_milestones',
    {
      description: 'List milestones in a project.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const db = serviceDb()
      const { data, error } = await db
        .from('milestones')
        .select('*, tasks(id, status)')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) return textResult({ error: error.message })
      return textResult(data ?? [])
    }
  )

  server.registerTool(
    'create_milestone',
    {
      description: 'Create a milestone in a project.',
      inputSchema: {
        project_id: z.string().uuid(),
        title: z.string().min(1).max(100),
        start_date: z.string().optional().nullable(),
        due_date: z.string().optional().nullable(),
        status: z.enum(['not_started', 'in_progress', 'done']).optional(),
      },
    },
    async (args) => {
      const parsed = CreateMilestoneSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('milestones')
        .insert({
          project_id: parsed.data.project_id,
          title: parsed.data.title,
          start_date: parsed.data.start_date || null,
          due_date: parsed.data.due_date || null,
          status: parsed.data.status ?? 'not_started',
        })
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, milestone: data })
    }
  )

  server.registerTool(
    'update_milestone',
    {
      description: 'Update milestone fields by ID.',
      inputSchema: {
        milestoneId: z.string().uuid(),
        title: z.string().min(1).max(100).optional(),
        start_date: z.string().nullable().optional(),
        due_date: z.string().nullable().optional(),
        status: z.enum(['not_started', 'in_progress', 'done']).optional(),
      },
    },
    async (args) => {
      const parsed = UpdateMilestoneSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const { milestoneId, projectId: _projectId, ...fields } = parsed.data
      if (fields.start_date && fields.due_date && new Date(fields.due_date) < new Date(fields.start_date)) {
        return textResult({ error: 'End date must be on or after start date' })
      }
      const db = serviceDb()
      const { data, error } = await db
        .from('milestones')
        .update({ ...fields })
        .eq('id', milestoneId)
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, milestone: data })
    }
  )

  server.registerTool(
    'delete_milestone',
    {
      description: 'Delete a milestone by ID.',
      inputSchema: { milestoneId: z.string().uuid() },
    },
    async (args) => {
      const parsed = DeleteMilestoneSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { error } = await db.from('milestones').delete().eq('id', parsed.data.milestoneId)
      if (error) return textResult({ error: error.message })
      return textResult({ success: true })
    }
  )

  server.registerTool(
    'delete_task',
    {
      description: 'Delete a task by ID.',
      inputSchema: { taskId: z.string().uuid() },
    },
    async (args) => {
      const parsed = DeleteTaskSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { error } = await db.from('tasks').delete().eq('id', parsed.data.taskId)
      if (error) return textResult({ error: error.message })
      return textResult({ success: true })
    }
  )

  server.registerTool(
    'update_subtask_status',
    {
      description: 'Set subtask status to todo or done.',
      inputSchema: { subtaskId: z.string().uuid(), status: z.enum(['todo', 'done']) },
    },
    async (args) => {
      const parsed = UpdateSubtaskStatusSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('subtasks')
        .update({ status: parsed.data.status })
        .eq('id', parsed.data.subtaskId)
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, subtask: data })
    }
  )

  server.registerTool(
    'update_subtask_title',
    {
      description: 'Rename a subtask.',
      inputSchema: { subtaskId: z.string().uuid(), title: z.string().min(1).max(200) },
    },
    async (args) => {
      const parsed = UpdateSubtaskTitleSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('subtasks')
        .update({ title: parsed.data.title.trim() })
        .eq('id', parsed.data.subtaskId)
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, subtask: data })
    }
  )

  server.registerTool(
    'delete_subtask',
    {
      description: 'Delete a subtask by ID.',
      inputSchema: { subtaskId: z.string().uuid() },
    },
    async (args) => {
      const parsed = DeleteSubtaskSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { error } = await db.from('subtasks').delete().eq('id', parsed.data.subtaskId)
      if (error) return textResult({ error: error.message })
      return textResult({ success: true })
    }
  )

  server.registerTool(
    'create_project',
    {
      description: 'Create a project. Drive folder is not provisioned via MCP.',
      inputSchema: {
        name: z.string().min(1).max(100),
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(100)
          .optional(),
        type: z.enum(['jam', 'competition', 'internal']),
        start_date: z.string().optional().nullable(),
        deadline: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
      },
    },
    async (args) => {
      const parsed = CreateProjectSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const slug = parsed.data.slug ?? slugify(parsed.data.name)
      const { data: existing } = await db.from('projects').select('id').eq('slug', slug).maybeSingle()
      if (existing) return textResult({ error: `Slug "${slug}" is already in use.` })
      const { data, error } = await db
        .from('projects')
        .insert({
          name: parsed.data.name,
          slug,
          type: parsed.data.type,
          start_date: parsed.data.start_date || null,
          deadline: parsed.data.deadline || null,
          description: parsed.data.description || null,
          status: 'active',
        })
        .select()
        .single()
      if (error || !data) return textResult({ error: error?.message ?? 'Failed to create project' })
      return textResult({ success: true, project: data })
    }
  )

  server.registerTool(
    'update_project',
    {
      description: 'Update project fields by ID.',
      inputSchema: {
        projectId: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(100)
          .optional(),
        type: z.enum(['jam', 'competition', 'internal']).optional(),
        status: z.enum(['active', 'completed', 'archived']).optional(),
        start_date: z.string().nullable().optional(),
        deadline: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const parsed = UpdateProjectSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const { projectId, ...fields } = parsed.data
      if (fields.slug) {
        const db = serviceDb()
        const { data: existing } = await db
          .from('projects')
          .select('id')
          .eq('slug', fields.slug)
          .neq('id', projectId)
          .maybeSingle()
        if (existing) return textResult({ error: `Slug "${fields.slug}" is already in use.` })
      }
      const db = serviceDb()
      const { data, error } = await db
        .from('projects')
        .update({ ...fields })
        .eq('id', projectId)
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, project: data })
    }
  )

  server.registerTool(
    'archive_project',
    {
      description: 'Archive a project by ID.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const parsed = ArchiveProjectSchema.safeParse({ projectId })
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('projects')
        .update({ status: 'archived' })
        .eq('id', parsed.data.projectId)
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, project: data })
    }
  )

  server.registerTool(
    'list_assets',
    {
      description: 'List assets in a project.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const db = serviceDb()
      const { data, error } = await db
        .from('assets')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) return textResult({ error: error.message })
      return textResult(data ?? [])
    }
  )

  server.registerTool(
    'create_asset',
    {
      description: 'Create an asset entry, metadata only without file upload.',
      inputSchema: {
        project_id: z.string().uuid(),
        name: z.string().min(1).max(100),
        type: z.enum(['sprite', 'audio', '3d_model', 'font', 'vfx', 'other']),
        task_id: z.string().uuid().optional().nullable(),
        status: z.enum(['todo', 'in_progress', 'done', 'implemented']).optional(),
        needs_credit: z.boolean().optional(),
        notes: z.string().max(500).optional().nullable(),
      },
    },
    async (args) => {
      const parsed = CreateAssetSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('assets')
        .insert({
          project_id: parsed.data.project_id,
          name: parsed.data.name,
          type: parsed.data.type,
          task_id: parsed.data.task_id || null,
          status: parsed.data.status ?? 'todo',
          needs_credit: parsed.data.needs_credit ?? false,
          notes: parsed.data.notes || null,
        })
        .select()
        .single()
      if (error || !data) return textResult({ error: error?.message ?? 'Failed to create asset' })
      return textResult({ success: true, asset: data })
    }
  )

  server.registerTool(
    'update_asset_status',
    {
      description: 'Set asset status.',
      inputSchema: {
        assetId: z.string().uuid(),
        status: z.enum(['todo', 'in_progress', 'done', 'implemented']),
      },
    },
    async (args) => {
      const parsed = UpdateAssetStatusSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('assets')
        .update({ status: parsed.data.status })
        .eq('id', parsed.data.assetId)
        .select()
        .single()
      if (error) return textResult({ error: error.message })
      return textResult({ success: true, asset: data })
    }
  )

  server.registerTool(
    'delete_asset',
    {
      description: 'Delete an asset by ID.',
      inputSchema: { assetId: z.string().uuid() },
    },
    async (args) => {
      const parsed = DeleteAssetSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { error } = await db.from('assets').delete().eq('id', parsed.data.assetId)
      if (error) return textResult({ error: error.message })
      return textResult({ success: true })
    }
  )

  server.registerTool(
    'list_bundles',
    {
      description: 'List asset bundles in a project.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const db = serviceDb()
      const { data, error } = await db
        .from('asset_bundles')
        .select('id, name, file_name, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) return textResult({ error: error.message })
      return textResult(data ?? [])
    }
  )

  server.registerTool(
    'list_credits',
    {
      description: 'List credits in a project.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const db = serviceDb()
      const { data, error } = await db
        .from('credits')
        .select('*, assets:asset_id(id, name, type)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) return textResult({ error: error.message })
      return textResult(data ?? [])
    }
  )

  server.registerTool(
    'create_credit',
    {
      description: 'Create a credit entry.',
      inputSchema: {
        project_id: z.string().uuid(),
        source_name: z.string().min(1).max(150),
        author: z.string().max(100).optional().nullable(),
        license: z.enum(['cc0', 'cc_by', 'royalty_free', 'proprietary', 'other']),
        source_url: z.string().url().or(z.literal('')).optional().nullable(),
        notes: z.string().max(500).optional().nullable(),
        asset_id: z.string().uuid().or(z.literal('')).optional().nullable(),
      },
    },
    async (args) => {
      const parsed = CreateCreditSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('credits')
        .insert({
          project_id: parsed.data.project_id,
          source_name: parsed.data.source_name,
          author: parsed.data.author || null,
          license: parsed.data.license,
          source_url: parsed.data.source_url || null,
          notes: parsed.data.notes || null,
          asset_id: parsed.data.asset_id || null,
        })
        .select()
        .single()
      if (error || !data) return textResult({ error: error?.message ?? 'Failed to create credit' })
      return textResult({ success: true, credit: data })
    }
  )

  server.registerTool(
    'delete_credit',
    {
      description: 'Delete a credit by ID.',
      inputSchema: { creditId: z.string().uuid() },
    },
    async (args) => {
      const parsed = DeleteCreditSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { error } = await db.from('credits').delete().eq('id', parsed.data.creditId)
      if (error) return textResult({ error: error.message })
      return textResult({ success: true })
    }
  )

  server.registerTool(
    'export_credits',
    {
      description: 'Export project credits as markdown text.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async (args) => {
      const parsed = ExportCreditsSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data: project } = await db
        .from('projects')
        .select('name')
        .eq('id', parsed.data.projectId)
        .single()
      const { data, error } = await db
        .from('credits')
        .select('source_name, author, license, source_url, notes')
        .eq('project_id', parsed.data.projectId)
        .order('created_at', { ascending: false })
      if (error) return textResult({ error: error.message })
      const projectName = (project as { name?: string } | null)?.name ?? 'Project'
      const lines = ((data ?? []) as Array<Record<string, string | null>>).map(
        (c) =>
          `- ${c.source_name ?? 'Untitled'} by ${c.author || 'Unknown'} (${c.license ?? 'other'})${c.source_url ? ` — ${c.source_url}` : ''}${c.notes ? ` — ${c.notes}` : ''}`
      )
      return textResult({
        success: true,
        markdown: `# Credits — ${projectName}\n\n${lines.length > 0 ? lines.join('\n') : 'No credits.'}`,
      })
    }
  )

  server.registerTool(
    'list_artifacts',
    {
      description: 'List artifact links in a project.',
      inputSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const db = serviceDb()
      const { data, error } = await db
        .from('artifact_links')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) return textResult({ error: error.message })
      return textResult(data ?? [])
    }
  )

  server.registerTool(
    'create_artifact',
    {
      description: 'Create an artifact link.',
      inputSchema: {
        project_id: z.string().uuid(),
        label: z.string().min(1).max(100),
        type: z.enum(['figma', 'figjam', 'gdd', 'build', 'other']),
        url: z.string().url(),
        notes: z.string().max(500).optional().nullable(),
      },
    },
    async (args) => {
      const parsed = CreateArtifactSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { data, error } = await db
        .from('artifact_links')
        .insert({
          project_id: parsed.data.project_id,
          label: parsed.data.label,
          type: parsed.data.type,
          url: parsed.data.url,
          notes: parsed.data.notes || null,
        })
        .select()
        .single()
      if (error || !data) return textResult({ error: error?.message ?? 'Failed to create artifact' })
      return textResult({ success: true, artifact: data })
    }
  )

  server.registerTool(
    'delete_artifact',
    {
      description: 'Delete an artifact link by ID.',
      inputSchema: { artifactId: z.string().uuid() },
    },
    async (args) => {
      const parsed = DeleteArtifactSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const db = serviceDb()
      const { error } = await db.from('artifact_links').delete().eq('id', parsed.data.artifactId)
      if (error) return textResult({ error: error.message })
      return textResult({ success: true })
    }
  )

  server.registerTool(
    'upload_asset_file',
    {
      description: 'Upload a file for an asset. Base64 content, 15MB raw max. Needs linked Drive.',
      inputSchema: {
        assetId: z.string().uuid(),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(150),
        contentBase64: z.string().min(1),
      },
    },
    async (args) => {
      if (!auth.userId) return textResult({ error: 'Uploads need a user token, not the server secret.' })
      const parsed = UploadAssetFileSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const decoded = decodeUpload(parsed.data.contentBase64)
      if (!decoded.ok) return textResult({ error: decoded.error })
      const buffer = decoded.buffer
      const db = serviceDb()
      const { data: asset, error: assetError } = await db
        .from('assets')
        .select('id, project_id')
        .eq('id', parsed.data.assetId)
        .single()
      if (assetError || !asset) return textResult({ error: 'Asset not found' })
      const folder = await getProjectDriveFolder((asset as { project_id: string }).project_id)
      if (typeof folder !== 'string') return textResult({ error: folder.error })
      try {
        const uploaded = await uploadToDrive(
          auth.userId,
          folder,
          'Assets',
          parsed.data.fileName,
          parsed.data.mimeType,
          buffer
        )
        const { error } = await db
          .from('assets')
          .update({ drive_file_id: uploaded.fileId, file_name: parsed.data.fileName })
          .eq('id', parsed.data.assetId)
        if (error) return textResult({ error: error.message })
        return textResult({ success: true, driveFileId: uploaded.fileId, viewUrl: uploaded.viewUrl })
      } catch (err) {
        return textResult({ error: err instanceof Error ? err.message : 'Upload failed' })
      }
    }
  )

  server.registerTool(
    'upload_bundle',
    {
      description: 'Upload a bundle archive to Builds. Base64 content, 15MB raw max. Needs linked Drive.',
      inputSchema: {
        project_id: z.string().uuid(),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(150).optional(),
        contentBase64: z.string().min(1),
      },
    },
    async (args) => {
      if (!auth.userId) return textResult({ error: 'Uploads need a user token, not the server secret.' })
      const parsed = UploadBundleSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const decoded = decodeUpload(parsed.data.contentBase64)
      if (!decoded.ok) return textResult({ error: decoded.error })
      const buffer = decoded.buffer
      const folder = await getProjectDriveFolder(parsed.data.project_id)
      if (typeof folder !== 'string') return textResult({ error: folder.error })
      try {
        const uploaded = await uploadToDrive(
          auth.userId,
          folder,
          'Builds',
          parsed.data.fileName,
          parsed.data.mimeType ?? 'application/zip',
          buffer
        )
        const db = serviceDb()
        const { data, error } = await db
          .from('asset_bundles')
          .insert({
            project_id: parsed.data.project_id,
            drive_file_id: uploaded.fileId,
            file_name: parsed.data.fileName,
            uploaded_by: auth.userId,
          })
          .select()
          .single()
        if (error || !data) return textResult({ error: error?.message ?? 'Failed to save bundle' })
        return textResult({ success: true, bundle: data, viewUrl: uploaded.viewUrl })
      } catch (err) {
        return textResult({ error: err instanceof Error ? err.message : 'Upload failed' })
      }
    }
  )

  server.registerTool(
    'upload_artifact_file',
    {
      description: 'Upload a build or GDD file and link it. Base64 content, 15MB raw max. Needs linked Drive.',
      inputSchema: {
        project_id: z.string().uuid(),
        label: z.string().min(1).max(100),
        type: z.enum(['build', 'gdd']),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(150).optional(),
        contentBase64: z.string().min(1),
        notes: z.string().max(500).optional().nullable(),
      },
    },
    async (args) => {
      if (!auth.userId) return textResult({ error: 'Uploads need a user token, not the server secret.' })
      const parsed = UploadArtifactFileSchema.safeParse(args)
      if (!parsed.success) return textResult({ error: parsed.error.issues[0]?.message })
      const decoded = decodeUpload(parsed.data.contentBase64)
      if (!decoded.ok) return textResult({ error: decoded.error })
      const buffer = decoded.buffer
      const folder = await getProjectDriveFolder(parsed.data.project_id)
      if (typeof folder !== 'string') return textResult({ error: folder.error })
      try {
        const uploaded = await uploadToDrive(
          auth.userId,
          folder,
          parsed.data.type === 'build' ? 'Builds' : 'GDD',
          parsed.data.fileName,
          parsed.data.mimeType || 'application/octet-stream',
          buffer
        )
        const db = serviceDb()
        const { data, error } = await db
          .from('artifact_links')
          .insert({
            project_id: parsed.data.project_id,
            label: parsed.data.label,
            type: parsed.data.type,
            url: uploaded.viewUrl,
            notes: parsed.data.notes || null,
          })
          .select()
          .single()
        if (error || !data) return textResult({ error: error?.message ?? 'Failed to save artifact' })
        return textResult({ success: true, artifact: data })
      } catch (err) {
        return textResult({ error: err instanceof Error ? err.message : 'Upload failed' })
      }
    }
  )

  return server
}

export async function GET(req: Request) {
  const auth = await checkAuth(req)
  if (auth instanceof Response) return auth
  return Response.json({ tools: TOOL_NAMES })
}

export async function POST(req: Request) {
  const auth = await checkAuth(req)
  if (auth instanceof Response) return auth

  const server = buildServer(auth)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  try {
    return await transport.handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MCP request failed'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const auth = await checkAuth(req)
  if (auth instanceof Response) return auth
  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
