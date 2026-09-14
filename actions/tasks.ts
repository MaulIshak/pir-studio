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
})

export type TaskInput = z.infer<typeof TaskSchema>

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

  revalidatePath(`/projects/${input.project_id}`)
  revalidatePath(`/projects/${input.project_id}/tasks`)

  return { success: true, task: data }
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
    .select('*, profiles:assignee_id(id, name, avatar_url), milestones:milestone_id(id, title)')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/tasks`)

  return { success: true, task: data }
}

export async function updateTask(
  taskId: string,
  projectId: string,
  input: Partial<TaskInput>
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...input,
    })
    .eq('id', taskId)
    .select('*, profiles:assignee_id(id, name, avatar_url), milestones:milestone_id(id, title)')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/tasks`)

  return { success: true, task: data }
}

export async function deleteTask(taskId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/tasks`)

  return { success: true }
}

export async function getTasksByProjectId(projectId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*, profiles:assignee_id(id, name, avatar_url), milestones:milestone_id(id, title)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    return []
  }

  return data ?? []
}
