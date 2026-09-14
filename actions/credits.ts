'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { uploadFileToSubfolder } from '@/lib/gdrive/upload'

export interface Credit {
  id: string
  project_id: string
  asset_id: string | null
  source_name: string
  author: string | null
  license: 'cc0' | 'cc_by' | 'royalty_free' | 'proprietary' | 'other'
  source_url: string | null
  notes: string | null
  created_at: string
  assets?: {
    id: string
    name: string
    type: string
  } | null
}

const createCreditSchema = z
  .object({
    projectId: z.string().uuid('Invalid project ID'),
    source_name: z.string().min(1, 'Source name is required').max(150),
    author: z.string().max(100).optional().nullable(),
    license: z.enum(['cc0', 'cc_by', 'royalty_free', 'proprietary', 'other']),
    source_url: z.string().url('Invalid URL').or(z.literal('')).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
    asset_id: z.string().uuid().or(z.literal('')).optional().nullable(),
  })
  .refine(
    (data) => {
      // Validation rule: require source_url for non-CC0 licenses
      if (data.license !== 'cc0') {
        return !!data.source_url && data.source_url.length > 0
      }
      return true
    },
    {
      message: 'Source URL is required for non-CC0 licenses',
      path: ['source_url'],
    }
  )

export async function getCreditsByProjectId(projectId: string): Promise<Credit[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('credits')
    .select(`
      *,
      assets:asset_id (
        id,
        name,
        type
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching credits:', error)
    return []
  }

  return (data as unknown as Credit[]) ?? []
}

export async function createCredit(formData: FormData) {
  const supabase = await createClient()

  const rawData = {
    projectId: formData.get('projectId') as string,
    source_name: formData.get('source_name') as string,
    author: (formData.get('author') as string) || null,
    license: formData.get('license') as string,
    source_url: (formData.get('source_url') as string) || null,
    notes: (formData.get('notes') as string) || null,
    asset_id: (formData.get('asset_id') as string) || null,
  }

  const parseResult = createCreditSchema.safeParse(rawData)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || 'Invalid credit data',
    }
  }

  const { projectId, source_name, author, license, source_url, notes, asset_id } = parseResult.data

  const { data, error } = await supabase
    .from('credits')
    .insert({
      project_id: projectId,
      source_name,
      author: author || null,
      license,
      source_url: source_url || null,
      notes: notes || null,
      asset_id: asset_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error inserting credit:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/projects/${projectId}/credits`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data }
}

export async function deleteCredit(creditId: string, projectId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('credits')
    .delete()
    .eq('id', creditId)

  if (error) {
    console.error('Error deleting credit:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/projects/${projectId}/credits`)
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function exportCreditsMarkdown(projectId: string): Promise<{ success: boolean; content?: string; error?: string; driveSaved?: boolean }> {
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('name, drive_folder_id')
    .eq('id', projectId)
    .single()

  const { data: credits, error } = await supabase
    .from('credits')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  const projectName = project?.name || 'Project'
  let markdown = `# Credits & Attributions: ${projectName}\n\n`
  markdown += `Generated on: ${new Date().toISOString().split('T')[0]}\n\n`
  markdown += `## Third-Party Assets & Licenses\n\n`

  if (!credits || credits.length === 0) {
    markdown += `No external credits recorded.\n`
  } else {
    for (const item of credits) {
      markdown += `### ${item.source_name}\n`
      if (item.author) markdown += `- **Author**: ${item.author}\n`
      markdown += `- **License**: ${item.license.toUpperCase()}\n`
      if (item.source_url) markdown += `- **Source**: ${item.source_url}\n`
      if (item.notes) markdown += `- **Notes**: ${item.notes}\n`
      markdown += `\n`
    }
  }

  // Attempt to save to Drive /Credits/CREDITS.md if user has Drive connected
  let driveSaved = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user && project?.drive_folder_id) {
    try {
      const buffer = Buffer.from(markdown, 'utf-8')
      await uploadFileToSubfolder(
        user.id,
        project.drive_folder_id,
        'Credits',
        'CREDITS.md',
        'text/markdown',
        buffer
      )
      driveSaved = true
    } catch (err) {
      console.warn('Could not save CREDITS.md to Google Drive:', err)
    }
  }

  return { success: true, content: markdown, driveSaved }
}
