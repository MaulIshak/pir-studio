import { createClient } from '@/lib/supabase/server'

export type OrgRole = 'leader' | 'co_leader' | 'member'

export interface UserOrgMembership {
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: OrgRole
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Get user's role in a specific organization
 */
export async function getUserOrgRole(
  orgId: string,
  userId?: string
): Promise<OrgRole | null> {
  const supabase = await createClient()
  let uid = userId

  if (!uid) {
    const user = await getCurrentUser()
    if (!user) return null
    uid = user.id
  }

  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', uid)
    .maybeSingle()

  return (data?.role as OrgRole) ?? null
}

/**
 * Check if user has access to a project
 * Access rule:
 * - Leader and Co-Leader of the owning organization have automatic access to all projects in that organization.
 * - Member must be explicitly assigned to the project via `project_members`.
 */
export async function hasProjectAccess(
  projectId: string,
  userId?: string
): Promise<{ hasAccess: boolean; role: OrgRole | null; organizationId: string | null }> {
  const supabase = await createClient()
  let uid = userId

  if (!uid) {
    const user = await getCurrentUser()
    if (!user) return { hasAccess: false, role: null, organizationId: null }
    uid = user.id
  }

  // Get project and its organization_id
  const { data: project } = await supabase
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project || !project.organization_id) {
    return { hasAccess: false, role: null, organizationId: null }
  }

  // Check user role in this organization
  const role = await getUserOrgRole(project.organization_id, uid)
  if (!role) {
    return { hasAccess: false, role: null, organizationId: project.organization_id }
  }

  // Leaders and Co-Leaders have access to all projects in their org
  if (role === 'leader' || role === 'co_leader') {
    return { hasAccess: true, role, organizationId: project.organization_id }
  }

  // Regular members must have an entry in project_members
  const { data: memberEntry } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', uid)
    .maybeSingle()

  return {
    hasAccess: !!memberEntry,
    role,
    organizationId: project.organization_id,
  }
}

/**
 * Guard that throws an error if user lacks project access
 */
export async function requireProjectAccess(projectId: string) {
  const { hasAccess, role, organizationId } = await hasProjectAccess(projectId)
  if (!hasAccess) {
    throw new Error('Unauthorized: You do not have access to this project')
  }
  return { role, organizationId }
}

/**
 * Guard that verifies user has leader or co-leader role in organization
 */
export async function requireOrgAdmin(orgId: string) {
  const role = await getUserOrgRole(orgId)
  if (role !== 'leader' && role !== 'co_leader') {
    throw new Error('Unauthorized: Only Leaders and Co-Leaders can perform this action')
  }
  return role
}

/**
 * Guard that verifies user is specifically the leader of the organization
 */
export async function requireOrgLeader(orgId: string) {
  const role = await getUserOrgRole(orgId)
  if (role !== 'leader') {
    throw new Error('Unauthorized: Only the Organization Leader can perform this action')
  }
  return role
}
