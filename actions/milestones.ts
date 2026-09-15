'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const MilestoneSchema = z
  .object({
    project_id: z.string().uuid(),
    title: z.string().min(1, 'Title is required').max(100),
    start_date: z.string().optional().nullable(),
    due_date: z.string().optional().nullable(),
    status: z.enum(['not_started', 'in_progress', 'done']).default('not_started'),
  })
  .refine(
    (data) => {
      if (data.start_date && data.due_date) {
        return new Date(data.due_date) >= new Date(data.start_date)
      }
      return true
    },
    {
      message: 'End date must be on or after start date',
      path: ['due_date'],
    }
  )

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
      start_date: validated.data.start_date || null,
      due_date: validated.data.due_date || null,
      status: validated.data.status,
    })
    .select('*, tasks(id, status)')
    .single()

  if (error) {
    return { error: error.message }
  }

  const { data: project } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', validated.data.project_id)
    .single()

  if (project?.slug) {
    revalidatePath(`/projects/${project.slug}/milestones`)
    revalidatePath(`/projects/${project.slug}`)
  }
  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true, milestone: data }
}

export async function updateMilestone(
  milestoneId: string,
  projectId: string,
  input: Partial<MilestoneInput>
) {
  const supabase = await createClient()

  if (input.start_date && input.due_date) {
    if (new Date(input.due_date) < new Date(input.start_date)) {
      return { error: 'End date must be on or after start date' }
    }
  }

  const { data, error } = await supabase
    .from('milestones')
    .update({
      ...input,
    })
    .eq('id', milestoneId)
    .select('*, tasks(id, status)')
    .single()

  if (error) {
    return { error: error.message }
  }

  const { data: project } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', projectId)
    .single()

  if (project?.slug) {
    revalidatePath(`/projects/${project.slug}/milestones`)
    revalidatePath(`/projects/${project.slug}`)
  }
  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true, milestone: data }
}

export async function deleteMilestone(milestoneId: string, projectId?: string) {
  const supabase = await createClient()

  let projectSlug: string | null = null
  if (projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('slug')
      .eq('id', projectId)
      .single()
    projectSlug = project?.slug ?? null
  }

  const { error } = await supabase.from('milestones').delete().eq('id', milestoneId)

  if (error) {
    return { error: error.message }
  }

  if (projectSlug) {
    revalidatePath(`/projects/${projectSlug}/milestones`)
    revalidatePath(`/projects/${projectSlug}`)
  }
  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')

  return { success: true }
}

export async function getMilestonesByProjectId(projectId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .select('*, tasks(id, status)')
    .eq('project_id', projectId)
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) {
    return []
  }

  return data ?? []
}
