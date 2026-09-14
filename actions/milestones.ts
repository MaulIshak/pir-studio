'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const MilestoneSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(100),
  due_date: z.string().optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'done']).default('not_started'),
})

export type MilestoneInput = z.infer<typeof MilestoneSchema>

export async function createMilestone(input: MilestoneInput) {
  const validated = MilestoneSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .insert({
      project_id: validated.data.project_id,
      title: validated.data.title,
      due_date: validated.data.due_date || null,
      status: validated.data.status,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${input.project_id}`)
  revalidatePath(`/projects/${input.project_id}/milestones`)

  return { success: true, milestone: data }
}

export async function updateMilestone(
  milestoneId: string,
  projectId: string,
  input: Partial<MilestoneInput>
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .update({
      ...input,
    })
    .eq('id', milestoneId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/milestones`)

  return { success: true, milestone: data }
}

export async function deleteMilestone(milestoneId: string, projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('milestones').delete().eq('id', milestoneId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/milestones`)

  return { success: true }
}

export async function getMilestonesByProjectId(projectId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .select('*, tasks(id, status)')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) {
    return []
  }

  return data ?? []
}
