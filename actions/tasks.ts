'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const TaskSchema = z.object({
  project_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(150),
  description: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).default('todo'),
  due_date: z.string().optional().nullable(),
  subtasks: z.array(z.string().min(1)).optional(),
})

export type TaskInput = z.infer<typeof TaskSchema>

export interface SubtaskItem {
  id: string
  task_id: string
  title: string
  status: 'todo' | 'done'
  position?: number
  created_at?: string
}

export async function createTask(input: TaskInput) {
  const validated = TaskSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: validated.data.project_id,
      milestone_id: validated.data.milestone_id || null,
      title: validated.data.title,
      description: validated.data.description || null,
      assignee_id: validated.data.assignee_id || null,
      status: validated.data.status,
      due_date: validated.data.due_date || null,
    })
    .select('*, profiles:assignee_id(id, name, avatar_url), milestones:milestone_id(id, title)')
    .single()

  if (error) {
    return { error: error.message }
  }

  // If subtasks were provided, insert them
  let createdSubtasks: SubtaskItem[] = []
  if (validated.data.subtasks && validated.data.subtasks.length > 0) {
    const subtaskRows = validated.data.subtasks.map((stTitle, index) => ({
      task_id: data.id,
      title: stTitle.trim(),
      status: 'todo' as const,
      position: index,
    }))
    const { data: insertedSubtasks, error: subtaskError } = await supabase
      .from('subtasks')
      .insert(subtaskRows)
      .select()

    if (!subtaskError && insertedSubtasks) {
      createdSubtasks = insertedSubtasks as SubtaskItem[]
    }
  }

  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return {
    success: true,
    task: {
      ...data,
      subtasks: createdSubtasks,
    },
  }
}

export async function updateTaskStatus(
  taskId: string,
  projectId: string,
  newStatus: 'todo' | 'in_progress' | 'review' | 'done'
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId)
    .select('*, profiles:assignee_id(id, name, avatar_url), milestones:milestone_id(id, title), subtasks(*)')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true, task: data }
}

export async function updateTask(
  taskId: string,
  projectId: string,
  input: {
    title?: string
    description?: string | null
    status?: 'todo' | 'in_progress' | 'review' | 'done'
    milestone_id?: string | null
    assignee_id?: string | null
    due_date?: string | null
  }
) {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (input.title !== undefined) updateData.title = input.title.trim()
  if (input.description !== undefined) updateData.description = input.description?.trim() || null
  if (input.status !== undefined) updateData.status = input.status
  if (input.milestone_id !== undefined) updateData.milestone_id = input.milestone_id === 'none' ? null : input.milestone_id
  if (input.assignee_id !== undefined) updateData.assignee_id = input.assignee_id === 'none' ? null : input.assignee_id
  if (input.due_date !== undefined) updateData.due_date = input.due_date || null

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select('*, profiles:assignee_id(id, name, avatar_url), milestones:milestone_id(id, title), subtasks(*)')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true, task: data }
}

export async function deleteTask(taskId: string, _projectId?: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true }
}

import type { TaskItem } from '@/components/tasks/task-card'

interface SubtaskSortItem {
  created_at?: string
  position?: number
  [key: string]: unknown
}

interface TaskWithSubtasksRecord {
  id: string
  title: string
  subtasks?: SubtaskSortItem[]
  [key: string]: unknown
}

export async function getTasksByProjectId(projectId: string): Promise<TaskItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      profiles:assignee_id(id, name, avatar_url),
      milestones:milestone_id(id, title),
      subtasks(id, task_id, title, status, created_at, position)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getTasksByProjectId error, falling back:', error)
    const fallback = await supabase
      .from('tasks')
      .select('*, profiles:assignee_id(id, name, avatar_url), milestones:milestone_id(id, title), subtasks(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (!fallback.error && fallback.data) {
      return ((fallback.data as unknown as TaskWithSubtasksRecord[]).map((t) => ({
        ...t,
        subtasks: (t.subtasks || []).sort(
          (a: SubtaskSortItem, b: SubtaskSortItem) => {
            if (a.position !== undefined && b.position !== undefined && a.position !== b.position) {
              return a.position - b.position
            }
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          }
        ),
      })) as unknown as TaskItem[])
    }

    const basicFallback = await supabase
      .from('tasks')
      .select('*, profiles:assignee_id(id, name, avatar_url), milestones:milestone_id(id, title)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    return (((basicFallback.data as unknown as TaskWithSubtasksRecord[]) ?? []).map((t) => ({
      ...t,
      subtasks: [],
    })) as unknown as TaskItem[])
  }

  const formatted = ((data as unknown as TaskWithSubtasksRecord[]) ?? []).map((t) => ({
    ...t,
    subtasks: (t.subtasks || []).sort(
      (a: SubtaskSortItem, b: SubtaskSortItem) => {
        if (a.position !== undefined && b.position !== undefined && a.position !== b.position) {
          return a.position - b.position
        }
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      }
    ),
  }))

  return (formatted as unknown as TaskItem[])
}

export async function createSubtask(taskId: string, title: string, _projectId?: string) {
  if (!title.trim()) {
    return { error: 'Subtask title is required' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subtasks')
    .insert({
      task_id: taskId,
      title: title.trim(),
      status: 'todo',
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true, subtask: data as SubtaskItem }
}

export async function updateSubtaskStatus(
  subtaskId: string,
  status: 'todo' | 'done',
  _projectId?: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subtasks')
    .update({ status })
    .eq('id', subtaskId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true, subtask: data as SubtaskItem }
}

export async function updateSubtaskTitle(
  subtaskId: string,
  title: string,
  _projectId?: string
) {
  if (!title.trim()) {
    return { error: 'Title is required' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subtasks')
    .update({ title: title.trim() })
    .eq('id', subtaskId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]', 'layout')
  return { success: true, subtask: data as SubtaskItem }
}

export async function deleteSubtask(subtaskId: string, _projectId?: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('subtasks').delete().eq('id', subtaskId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true }
}

export async function getProfiles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url')
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to get profiles:', error)
    return []
  }

  return data ?? []
}

