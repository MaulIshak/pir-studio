'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { provisionProjectFolders } from '@/lib/gdrive/provisioning'
import { z } from 'zod'

const ProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  type: z.enum(['jam', 'competition', 'internal']),
  start_date: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export type ProjectInput = z.infer<typeof ProjectSchema>

export async function createProject(input: ProjectInput) {
  const validated = ProjectSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Insert row into database
  const { data: project, error: dbError } = await supabase
    .from('projects')
    .insert({
      name: validated.data.name,
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

export async function getProjectById(projectId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*, tasks(id, status), milestones(id, status)')
    .eq('id', projectId)
    .single()

  if (error) {
    return null
  }

  return data
}

export async function updateProject(projectId: string, input: Partial<ProjectInput> & { status?: 'active' | 'completed' | 'archived' }) {
  const supabase = await createClient()

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
  revalidatePath(`/projects/${projectId}`)

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
    revalidatePath(`/projects/${projectId}`)

    return { success: true, driveFolderId }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Drive provisioning retry failed'
    return { error: message }
  }
}
