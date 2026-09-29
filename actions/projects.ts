'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { provisionProjectFolders } from '@/lib/gdrive/provisioning'
import { slugify } from '@/lib/slug'
import { getActiveOrganization } from '@/lib/auth/active-org'
import { getUserOrgRole, type OrgRole } from '@/lib/auth/permissions'
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
  organization_id: z.string().uuid().optional().nullable(),
})

export type ProjectInput = {
  name: string
  slug?: string
  type: 'jam' | 'competition' | 'internal'
  start_date?: string | null
  deadline?: string | null
  description?: string | null
  organization_id?: string | null
}

export async function createProject(input: ProjectInput) {
  const activeOrg = await getActiveOrganization()
  const orgId = input.organization_id || activeOrg?.id

  if (!orgId) {
    return { error: 'An active organization is required to create a project' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required' }
  }

  // Check role: Only Leader and Co-Leader can create projects
  const role = await getUserOrgRole(orgId, user.id)
  if (role !== 'leader' && role !== 'co_leader') {
    return { error: 'Unauthorized: Members cannot create projects' }
  }

  const resolvedSlug = (input.slug?.trim() ? slugify(input.slug) : slugify(input.name)) || `project-${Date.now().toString(36)}`
  const validated = ProjectSchema.safeParse({
    ...input,
    slug: resolvedSlug,
    organization_id: orgId,
  })

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

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
      created_by: user.id,
      organization_id: orgId,
      status: 'active',
    })
    .select()
    .single()

  if (dbError || !project) {
    return { error: dbError?.message ?? 'Failed to create project' }
  }

  // 2. Also register creator in project_members
  await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
  })

  // 3. Dual-write resilience: Attempt Google Drive provisioning
  let driveFolderId: string | null = null
  let driveError: string | null = null

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

export async function getProjects(status?: 'active' | 'completed' | 'archived') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const activeOrg = await getActiveOrganization()
  if (!activeOrg) return []

  let query = supabase
    .from('projects')
    .select('*, tasks(id, status)')
    .eq('organization_id', activeOrg.id)
    .order('deadline', { ascending: true, nullsFirst: false })

  if (status) {
    query = query.eq('status', status)
  }

  // If role is member, only return assigned projects
  if (activeOrg.role === 'member') {
    const { data: assigned } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const allowedIds = assigned?.map((a) => a.project_id) ?? []
    if (allowedIds.length === 0) return []
    query = query.in('id', allowedIds)
  }

  const { data, error } = await query

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const activeOrg = await getActiveOrganization()
  if (!activeOrg) return []

  let query = supabase
    .from('projects')
    .select('id, name, slug, type, status')
    .eq('organization_id', activeOrg.id)
    .order('created_at', { ascending: false })

  if (activeOrg.role === 'member') {
    const { data: assigned } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const allowedIds = assigned?.map((a) => a.project_id) ?? []
    if (allowedIds.length === 0) return []
    query = query.in('id', allowedIds)
  }

  const { data, error } = await query

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

export interface ProjectMemberUser {
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: OrgRole
  accessType: 'organization' | 'assigned'
}

export async function getProjectMembers(projectId: string): Promise<ProjectMemberUser[]> {
  const supabase = await createClient()

  // 1. Get project's organization_id
  const { data: project } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project?.organization_id) return []

  // 2. Get organization leaders and co-leaders (automatic access)
  const { data: orgAdmins } = await supabase
    .from('organization_members')
    .select(`
      role,
      profiles (
        id,
        name,
        email,
        avatar_url
      )
    `)
    .eq('organization_id', project.organization_id)
    .in('role', ['leader', 'co_leader'])

  // 3. Get explicitly assigned project members
  const { data: assignedMembers } = await supabase
    .from('project_members')
    .select(`
      profiles (
        id,
        name,
        email,
        avatar_url
      )
    `)
    .eq('project_id', projectId)

  // 4. Also fetch roles for assigned members
  const memberUserIds = assignedMembers
    ?.map((am) => (am.profiles as unknown as { id: string })?.id)
    .filter(Boolean) ?? []

  const { data: orgMemberRoles } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', project.organization_id)
    .in('user_id', memberUserIds)

  const roleMap: Record<string, OrgRole> = {}
  orgMemberRoles?.forEach((r) => {
    roleMap[r.user_id] = r.role as OrgRole
  })

  const results: Map<string, ProjectMemberUser> = new Map()

  // Add Leaders and Co-Leaders
  orgAdmins?.forEach((oa) => {
    const p = oa.profiles as unknown as {
      id: string
      name: string | null
      email: string | null
      avatar_url: string | null
    }
    if (p?.id) {
      results.set(p.id, {
        userId: p.id,
        name: p.name || 'Admin',
        email: p.email || '',
        avatarUrl: p.avatar_url,
        role: oa.role as OrgRole,
        accessType: 'organization',
      })
    }
  })

  // Add explicitly assigned members
  assignedMembers?.forEach((am) => {
    const p = am.profiles as unknown as {
      id: string
      name: string | null
      email: string | null
      avatar_url: string | null
    }
    if (p?.id && !results.has(p.id)) {
      results.set(p.id, {
        userId: p.id,
        name: p.name || 'Member',
        email: p.email || '',
        avatarUrl: p.avatar_url,
        role: roleMap[p.id] || 'member',
        accessType: 'assigned',
      })
    }
  })

  return Array.from(results.values())
}

export async function getProjectById(projectId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*, tasks(*), milestones(*), assets(id, status, type), credits(id, license), artifact_links(id, type)')
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
    .select('*, tasks(*), milestones(*), assets(id, status, type), credits(id, license), artifact_links(id, type)')
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
