'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { provisionProjectFolders } from '@/lib/gdrive/provisioning'
import { slugify } from '@/lib/slug'
import { z } from 'zod'

const ProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must only contain lowercase letters, numbers, and hyphens without consecutive or trailing hyphens')
    .refine((val) => val !== 'new', 'Slug cannot be "new" (reserved keyword)'),
  type: z.enum(['jam', 'competition', 'internal']),
  start_date: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export type ProjectInput = {
  name: string
  slug?: string
  type: 'jam' | 'competition' | 'internal'
  start_date?: string | null
  deadline?: string | null
  description?: string | null
}

export async function createProject(input: ProjectInput) {
  const resolvedSlug = (input.slug?.trim() ? slugify(input.slug) : slugify(input.name)) || `project-${Date.now().toString(36)}`
  const validated = ProjectSchema.safeParse({
    ...input,
    slug: resolvedSlug,
  })

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if slug is already in use
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', validated.data.slug)
    .maybeSingle()

  if (existingProject) {
    return { error: `The slug "${validated.data.slug}" is already in use. Please choose another slug.` }
  }

  // 1. Insert row into database
  const { data: project, error: dbError } = await supabase
    .from('projects')
    .insert({
      name: validated.data.name,
      slug: validated.data.slug,
      type: validated.data.type,
      start_date: validated.data.start_date || null,
      deadline: validated.data.deadline || null,
      description: validated.data.description || null,
      created_by: user?.id ?? null,
      status: 'active',
    })
    .select()
    .single()

  if (dbError || !project) {
    return { error: dbError?.message ?? 'Failed to create project' }
  }

  // 2. Dual-write resilience: Attempt Google Drive provisioning
  let driveFolderId: string | null = null
  let driveError: string | null = null

  if (user?.id) {
    try {
      driveFolderId = await provisionProjectFolders(user.id, project.name)
      await supabase
        .from('projects')
        .update({ drive_folder_id: driveFolderId })
        .eq('id', project.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Drive provisioning failed'
      console.warn('Drive folder provisioning warning:', message)
      driveError = message
    }
  }

  revalidatePath('/')
  revalidatePath('/projects')
  revalidatePath('/projects/[slug]', 'layout')

  return {
    success: true,
    project: {
      ...project,
      drive_folder_id: driveFolderId,
    },
    driveError,
  }
}

export async function getProjects(status: 'active' | 'completed' | 'archived' = 'active') {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*, tasks(id, status)')
    .eq('status', status)
    .order('deadline', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }

  return data ?? []
}

export type NavProject = {
  id: string
  name: string
  slug: string
  type: 'jam' | 'competition' | 'internal'
  status: 'active' | 'completed' | 'archived'
}

export async function getAllProjectsForNav(): Promise<NavProject[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, slug, type, status')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching projects for navigation:', error)
    return []
  }

  // Sort active projects first
  const statusOrder: Record<string, number> = { active: 0, completed: 1, archived: 2 }
  const sorted = ((data as NavProject[]) ?? []).sort((a, b) => {
    const orderDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    if (orderDiff !== 0) return orderDiff
    return a.name.localeCompare(b.name)
  })

  return sorted
}

export async function getProjectById(projectId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*, tasks(*), milestones(*)')
    .eq('id', projectId)
    .single()

  if (error) {
    return null
  }

  return data
}

export async function getProjectBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*, tasks(*), milestones(*)')
    .eq('slug', slug)
    .single()

  if (error) {
    return null
  }

  return data
}

export async function updateProject(
  projectId: string,
  input: Partial<ProjectInput> & { status?: 'active' | 'completed' | 'archived' }
) {
  const supabase = await createClient()

  if (input.slug) {
    const cleanSlug = slugify(input.slug)
    if (cleanSlug === 'new') {
      return { error: 'Slug cannot be "new" (reserved keyword)' }
    }
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', cleanSlug)
      .neq('id', projectId)
      .maybeSingle()

    if (existing) {
      return { error: `The slug "${cleanSlug}" is already in use. Please choose another slug.` }
    }
    input.slug = cleanSlug
  }

  const { data, error } = await supabase
    .from('projects')
    .update({
      ...input,
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/projects')
  revalidatePath('/projects/[slug]', 'layout')
  if (data?.slug) {
    revalidatePath(`/projects/${data.slug}`)
  }

  return { success: true, project: data }
}

export async function archiveProject(projectId: string) {
  return updateProject(projectId, { status: 'archived' })
}

export async function retryDriveProvisioning(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.id) {
    return { error: 'Authentication required' }
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error || !project) {
    return { error: 'Project not found' }
  }

  try {
    const driveFolderId = await provisionProjectFolders(user.id, project.name)
    await supabase
      .from('projects')
      .update({ drive_folder_id: driveFolderId })
      .eq('id', projectId)

    revalidatePath('/')
    revalidatePath('/projects')
    revalidatePath('/projects/[slug]', 'layout')
    if (project.slug) {
      revalidatePath(`/projects/${project.slug}`)
    }

    return { success: true, driveFolderId }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Drive provisioning retry failed'
    return { error: message }
  }
}
