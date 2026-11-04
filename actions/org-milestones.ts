'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  getCurrentUser,
  getUserOrgRole,
  requireOrgAdmin,
} from '@/lib/auth/permissions'
import { z } from 'zod'

const OrgMilestoneSchema = z
  .object({
    organization_id: z.string().uuid(),
    project_id: z.string().uuid().optional().nullable(),
    title: z.string().min(1, 'Title is required').max(100),
    description: z.string().optional().nullable(),
    start_date: z.string().optional().nullable(),
    due_date: z.string().optional().nullable(),
    status: z.enum(['not_started', 'in_progress', 'done']).default('not_started'),
    member_ids: z.array(z.string().uuid()).optional(),
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

export type OrgMilestoneInput = z.infer<typeof OrgMilestoneSchema>

export interface OrgMilestoneMember {
  userId: string
  name: string
  email: string
  avatarUrl: string | null
}

export interface OrgMilestoneItem {
  id: string
  organization_id: string
  project_id: string | null
  title: string
  description?: string | null
  start_date?: string | null
  due_date: string | null
  status: 'not_started' | 'in_progress' | 'done'
  created_at: string
  updated_at: string
  project?: {
    id: string
    name: string
    slug: string
    status: string
    type: string
  } | null
  members: OrgMilestoneMember[]
}

export async function checkOrgMilestonesMigrationStatus(): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('organization_milestones').select('id').limit(1)
  return !error || error.code !== 'PGRST205'
}

export async function getOrgMilestones(orgId: string): Promise<OrgMilestoneItem[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const userRole = await getUserOrgRole(orgId, user.id)
  if (!userRole) return []

  const { data, error } = await supabase
    .from('organization_milestones')
    .select(`
      id,
      organization_id,
      project_id,
      title,
      description,
      start_date,
      due_date,
      status,
      created_at,
      updated_at,
      projects (
        id,
        name,
        slug,
        status,
        type
      ),
      organization_milestone_members (
        user_id,
        profiles (
          id,
          name,
          email,
          avatar_url
        )
      )
    `)
    .eq('organization_id', orgId)
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error || !data) {
    if (error?.code === 'PGRST205') {
      console.warn(
        'organization_milestones table not found in Supabase schema cache. Please execute supabase/migrations/20261104000000_add_organization_milestones.sql in Supabase SQL editor.'
      )
    } else {
      console.error('Error fetching org milestones:', error?.message || error)
    }
    return []
  }

  // Format milestone rows
  type RawMilestoneRow = {
    id: string
    organization_id: string
    project_id: string | null
    title: string
    description: string | null
    start_date: string | null
    due_date: string | null
    status: 'not_started' | 'in_progress' | 'done'
    created_at: string
    updated_at: string
    projects: {
      id: string
      name: string
      slug: string
      status: string
      type: string
    } | null
    organization_milestone_members: Array<{
      user_id: string
      profiles: {
        id: string
        name: string | null
        email: string | null
        avatar_url: string | null
      } | null
    }> | null
  }

  const rawRows = data as unknown as RawMilestoneRow[]

  // If role is regular member, apply access control rules:
  // 1. If linked to a project (project_id IS NOT NULL), member must be assigned to that project in project_members.
  // 2. If not linked to a project (project_id IS NULL), member must be present in organization_milestone_members.
  let allowedProjectIds: Set<string> | null = null
  if (userRole === 'member') {
    const { data: assigned } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    allowedProjectIds = new Set(assigned?.map((a) => a.project_id) ?? [])
  }

  const result: OrgMilestoneItem[] = []

  for (const row of rawRows) {
    const members: OrgMilestoneMember[] = (row.organization_milestone_members || [])
      .map((m) => {
        const prof = m.profiles
        return {
          userId: m.user_id,
          name: prof?.name || 'Member',
          email: prof?.email || '',
          avatarUrl: prof?.avatar_url || null,
        }
      })

    // Access check for members
    if (userRole === 'member') {
      if (row.project_id) {
        // Connected to project -> must have access to that project
        if (!allowedProjectIds?.has(row.project_id)) {
          continue
        }
      } else {
        // Not connected to project -> must be in selected members
        const isSelectedMember = members.some((m) => m.userId === user.id)
        if (!isSelectedMember) {
          continue
        }
      }
    }

    result.push({
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      title: row.title,
      description: row.description,
      start_date: row.start_date,
      due_date: row.due_date,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      project: row.projects,
      members,
    })
  }

  return result
}

