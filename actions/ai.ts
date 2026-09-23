'use server'

import { z } from 'zod'
import { getProjectBySlug, getAllProjectsForNav, createProject, updateProject, archiveProject } from '@/actions/projects'
import {
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  createSubtask,
  updateSubtaskStatus,
  updateSubtaskTitle,
  deleteSubtask,
  getTasksByProjectId,
  getProfiles,
} from '@/actions/tasks'
import { createMilestone, updateMilestone, deleteMilestone, getMilestonesByProjectId } from '@/actions/milestones'
import { getAssetsByProjectId, getAssetBundlesByProjectId, createAsset, updateAssetStatus, deleteAsset } from '@/actions/assets'
import { getCreditsByProjectId, createCredit, deleteCredit, exportCreditsMarkdown } from '@/actions/credits'
import { getArtifactLinksByProjectId, createArtifactLink, deleteArtifactLink } from '@/actions/artifacts'
import { runGeminiWithTools, type ChatHistoryItem, type ExecutedToolCall } from '@/lib/ai/gemini'
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  UpdateTaskStatusSchema,
  DeleteTaskSchema,
  CreateSubtaskSchema,
  UpdateSubtaskStatusSchema,
  UpdateSubtaskTitleSchema,
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
} from '@/lib/ai/tools'

const ChatInputSchema = z.object({
  projectSlug: z.string().optional(),
  projectId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(20)
    .optional()
    .default([]),
})

export type AiChatInput = z.infer<typeof ChatInputSchema>

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  not_started: 'Not Started',
}

interface ToolSuccess {
  success?: boolean
  error?: string
  task?: { title?: string; status?: string }
  subtask?: { title?: string }
  milestone?: { title?: string; status?: string }
  project?: { name?: string; slug?: string }
  asset?: { name?: string; status?: string }
  credit?: { source_name?: string }
  artifact?: { label?: string }
  content?: string
  markdown?: string
}

function buildChangeLog(slug: string, calls: ExecutedToolCall[]): string {
  const lines: string[] = []
  for (const call of calls) {
    const result = call.result as ToolSuccess | null
    if (!result || typeof result !== 'object' || result.error || !result.success) continue
    if ((call.name === 'create_task' || call.name === 'update_task' || call.name === 'update_task_status') && result.task?.title) {
      const verb = call.name === 'create_task' ? 'Created task' : 'Updated task'
      const status = result.task.status ? ` — ${STATUS_LABELS[result.task.status] ?? result.task.status}` : ''
      lines.push(`- ${verb} "${result.task.title}"${status} — /projects/${slug}/tasks`)
    } else if (call.name === 'create_milestone' && result.milestone?.title) {
      const status = result.milestone.status ? ` — ${STATUS_LABELS[result.milestone.status] ?? result.milestone.status}` : ''
      lines.push(`- Created milestone "${result.milestone.title}"${status} — /projects/${slug}/milestones`)
    } else if ((call.name === 'update_milestone' || call.name === 'delete_milestone') && result.success) {
      const verb = call.name === 'update_milestone' ? 'Updated milestone' : 'Deleted milestone'
      lines.push(`- ${verb} — /projects/${slug}/milestones`)
    } else if (call.name === 'delete_task' && result.success) {
      lines.push(`- Deleted task — /projects/${slug}/tasks`)
    } else if ((call.name === 'update_subtask_status' || call.name === 'update_subtask_title' || call.name === 'create_subtask' || call.name === 'delete_subtask') && result.success) {
      const label =
        call.name === 'create_subtask' && result.subtask?.title
          ? `Added subtask "${result.subtask.title}"`
          : call.name === 'delete_subtask'
            ? 'Deleted subtask'
            : 'Updated subtask'
      lines.push(`- ${label} — /projects/${slug}/tasks`)
    } else if (call.name === 'create_project' && result.project?.name) {
      lines.push(`- Created project "${result.project.name}" — /projects/${result.project.slug ?? slug}`)
    } else if ((call.name === 'update_project' || call.name === 'archive_project') && result.success) {
      const verb = call.name === 'archive_project' ? 'Archived project' : 'Updated project'
      lines.push(`- ${verb} — /projects/${slug}`)
    } else if (call.name === 'create_asset' && result.asset?.name) {
      lines.push(`- Created asset "${result.asset.name}" — /projects/${slug}/assets`)
    } else if ((call.name === 'update_asset_status' || call.name === 'delete_asset') && result.success) {
      const verb = call.name === 'delete_asset' ? 'Deleted asset' : 'Updated asset'
      lines.push(`- ${verb} — /projects/${slug}/assets`)
    } else if (call.name === 'create_credit' && result.credit?.source_name) {
      lines.push(`- Created credit "${result.credit.source_name}" — /projects/${slug}/credits`)
    } else if (call.name === 'delete_credit' && result.success) {
      lines.push(`- Deleted credit — /projects/${slug}/credits`)
    } else if (call.name === 'export_credits' && result.markdown) {
      lines.push(`- Exported credits — /projects/${slug}/credits`)
    } else if (call.name === 'create_artifact' && result.artifact?.label) {
      lines.push(`- Created artifact "${result.artifact.label}" — /projects/${slug}/artifacts`)
    } else if (call.name === 'delete_artifact' && result.success) {
      lines.push(`- Deleted artifact — /projects/${slug}/artifacts`)
    }
  }
  if (lines.length === 0) return ''
  return `Done:\n${lines.join('\n')}`
}

