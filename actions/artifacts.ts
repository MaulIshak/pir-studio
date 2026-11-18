'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  deleteFileFromStorage,
  extractStorageKeyFromUrl,
  uploadFileToStorage,
} from '@/lib/storage/s3'

function revalidateArtifacts(projectId: string) {
  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')
  revalidatePath(`/projects/${projectId}/artifacts`)
  revalidatePath(`/projects/${projectId}`)
}

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

  revalidateArtifacts(projectId)
  return { success: true, data }
}

export async function uploadArtifactFile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const projectId = formData.get('projectId') as string
  const label = (formData.get('label') as string)?.trim()
  const targetType = formData.get('type') as 'build' | 'gdd'
  const file = formData.get('file') as File | null

  if (!projectId) {
    return { success: false, error: 'Project ID is required' }
  }

  if (!label) {
    return { success: false, error: 'Label is required' }
  }

  if (!file || file.size === 0) {
    return { success: false, error: 'File is required' }
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Project not found' }
  }

  try {
    const folder = targetType === 'build' ? 'builds' : 'gdd'
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadRes = await uploadFileToStorage({
      projectId,
      folder,
      fileName: file.name,
      mimeType: file.type,
      buffer,
    })

    const { data, error } = await supabase
      .from('artifact_links')
      .insert({
        project_id: projectId,
        label,
        type: targetType,
        url: uploadRes.fileUrl,
        notes: `Uploaded file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
      })
      .select()
      .single()

    if (error) {
      try {
        await deleteFileFromStorage(uploadRes.storageKey)
      } catch {
        // best-effort cleanup
      }
      return { success: false, error: error.message }
    }

    revalidateArtifacts(projectId)
    return { success: true, data }
  } catch (err: unknown) {
    console.error('Failed to upload artifact file:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload file to storage',
    }
  }
}

export async function deleteArtifactLink(linkId: string, projectId: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('artifact_links')
    .select('url')
    .eq('id', linkId)
    .maybeSingle()

  const { error } = await supabase
    .from('artifact_links')
    .delete()
    .eq('id', linkId)

  if (error) {
    console.error('Error deleting artifact link:', error)
    return { success: false, error: error.message }
  }

  const storageKey = existing?.url ? extractStorageKeyFromUrl(existing.url) : null
  if (storageKey) {
    try {
      await deleteFileFromStorage(storageKey)
    } catch (storageErr) {
      console.warn('S3 artifact deletion note (best effort):', storageErr)
    }
  }

  revalidateArtifacts(projectId)
  return { success: true }
}
