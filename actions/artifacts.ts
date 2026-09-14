'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { uploadFileToSubfolder } from '@/lib/gdrive/upload'

export interface ArtifactLink {
  id: string
  project_id: string
  label: string
  type: 'figma' | 'figjam' | 'gdd' | 'build' | 'other'
  url: string
  notes: string | null
  created_at: string
}

const createArtifactLinkSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  label: z.string().min(1, 'Label is required').max(100),
  type: z.enum(['figma', 'figjam', 'gdd', 'build', 'other']),
  url: z.string().url('A valid URL is required'),
  notes: z.string().max(500).optional().nullable(),
})

export async function getArtifactLinksByProjectId(projectId: string): Promise<ArtifactLink[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('artifact_links')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching artifact links:', error)
    return []
  }

  return (data as ArtifactLink[]) ?? []
}

export async function createArtifactLink(formData: FormData) {
  const supabase = await createClient()

  const rawData = {
    projectId: formData.get('projectId') as string,
    label: formData.get('label') as string,
    type: formData.get('type') as string,
    url: formData.get('url') as string,
    notes: (formData.get('notes') as string) || null,
  }

  const parseResult = createArtifactLinkSchema.safeParse(rawData)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || 'Invalid link data',
    }
  }

  const { projectId, label, type, url, notes } = parseResult.data

  const { data, error } = await supabase
    .from('artifact_links')
    .insert({
      project_id: projectId,
      label,
      type,
      url,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error inserting artifact link:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/projects/${projectId}/artifacts`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data }
}

export async function uploadArtifactFile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const projectId = formData.get('projectId') as string
  const label = (formData.get('label') as string)?.trim()
  const targetType = formData.get('type') as 'build' | 'gdd'
  const file = formData.get('file') as File | null

  if (!projectId) {
    return { success: false, error: 'Project ID is required' }
  }

  if (!file || file.size === 0) {
    return { success: false, error: 'File is required' }
  }

  if (targetType !== 'build' && targetType !== 'gdd') {
    return { success: false, error: 'Target type must be Build or GDD' }
  }

  // Fetch project to retrieve drive_folder_id
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('drive_folder_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Project not found' }
  }

  if (!project.drive_folder_id) {
    return {
      success: false,
      error: 'Project Google Drive folder is not connected. Retry Drive provisioning first.',
    }
  }

  if (!user) {
    return {
      success: false,
      error: 'Authentication is required to upload files to Google Drive.',
    }
  }

  const subfolderName = targetType === 'build' ? 'Builds' : 'GDD'

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadRes = await uploadFileToSubfolder(
      user.id,
      project.drive_folder_id,
      subfolderName,
      file.name,
      file.type,
      buffer
    )

    const finalLabel = label || file.name

    const { data, error } = await supabase
      .from('artifact_links')
      .insert({
        project_id: projectId,
        label: finalLabel,
        type: targetType,
        url: uploadRes.viewUrl,
        notes: `Uploaded to Drive /${subfolderName}/: ${file.name}`,
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath(`/projects/${projectId}/artifacts`)
    revalidatePath(`/projects/${projectId}`)
    return { success: true, data }
  } catch (err: unknown) {
    console.error('Failed to upload artifact file:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload file to Google Drive',
    }
  }
}

export async function deleteArtifactLink(linkId: string, projectId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('artifact_links')
    .delete()
    .eq('id', linkId)

  if (error) {
    console.error('Error deleting artifact link:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/projects/${projectId}/artifacts`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