export async function getProjectsForAssistant() {
  return getAllProjectsForNav()
}

export async function chatWithAssistant(input: AiChatInput) {
  const validated = ChatInputSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { projectSlug, projectId: projectIdInput, message, history } = validated.data

  let projectId = projectIdInput ?? null
  let projectName: string | null = null
  let slug = projectSlug ?? null

  if (!projectId && projectSlug) {
    const project = await getProjectBySlug(projectSlug)
    if (project) {
      projectId = project.id as string
      projectName = project.name as string
    }
  }

  if (!projectId) {
    return { error: 'Select a project first.' }
  }

  const [tasks, milestones] = await Promise.all([
    getTasksByProjectId(projectId),
    getMilestonesByProjectId(projectId),
  ])

  if (!projectName || !slug) {
    const nav = await getAllProjectsForNav()
    const match = nav.find((p) => p.id === projectId)
    projectName = projectName ?? match?.name ?? null
    slug = slug ?? match?.slug ?? null
  }

  const grounding = [
    `Active project: ${projectName ?? projectId} (${projectId})`,
    `Tasks (${tasks.length}): ${tasks
      .slice(0, 30)
      .map((t) => `- ${t.title} [${t.status}] id=${t.id}`)
      .join('\n')}`,
    `Milestones (${milestones.length}): ${milestones
      .slice(0, 20)
      .map((m) => `- ${(m as { title: string; status?: string; id: string }).title} [${(m as { status?: string }).status ?? 'unknown'}] id=${(m as { id: string }).id}`)
      .join('\n')}`,
  ].join('\n')

  const systemPrompt = [
    'You are an assistant inside a game dev project manager.',
    'Scope: projects, tasks, subtasks, milestones, assets, credits, artifact links. Metadata only, no file upload, no Drive changes.',
    'Always ground first: call list_tasks and list_milestones before resolving a title to an ID.',
    'Resolve people via list_profiles before setting assignee_id.',
    'If a title is ambiguous or missing, ask back in chat instead of guessing.',
    'Keep replies short, English, no parentheticals.',
    'Reply with one short line only. Do not list changes yourself; the app appends a change log with links.',
    grounding,
  ].join('\n')

  const chatHistory: ChatHistoryItem[] = (history ?? []).map((h) => ({
    role: h.role,
    content: h.content,
  }))

  try {
    const { reply, toolCalls } = await runGeminiWithTools({
      systemPrompt,
      message,
      history: chatHistory,
      onToolCall: async (name, args) => {
        switch (name) {
          case 'list_projects': {
            return getAllProjectsForNav()
          }
          case 'list_profiles': {
            return getProfiles()
          }
          case 'get_project': {
            const id = String((args.projectId as string) ?? '')
            const nav = await getAllProjectsForNav()
            return nav.find((p) => p.id === id) ?? null
          }
          case 'list_tasks': {
            return getTasksByProjectId(projectId as string)
          }
          case 'list_milestones': {
            return getMilestonesByProjectId(projectId as string)
          }
          case 'create_task': {
            const parsed = CreateTaskSchema.safeParse({
              ...args,
              project_id: (args.project_id as string) ?? projectId,
            })
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return createTask(parsed.data)
          }
          case 'update_task': {
            const parsed = UpdateTaskSchema.safeParse({
              ...args,
              projectId: (args.projectId as string) ?? projectId,
            })
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            const { taskId, projectId: pid, ...fields } = parsed.data
            return updateTask(taskId, pid ?? (projectId as string), fields)
          }
          case 'update_task_status': {
            const parsed = UpdateTaskStatusSchema.safeParse({
              ...args,
              projectId: (args.projectId as string) ?? projectId,
            })
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return updateTaskStatus(
              parsed.data.taskId,
              parsed.data.projectId ?? (projectId as string),
              parsed.data.newStatus
            )
          }
          case 'create_subtask': {
            const parsed = CreateSubtaskSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return createSubtask(parsed.data.taskId, parsed.data.title, projectId as string)
          }
          case 'create_milestone': {
            const parsed = CreateMilestoneSchema.safeParse({
              ...args,
              project_id: (args.project_id as string) ?? projectId,
            })
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return createMilestone(parsed.data)
          }
          case 'update_milestone': {
            const parsed = UpdateMilestoneSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            const { milestoneId, projectId: pid, ...fields } = parsed.data
            return updateMilestone(milestoneId, pid ?? (projectId as string), fields)
          }
          case 'delete_milestone': {
            const parsed = DeleteMilestoneSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return deleteMilestone(parsed.data.milestoneId, projectId as string)
          }
          case 'delete_task': {
            const parsed = DeleteTaskSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return deleteTask(parsed.data.taskId, projectId as string)
          }
          case 'update_subtask_status': {
            const parsed = UpdateSubtaskStatusSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return updateSubtaskStatus(parsed.data.subtaskId, parsed.data.status, projectId as string)
          }
          case 'update_subtask_title': {
            const parsed = UpdateSubtaskTitleSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return updateSubtaskTitle(parsed.data.subtaskId, parsed.data.title, projectId as string)
          }
          case 'delete_subtask': {
            const parsed = DeleteSubtaskSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return deleteSubtask(parsed.data.subtaskId, projectId as string)
          }
          case 'create_project': {
            const parsed = CreateProjectSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return createProject({
              name: parsed.data.name,
              slug: parsed.data.slug,
              type: parsed.data.type,
              start_date: parsed.data.start_date,
              deadline: parsed.data.deadline,
              description: parsed.data.description,
            })
          }
          case 'update_project': {
            const parsed = UpdateProjectSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            const { projectId: pid, ...fields } = parsed.data
            return updateProject(pid, fields)
          }
          case 'archive_project': {
            const parsed = ArchiveProjectSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return archiveProject(parsed.data.projectId)
          }
          case 'list_assets': {
            return getAssetsByProjectId(projectId as string)
          }
          case 'create_asset': {
            const parsed = CreateAssetSchema.safeParse({
              ...args,
              project_id: (args.project_id as string) ?? projectId,
            })
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            const form = new FormData()
            form.set('projectId', parsed.data.project_id)
            form.set('name', parsed.data.name)
            form.set('type', parsed.data.type)
            if (parsed.data.task_id) form.set('taskId', parsed.data.task_id)
            form.set('status', parsed.data.status ?? 'todo')
            form.set('needsCredit', String(parsed.data.needs_credit ?? false))
            if (parsed.data.notes) form.set('notes', parsed.data.notes)
            return createAsset(form)
          }
          case 'update_asset_status': {
            const parsed = UpdateAssetStatusSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return updateAssetStatus(parsed.data.assetId, projectId as string, parsed.data.status)
          }
          case 'delete_asset': {
            const parsed = DeleteAssetSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return deleteAsset(parsed.data.assetId, projectId as string)
          }
          case 'list_bundles': {
            return getAssetBundlesByProjectId(projectId as string)
          }
          case 'list_credits': {
            return getCreditsByProjectId(projectId as string)
          }
          case 'create_credit': {
            const parsed = CreateCreditSchema.safeParse({
              ...args,
              project_id: (args.project_id as string) ?? projectId,
            })
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            const form = new FormData()
            form.set('projectId', parsed.data.project_id)
            form.set('source_name', parsed.data.source_name)
            if (parsed.data.author) form.set('author', parsed.data.author)
            form.set('license', parsed.data.license)
            if (parsed.data.source_url) form.set('source_url', parsed.data.source_url)
            if (parsed.data.notes) form.set('notes', parsed.data.notes)
            if (parsed.data.asset_id) form.set('asset_id', parsed.data.asset_id)
            return createCredit(form)
          }
          case 'delete_credit': {
            const parsed = DeleteCreditSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return deleteCredit(parsed.data.creditId, projectId as string)
          }
          case 'export_credits': {
            const parsed = ExportCreditsSchema.safeParse({
              projectId: (args.projectId as string) ?? projectId,
            })
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return exportCreditsMarkdown(parsed.data.projectId)
          }
          case 'list_artifacts': {
            return getArtifactLinksByProjectId(projectId as string)
          }
          case 'create_artifact': {
            const parsed = CreateArtifactSchema.safeParse({
              ...args,
              project_id: (args.project_id as string) ?? projectId,
            })
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            const form = new FormData()
            form.set('projectId', parsed.data.project_id)
            form.set('label', parsed.data.label)
            form.set('type', parsed.data.type)
            form.set('url', parsed.data.url)
            if (parsed.data.notes) form.set('notes', parsed.data.notes)
            return createArtifactLink(form)
          }
          case 'delete_artifact': {
            const parsed = DeleteArtifactSchema.safeParse(args)
            if (!parsed.success) return { error: parsed.error.issues[0]?.message }
            return deleteArtifactLink(parsed.data.artifactId, projectId as string)
          }
          default:
            return { error: `Unknown tool: ${name}` }
        }
      },
    })

    const changeLog = slug ? buildChangeLog(slug, toolCalls) : ''
    return { success: true, reply: changeLog ? `${reply}\n\n${changeLog}` : reply }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Assistant failed'
    return { error: msg }
  }
}
