'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { uploadFileToSubfolder } from '@/lib/gdrive/upload'
import { getGoogleDriveClient } from '@/lib/gdrive/client'

function revalidateProjectAssets(projectId: string) {
  revalidatePath('/projects/[slug]', 'layout')
  revalidatePath('/projects')
  revalidatePath('/')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/assets`)
}

export type AssetStatus = 'todo' | 'in_progress' | 'done' | 'implemented'
export type AssetType = 'sprite' | 'audio' | '3d_model' | 'font' | 'vfx' | 'other'

export interface AssetReference {
  id: string
  asset_id: string
  drive_file_id: string
  file_name: string | null
  file_size?: number | null
  mime_type?: string | null
  created_at: string
}

export interface AssetBundle {
  id: string
  project_id: string
  name: string
  drive_file_id: string
  file_name: string | null
  file_size?: number | null
  mime_type?: string | null
  uploaded_by: string | null
  created_at: string
  profiles?: {
    name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

export interface Asset {
  id: string
  project_id: string
  task_id: string | null
  name: string
  type: AssetType
  uploaded_by: string | null
  drive_file_id: string | null
  bundle_id: string | null
  file_name: string | null
  status: AssetStatus
  needs_credit: boolean
  notes: string | null
  created_at: string
  profiles?: {
    name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  tasks?: {
    id: string
    title: string
    status: string
  } | null
  asset_bundles?: {
    id: string
    name: string
    drive_file_id: string
    file_name: string | null
  } | null
  asset_references?: AssetReference[]
}

const createAssetSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  name: z.string().min(1, 'Asset name is required').max(100),
  type: z.enum(['sprite', 'audio', '3d_model', 'font', 'vfx', 'other']),
  taskId: z.string().uuid().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done', 'implemented']).default('todo'),
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
      ),
      tasks:task_id (
        id,
        title,
        status
      ),
      asset_bundles:bundle_id (
        id,
        name,
        drive_file_id,
        file_name
      ),
      asset_references (
        id,
        asset_id,
        drive_file_id,
        file_name,
        created_at
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    // If schema cache / foreign key relationship not found (migration pending on Supabase)
    if (error.code === 'PGRST200') {
      console.warn(
        'Supabase schema migration pending. Querying base assets. Please run migration 20260914000001_revamp_assets_feature.sql in Supabase SQL Editor.'
      )
      const fallback = await supabase
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

      if (fallback.error) {
        console.error('Error fetching assets (fallback):', fallback.error.message || fallback.error)
        return []
      }

      return (fallback.data as unknown as Asset[]) ?? []
    }

    console.error('Error fetching assets:', error.message || error)
    return []
  }

  return (data as unknown as Asset[]) ?? []
}

export async function checkAssetsMigrationStatus(): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('assets').select('task_id').limit(1)
  return !error
}

export async function getAssetById(assetId: string): Promise<Asset | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assets')
    .select(`
      *,
      profiles:uploaded_by (
        name,
        email,
        avatar_url
      ),
      tasks:task_id (
        id,
        title,
        status
      ),
      asset_bundles:bundle_id (
        id,
        name,
        drive_file_id,
        file_name
      ),
      asset_references (
        id,
        asset_id,
        drive_file_id,
        file_name,
        created_at
      )
    `)
    .eq('id', assetId)
    .single()

  if (error || !data) {
    if (error?.code === 'PGRST200') {
      const fallback = await supabase
        .from('assets')
        .select(`
          *,
          profiles:uploaded_by (
            name,
            email,
            avatar_url
          )
        `)
        .eq('id', assetId)
        .single()
      if (fallback.error || !fallback.data) return null
      return fallback.data as unknown as Asset
    }
    return null
  }

  return data as unknown as Asset
}

export async function getAssetBundlesByProjectId(projectId: string): Promise<AssetBundle[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('asset_bundles')
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
    console.error('Error fetching asset bundles:', error)
    return []
  }

  return (data as unknown as AssetBundle[]) ?? []
}

export async function createAsset(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const rawTaskId = formData.get('taskId') as string
  const rawStatus = (formData.get('status') as string) || 'todo'

  const rawData = {
    projectId: formData.get('projectId') as string,
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    taskId: rawTaskId && rawTaskId !== 'none' ? rawTaskId : null,
    status: rawStatus as AssetStatus,
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

  const { projectId, name, type, taskId, status, needsCredit, notes } = parseResult.data

  // Retrieve project for Drive folder provisioning check
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('drive_folder_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Project not found' }
  }

  let driveFileId: string | null = null
  let fileName: string | null = null
  let finalStatus: AssetStatus = status

  const file = formData.get('file') as File | null

  // 1. Optional Asset File Upload (Individual file)
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
      fileName = file.name
      if (finalStatus === 'todo') {
        finalStatus = 'done'
      }
    } catch (err: unknown) {
      console.error('Failed to upload file to Google Drive:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to upload file to Google Drive',
      }
    }
  }

  // 2. Insert Asset Deliverable Record
  const { data: assetData, error: insertError } = await supabase
    .from('assets')
    .insert({
      project_id: projectId,
      task_id: taskId,
      name,
      type,
      uploaded_by: user?.id ?? null,
      drive_file_id: driveFileId,
      file_name: fileName,
      status: finalStatus,
      needs_credit: needsCredit,
      notes: notes || null,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error inserting asset:', insertError)
    return { success: false, error: insertError.message }
  }

  // 3. Upload Reference Images (if any)
  const referenceFiles = formData.getAll('reference_files') as File[]
  const validRefFiles = referenceFiles.filter((f) => f && f.size > 0)

  if (validRefFiles.length > 0) {
    if (project.drive_folder_id && user) {
      for (const refFile of validRefFiles) {
        try {
          const buffer = Buffer.from(await refFile.arrayBuffer())
          const uploadRes = await uploadFileToSubfolder(
            user.id,
            project.drive_folder_id,
            'Design',
            refFile.name || `reference_${Date.now()}.png`,
            refFile.type || 'image/png',
            buffer
          )

          await supabase.from('asset_references').insert({
            asset_id: assetData.id,
            drive_file_id: uploadRes.fileId,
            file_name: refFile.name,
            file_size: refFile.size,
            mime_type: refFile.type,
            uploaded_by: user.id,
          })
        } catch (refErr) {
          console.warn('Failed to upload reference image:', refErr)
        }
      }
    }
  }

  // 4. Auto-Insert linked credit if requested
  const creditSourceName = (formData.get('credit_source_name') as string)?.trim()
  if (needsCredit && creditSourceName) {
    const creditAuthor = (formData.get('credit_author') as string)?.trim() || null
    const creditLicense = (formData.get('credit_license') as string) || 'cc0'
    const creditSourceUrl = (formData.get('credit_source_url') as string)?.trim() || null
    const creditNotes = (formData.get('credit_notes') as string)?.trim() || null

    const { error: creditError } = await supabase.from('credits').insert({
      project_id: projectId,
      asset_id: assetData.id,
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

  revalidateProjectAssets(projectId)
  return { success: true, data: assetData }
}

export async function uploadSingleAssetFile(
  assetId: string,
  projectId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided' }
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('drive_folder_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project || !project.drive_folder_id) {
    return { success: false, error: 'Google Drive folder not found for this project' }
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

    const { error: updateError } = await supabase
      .from('assets')
      .update({
        drive_file_id: uploadRes.fileId,
        file_name: file.name,
        uploaded_by: user.id,
        status: 'done',
      })
      .eq('id', assetId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidateProjectAssets(projectId)
    return { success: true, fileId: uploadRes.fileId }
  } catch (err: unknown) {
    console.error('Failed to upload single asset file:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload to Google Drive failed',
    }
  }
}

export async function uploadAssetBundle(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const name = (formData.get('name') as string)?.trim()
  if (!name) {
    return { success: false, error: 'Atlas / Bundle name is required' }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { success: false, error: 'File is required' }
  }

  const rawAssetIds = formData.getAll('asset_ids') as string[]
  if (rawAssetIds.length === 0) {
    return { success: false, error: 'Please select at least one asset to include in this bundle' }
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('drive_folder_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project || !project.drive_folder_id) {
    return { success: false, error: 'Google Drive folder not configured for this project' }
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

    // 1. Insert into asset_bundles table
    const { data: bundleData, error: bundleError } = await supabase
      .from('asset_bundles')
      .insert({
        project_id: projectId,
        name,
        drive_file_id: uploadRes.fileId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (bundleError || !bundleData) {
      return { success: false, error: bundleError?.message || 'Failed to record bundle' }
    }

    // 2. Associate all selected assets with this bundle & mark status as done
    const { error: updateAssetsError } = await supabase
      .from('assets')
      .update({
        bundle_id: bundleData.id,
        drive_file_id: uploadRes.fileId,
        file_name: file.name,
        uploaded_by: user.id,
        status: 'done',
      })
      .in('id', rawAssetIds)

    if (updateAssetsError) {
      console.error('Failed to link assets to bundle:', updateAssetsError)
      return { success: false, error: updateAssetsError.message }
    }

    revalidateProjectAssets(projectId)
    return { success: true, bundle: bundleData }
  } catch (err: unknown) {
    console.error('Failed to upload atlas/bundle:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Bundle upload failed',
    }
  }
}

export async function addAssetReferences(
  assetId: string,
  projectId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('drive_folder_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project || !project.drive_folder_id) {
    return { success: false, error: 'Google Drive folder not configured' }
  }

  const files = formData.getAll('reference_files') as File[]
  const validFiles = files.filter((f) => f && f.size > 0)

  if (validFiles.length === 0) {
    return { success: false, error: 'No reference images provided' }
  }

  try {
    for (const refFile of validFiles) {
      const buffer = Buffer.from(await refFile.arrayBuffer())
      const uploadRes = await uploadFileToSubfolder(
        user.id,
        project.drive_folder_id,
        'Design',
        refFile.name || `reference_${Date.now()}.png`,
        refFile.type || 'image/png',
        buffer
      )

      await supabase.from('asset_references').insert({
        asset_id: assetId,
        drive_file_id: uploadRes.fileId,
        file_name: refFile.name,
        file_size: refFile.size,
        mime_type: refFile.type,
        uploaded_by: user.id,
      })
    }

    const { data: updatedReferences } = await supabase
      .from('asset_references')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })

    revalidateProjectAssets(projectId)
    return {
      success: true,
      references: (updatedReferences as unknown as AssetReference[]) || [],
    }
  } catch (err: unknown) {
    console.error('Failed to upload reference images:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload references',
    }
  }
}

export async function deleteAssetReference(
  referenceId: string,
  driveFileId: string,
  projectId: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. Hard Delete from Supabase Postgres
  const { error: deleteError } = await supabase
    .from('asset_references')
    .delete()
    .eq('id', referenceId)

  if (deleteError) {
    console.error('Failed to delete asset reference row:', deleteError)
    return { success: false, error: deleteError.message }
  }

  // 2. Best-effort hard delete in Google Drive
  if (user && driveFileId) {
    try {
      const drive = await getGoogleDriveClient(user.id)
      await drive.files.delete({ fileId: driveFileId })
    } catch (driveErr) {
      console.warn('Drive file deletion note (best effort):', driveErr)
    }
  }

  revalidateProjectAssets(projectId)
  return { success: true }
}

export async function updateAssetStatus(
  assetId: string,
  projectId: string,
  status: AssetStatus
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

  revalidateProjectAssets(projectId)
  return { success: true }
}

export async function updateAsset(
  assetId: string,
  projectId: string,
  input: {
    name?: string
    type?: AssetType
    taskId?: string | null
    status?: AssetStatus
    needsCredit?: boolean
    notes?: string | null
  }
) {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.type !== undefined) updateData.type = input.type
  if (input.taskId !== undefined) {
    updateData.task_id = input.taskId === 'none' ? null : input.taskId
  }
  if (input.status !== undefined) updateData.status = input.status
  if (input.needsCredit !== undefined) updateData.needs_credit = input.needsCredit
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null

  const { data, error } = await supabase
    .from('assets')
    .update(updateData)
    .eq('id', assetId)
    .select(`
      *,
      profiles:uploaded_by (
        name,
        email,
        avatar_url
      ),
      tasks:task_id (
        id,
        title,
        status
      ),
      asset_bundles:bundle_id (
        id,
        name,
        drive_file_id,
        file_name
      ),
      asset_references (
        id,
        asset_id,
        drive_file_id,
        file_name,
        created_at
      )
    `)
    .single()

  if (error) {
    console.error('Error updating asset:', error)
    return { success: false, error: error.message }
  }

  revalidateProjectAssets(projectId)
  return { success: true, data: data as unknown as Asset }
}

export async function deleteAsset(assetId: string, projectId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('assets').delete().eq('id', assetId)

  if (error) {
    console.error('Error deleting asset:', error)
    return { success: false, error: error.message }
  }


  revalidateProjectAssets(projectId)
  return { success: true }
}

