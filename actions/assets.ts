'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { uploadFileToSubfolder } from '@/lib/gdrive/upload'

export interface Asset {
  id: string
  project_id: string
  name: string
  type: 'sprite' | 'audio' | '3d_model' | 'font' | 'vfx' | 'other'
  uploaded_by: string | null
  drive_file_id: string | null
  status: 'received' | 'review' | 'integrated' | 'rejected'
  needs_credit: boolean
  notes: string | null
  created_at: string
  profiles?: {
    name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

const createAssetSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  name: z.string().min(1, 'Asset name is required').max(100),
  type: z.enum(['sprite', 'audio', '3d_model', 'font', 'vfx', 'other']),
  needsCredit: z.boolean().default(false),
  notes: z.string().max(500).optional().nullable(),
})

export async function getAssetsByProjectId(projectId: string): Promise<Asset[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assets')
    .select(`
      *,
      profiles:uploaded_by (
        name,
        email,
        avatar_url
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching assets:', error)
    return []
  }

  return (data as unknown as Asset[]) ?? []
}

export async function createAsset(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rawData = {
    projectId: formData.get('projectId') as string,
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    needsCredit: formData.get('needsCredit') === 'true' || formData.get('needsCredit') === 'on',
    notes: (formData.get('notes') as string) || null,
  }

  const parseResult = createAssetSchema.safeParse(rawData)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || 'Invalid asset data',
    }
  }

  const { projectId, name, type, needsCredit, notes } = parseResult.data

  // Fetch project to retrieve drive_folder_id
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('drive_folder_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Project not found' }
  }

  let driveFileId: string | null = null
  const file = formData.get('file') as File | null

  if (file && file.size > 0) {
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

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const uploadRes = await uploadFileToSubfolder(
        user.id,
        project.drive_folder_id,
        'Assets',
        file.name,
        file.type,
        buffer
      )
      driveFileId = uploadRes.fileId
    } catch (err: unknown) {
      console.error('Failed to upload file to Google Drive:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to upload file to Google Drive',
      }
    }
  }

  const { data, error } = await supabase
    .from('assets')
    .insert({
      project_id: projectId,
      name,
      type,
      uploaded_by: user?.id ?? null,
      drive_file_id: driveFileId,
      status: 'received',
      needs_credit: needsCredit,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error inserting asset:', error)
    return { success: false, error: error.message }
  }

  // If credit info was provided, automatically record it in credits table
  const creditSourceName = (formData.get('credit_source_name') as string)?.trim()
  if (needsCredit && creditSourceName) {
    const creditAuthor = (formData.get('credit_author') as string)?.trim() || null
    const creditLicense = (formData.get('credit_license') as string) || 'cc0'
    const creditSourceUrl = (formData.get('credit_source_url') as string)?.trim() || null
    const creditNotes = (formData.get('credit_notes') as string)?.trim() || null

    const { error: creditError } = await supabase.from('credits').insert({
      project_id: projectId,
      asset_id: data.id,
      source_name: creditSourceName,
      author: creditAuthor,
      license: creditLicense,
      source_url: creditSourceUrl,
      notes: creditNotes,
    })

    if (creditError) {
      console.warn('Failed to auto-insert linked credit:', creditError)
    } else {
      revalidatePath(`/projects/${projectId}/credits`)
    }
  }

  revalidatePath(`/projects/${projectId}/assets`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data }
}

export async function updateAssetStatus(
  assetId: string,
  projectId: string,
  status: 'received' | 'review' | 'integrated' | 'rejected'
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('assets')
    .update({ status })
    .eq('id', assetId)

  if (error) {
    console.error('Error updating asset status:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/projects/${projectId}/assets`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function deleteAsset(assetId: string, projectId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)

  if (error) {
    console.error('Error deleting asset:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/projects/${projectId}/assets`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
