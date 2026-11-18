'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { deleteFileFromStorage, uploadFileToStorage } from '@/lib/storage/s3'

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
  storage_key: string
  file_name: string | null
  file_size?: number | null
  mime_type?: string | null
  created_at: string
}

export interface AssetBundle {
  id: string
  project_id: string
  name: string
  storage_key: string
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
  storage_key: string | null
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
    storage_key: string
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
        storage_key,
        file_name
      ),
      asset_references (
        id,
        asset_id,
        storage_key,
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
  const { error } = await supabase.from('assets').select('storage_key').limit(1)
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
        storage_key,
        file_name
      ),
      asset_references (
        id,
        asset_id,
        storage_key,
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

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Project not found' }
  }

  let storageKey: string | null = null
  let fileName: string | null = null
  let finalStatus: AssetStatus = status

  const file = formData.get('file') as File | null

  // 1. Optional Asset File Upload (Individual file)
  if (file && file.size > 0) {
    if (!user) {
      return {
        success: false,
        error: 'Authentication is required to upload files.',
      }
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const uploadRes = await uploadFileToStorage({
        projectId,
        folder: 'assets',
        fileName: file.name,
        mimeType: file.type,
        buffer,
      })
      storageKey = uploadRes.storageKey
      fileName = file.name
      if (finalStatus === 'todo') {
        finalStatus = 'done'
      }
    } catch (err: unknown) {
      console.error('Failed to upload file to storage:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to upload file to storage',
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
      storage_key: storageKey,
      file_name: fileName,
      status: finalStatus,
      needs_credit: needsCredit,
      notes: notes || null,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error inserting asset:', insertError)
    if (storageKey) {
      try {
        await deleteFileFromStorage(storageKey)
      } catch (cleanupErr) {
        console.warn('Failed to clean up orphaned S3 object:', cleanupErr)
      }
    }
    return { success: false, error: insertError.message }
  }

  // 3. Upload Reference Images (if any)
  const referenceFiles = formData.getAll('reference_files') as File[]
  const validRefFiles = referenceFiles.filter((f) => f && f.size > 0)

  if (validRefFiles.length > 0 && user) {
    for (const refFile of validRefFiles) {
      try {
        const buffer = Buffer.from(await refFile.arrayBuffer())
        const uploadRes = await uploadFileToStorage({
          projectId,
          folder: 'design',
          fileName: refFile.name || `reference_${Date.now()}.png`,
          mimeType: refFile.type || 'image/png',
          buffer,
        })

        await supabase.from('asset_references').insert({
          asset_id: assetData.id,
          storage_key: uploadRes.storageKey,
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

  const { data: existingAsset } = await supabase
    .from('assets')
    .select('storage_key, bundle_id')
    .eq('id', assetId)
    .maybeSingle()

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadRes = await uploadFileToStorage({
      projectId,
      folder: 'assets',
      fileName: file.name,
      mimeType: file.type,
      buffer,
    })

    const { error: updateError } = await supabase
      .from('assets')
      .update({
        storage_key: uploadRes.storageKey,
        bundle_id: null,
        file_name: file.name,
        uploaded_by: user.id,
        status: 'done',
      })
      .eq('id', assetId)

    if (updateError) {
      try {
        await deleteFileFromStorage(uploadRes.storageKey)
      } catch {
        // best-effort cleanup
      }
      return { success: false, error: updateError.message }
    }

    if (existingAsset?.storage_key && !existingAsset.bundle_id) {
      try {
        await deleteFileFromStorage(existingAsset.storage_key)
      } catch (cleanupErr) {
        console.warn('Old S3 asset cleanup note (best effort):', cleanupErr)
      }
    }

    revalidateProjectAssets(projectId)
    return { success: true, storageKey: uploadRes.storageKey }
  } catch (err: unknown) {
    console.error('Failed to upload single asset file:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload to storage failed',
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadRes = await uploadFileToStorage({
      projectId,
      folder: 'assets',
      fileName: file.name,
      mimeType: file.type,
      buffer,
    })

    // 1. Insert into asset_bundles table
    const { data: bundleData, error: bundleError } = await supabase
      .from('asset_bundles')
      .insert({
        project_id: projectId,
        name,
        storage_key: uploadRes.storageKey,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (bundleError || !bundleData) {
      try {
        await deleteFileFromStorage(uploadRes.storageKey)
      } catch {
        // best-effort cleanup
      }
      return { success: false, error: bundleError?.message || 'Failed to record bundle' }
    }

    // 2. Associate all selected assets with this bundle & mark status as done
    const { error: updateAssetsError } = await supabase
      .from('assets')
      .update({
        bundle_id: bundleData.id,
        storage_key: uploadRes.storageKey,
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

  const files = formData.getAll('reference_files') as File[]
  const validFiles = files.filter((f) => f && f.size > 0)

  if (validFiles.length === 0) {
    return { success: false, error: 'No reference images provided' }
  }

  try {
    for (const refFile of validFiles) {
      const buffer = Buffer.from(await refFile.arrayBuffer())
      const uploadRes = await uploadFileToStorage({
        projectId,
        folder: 'design',
        fileName: refFile.name || `reference_${Date.now()}.png`,
        mimeType: refFile.type || 'image/png',
        buffer,
      })

      await supabase.from('asset_references').insert({
        asset_id: assetId,
        storage_key: uploadRes.storageKey,
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
  storageKey: string,
  projectId: string
) {
  const supabase = await createClient()

  // 1. Hard Delete from Supabase Postgres
  const { error: deleteError } = await supabase
    .from('asset_references')
    .delete()
    .eq('id', referenceId)

  if (deleteError) {
    console.error('Failed to delete asset reference row:', deleteError)
    return { success: false, error: deleteError.message }
  }

  // 2. Best-effort delete in S3 storage
  if (storageKey) {
    try {
      await deleteFileFromStorage(storageKey)
    } catch (storageErr) {
      console.warn('S3 reference deletion note (best effort):', storageErr)
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
        storage_key,
        file_name
      ),
      asset_references (
        id,
        asset_id,
        storage_key,
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

  const { data: asset } = await supabase
    .from('assets')
    .select('storage_key, bundle_id, asset_references(storage_key)')
    .eq('id', assetId)
    .maybeSingle()

  const { error } = await supabase.from('assets').delete().eq('id', assetId)

  if (error) {
    console.error('Error deleting asset:', error)
    return { success: false, error: error.message }
  }

  if (asset) {
    const keysToDelete: string[] = []
    if (asset.storage_key && !asset.bundle_id) {
      keysToDelete.push(asset.storage_key)
    }
    const refs = (asset.asset_references as Array<{ storage_key: string }> | null) ?? []
    for (const ref of refs) {
      if (ref.storage_key) keysToDelete.push(ref.storage_key)
    }
    await Promise.allSettled(keysToDelete.map((key) => deleteFileFromStorage(key)))
  }

  revalidateProjectAssets(projectId)
  return { success: true }
}