export async function createOrgMilestone(input: OrgMilestoneInput) {
  await requireOrgAdmin(input.organization_id)
  const user = await getCurrentUser()
  if (!user) return { error: 'Authentication required' }

  const validated = OrgMilestoneSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()

  // 1. Insert organization milestone
  const { data: milestone, error } = await supabase
    .from('organization_milestones')
    .insert({
      organization_id: validated.data.organization_id,
      project_id: validated.data.project_id || null,
      title: validated.data.title,
      description: validated.data.description || null,
      start_date: validated.data.start_date || null,
      due_date: validated.data.due_date || null,
      status: validated.data.status,
      created_by: user.id,
    })
    .select()
    .single()

  if (error || !milestone) {
    return { error: error?.message ?? 'Failed to create organization milestone' }
  }

  // 2. If not connected to a project, save member assignments
  if (!validated.data.project_id && validated.data.member_ids && validated.data.member_ids.length > 0) {
    const memberRows = validated.data.member_ids.map((uid) => ({
      milestone_id: milestone.id,
      user_id: uid,
    }))
    const { error: memberError } = await supabase
      .from('organization_milestone_members')
      .insert(memberRows)

    if (memberError) {
      console.error('Failed to link milestone members:', memberError)
    }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', validated.data.organization_id)
    .single()

  if (org?.slug) {
    revalidatePath(`/orgs/${org.slug}/milestones`)
    revalidatePath(`/orgs/${org.slug}`)
  }
  revalidatePath('/', 'layout')

  return { success: true, milestone }
}

export async function updateOrgMilestone(
  milestoneId: string,
  orgId: string,
  input: Partial<OrgMilestoneInput>
) {
  await requireOrgAdmin(orgId)

  if (input.start_date && input.due_date) {
    if (new Date(input.due_date) < new Date(input.start_date)) {
      return { error: 'End date must be on or after start date' }
    }
  }

  const supabase = await createClient()

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.title !== undefined) updateFields.title = input.title.trim()
  if (input.description !== undefined) updateFields.description = input.description ? input.description.trim() : null
  if (input.start_date !== undefined) updateFields.start_date = input.start_date || null
  if (input.due_date !== undefined) updateFields.due_date = input.due_date || null
  if (input.status !== undefined) updateFields.status = input.status
  if (input.project_id !== undefined) updateFields.project_id = input.project_id || null

  const { data: updated, error } = await supabase
    .from('organization_milestones')
    .update(updateFields)
    .eq('id', milestoneId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error || !updated) {
    return { error: error?.message ?? 'Failed to update organization milestone' }
  }

  // Handle member assignments sync
  if (input.project_id) {
    // Linked to a project -> clear explicit member assignments
    await supabase
      .from('organization_milestone_members')
      .delete()
      .eq('milestone_id', milestoneId)
  } else if (input.member_ids !== undefined) {
    // Independent milestone -> replace member assignments
    await supabase
      .from('organization_milestone_members')
      .delete()
      .eq('milestone_id', milestoneId)

    if (input.member_ids.length > 0) {
      const rows = input.member_ids.map((uid) => ({
        milestone_id: milestoneId,
        user_id: uid,
      }))
      await supabase.from('organization_milestone_members').insert(rows)
    }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  if (org?.slug) {
    revalidatePath(`/orgs/${org.slug}/milestones`)
    revalidatePath(`/orgs/${org.slug}`)
  }
  revalidatePath('/', 'layout')

  return { success: true, milestone: updated }
}

export async function deleteOrgMilestone(milestoneId: string, orgId: string) {
  await requireOrgAdmin(orgId)
  const supabase = await createClient()

  const { error } = await supabase
    .from('organization_milestones')
    .delete()
    .eq('id', milestoneId)
    .eq('organization_id', orgId)

  if (error) {
    return { error: error.message }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  if (org?.slug) {
    revalidatePath(`/orgs/${org.slug}/milestones`)
    revalidatePath(`/orgs/${org.slug}`)
  }
  revalidatePath('/', 'layout')

  return { success: true }
}
