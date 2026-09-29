'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/slug'
import {
  getCurrentUser,
  getUserOrgRole,
  requireOrgAdmin,
  requireOrgLeader,
  type OrgRole,
} from '@/lib/auth/permissions'
import {
  getActiveOrganization,
  setActiveOrganizationId,
  type ActiveOrg,
} from '@/lib/auth/active-org'
import { z } from 'zod'

const CreateOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100),
  description: z.string().optional().nullable(),
  invitations: z
    .array(
      z.object({
        email: z.string().email('Invalid email address'),
        role: z.enum(['co_leader', 'member']),
      })
    )
    .optional(),
})

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>

export async function getActiveOrg(): Promise<ActiveOrg | null> {
  return await getActiveOrganization()
}

export async function switchActiveOrg(orgId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { data: member } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return { error: 'You are not a member of this organization' }
  }

  await setActiveOrganizationId(orgId)
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getUserOrganizations() {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      role,
      organizations (
        id,
        name,
        slug,
        description,
        created_at
      )
    `)
    .eq('user_id', user.id)

  if (error || !data) return []

  return data
    .filter((item) => item.organizations !== null)
    .map((item) => {
      const org = item.organizations as unknown as {
        id: string
        name: string
        slug: string
        description: string | null
        created_at: string
      }
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        createdAt: org.created_at,
        role: item.role as OrgRole,
      }
    })
}

export async function getOrganizationBySlug(slug: string) {
  const supabase = await createClient()
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !org) return null
  return org
}

export async function createOrganization(input: CreateOrgInput) {
  const validated = CreateOrgSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Authentication required' }
  }

  const supabase = await createClient()

  // Generate unique slug
  const baseSlug = slugify(validated.data.name) || 'organization'
  let slug = baseSlug
  let counter = 1

  while (true) {
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    counter++
    slug = `${baseSlug}-${counter}`
  }

  // 1. Insert organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: validated.data.name,
      slug,
      description: validated.data.description || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (orgError || !org) {
    return { error: orgError?.message ?? 'Failed to create organization' }
  }

  // 2. Assign creator as Leader
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'leader',
    })

  if (memberError) {
    return { error: memberError.message }
  }

  // 3. Process invitations if any
  if (validated.data.invitations && validated.data.invitations.length > 0) {
    for (const inv of validated.data.invitations) {
      const inviteeEmail = inv.email.toLowerCase().trim()
      if (inviteeEmail === user.email?.toLowerCase().trim()) continue

      // Check if profile exists for this email
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteeEmail)
        .maybeSingle()

      const { data: createdInvite } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: org.id,
          inviter_id: user.id,
          invitee_email: inviteeEmail,
          invitee_id: existingProfile?.id || null,
          role: inv.role,
        })
        .select()
        .single()

      // If user exists, create an in-app notification
      if (existingProfile && createdInvite) {
        await supabase.from('notifications').insert({
          user_id: existingProfile.id,
          type: 'org_invitation',
          title: `Invited to join ${org.name}`,
          message: `${user.user_metadata?.full_name || user.email} invited you to join ${org.name} as ${inv.role === 'co_leader' ? 'Co-Leader' : 'Member'}.`,
          data: {
            invitation_id: createdInvite.id,
            token: createdInvite.token,
            organization_id: org.id,
            organization_name: org.name,
            role: inv.role,
          },
        })
      }
    }
  }

  // Set active organization to new org
  await setActiveOrganizationId(org.id)

  revalidatePath('/', 'layout')
  revalidatePath('/projects')

  return { success: true, organization: org }
}

export async function getOrganizationMembers(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      id,
      role,
      created_at,
      profiles (
        id,
        name,
        email,
        avatar_url
      )
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  // Also count assigned projects for each member
  const { data: projectMemberCounts } = await supabase
    .from('project_members')
    .select('user_id, projects!inner(organization_id)')
    .eq('projects.organization_id', orgId)

  const countMap: Record<string, number> = {}
  projectMemberCounts?.forEach((pm) => {
    countMap[pm.user_id] = (countMap[pm.user_id] || 0) + 1
  })

  return data.map((m) => {
    const prof = m.profiles as unknown as {
      id: string
      name: string | null
      email: string | null
      avatar_url: string | null
    }
    return {
      memberId: m.id,
      userId: prof.id,
      name: prof.name || 'Member',
      email: prof.email || '',
      avatarUrl: prof.avatar_url,
      role: m.role as OrgRole,
      joinedAt: m.created_at,
      assignedProjectsCount: countMap[prof.id] || 0,
    }
  })
}

export async function updateOrganization(
  orgId: string,
  data: { name: string; description?: string | null }
) {
  await requireOrgLeader(orgId)
  const supabase = await createClient()

  const { error } = await supabase
    .from('organizations')
    .update({
      name: data.name,
      description: data.description || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateMemberRole(
  orgId: string,
  targetUserId: string,
  newRole: 'co_leader' | 'member'
) {
  await requireOrgLeader(orgId)
  const supabase = await createClient()

  const { error } = await supabase
    .from('organization_members')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)
    .eq('user_id', targetUserId)

  if (error) return { error: error.message }

  // Send notification to member
  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
  await supabase.from('notifications').insert({
    user_id: targetUserId,
    type: 'role_changed',
    title: `Role updated in ${org?.name || 'Organization'}`,
    message: `Your role has been updated to ${newRole === 'co_leader' ? 'Co-Leader' : 'Member'}.`,
    data: { organization_id: orgId, new_role: newRole },
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeMember(orgId: string, targetUserId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  // If removing someone else, must be leader
  if (user.id !== targetUserId) {
    await requireOrgLeader(orgId)
  } else {
    // If self-leaving, ensure user is not the only leader
    const role = await getUserOrgRole(orgId, user.id)
    if (role === 'leader') {
      const supabase = await createClient()
      const { data: leaders } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('role', 'leader')

      if (leaders && leaders.length <= 1) {
        return { error: 'You cannot leave the organization as the sole Leader. Transfer leadership first.' }
      }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', targetUserId)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: 'co_leader' | 'member'
) {
  await requireOrgAdmin(orgId)
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  const cleanEmail = email.toLowerCase().trim()
  const supabase = await createClient()

  // Get org info
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()

  if (!org) return { error: 'Organization not found' }

  // Check if user is already a member
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (existingProfile) {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', existingProfile.id)
      .maybeSingle()

    if (existingMember) {
      return { error: 'User is already a member of this organization' }
    }
  }

  // Create invitation
  const { data: invitation, error } = await supabase
    .from('organization_invitations')
    .insert({
      organization_id: orgId,
      inviter_id: user.id,
      invitee_email: cleanEmail,
      invitee_id: existingProfile?.id || null,
      role,
    })
    .select()
    .single()

  if (error || !invitation) {
    return { error: error?.message ?? 'Failed to create invitation' }
  }

  // Create in-app notification if registered
  if (existingProfile) {
    await supabase.from('notifications').insert({
      user_id: existingProfile.id,
      type: 'org_invitation',
      title: `Invited to join ${org.name}`,
      message: `${user.user_metadata?.full_name || user.email} invited you to join ${org.name} as ${role === 'co_leader' ? 'Co-Leader' : 'Member'}.`,
      data: {
        invitation_id: invitation.id,
        token: invitation.token,
        organization_id: orgId,
        organization_name: org.name,
        role,
      },
    })
  }

  return {
    success: true,
    invitationToken: invitation.token,
    inviteLink: `/invite/${invitation.token}`,
  }
}

export async function getMemberAssignedProjectIds(orgId: string, memberUserId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('project_members')
    .select('project_id, projects!inner(organization_id)')
    .eq('user_id', memberUserId)
    .eq('projects.organization_id', orgId)

  return data?.map((d) => d.project_id) ?? []
}

export async function assignProjectsToMember(
  orgId: string,
  memberUserId: string,
  projectIds: string[]
) {
  await requireOrgAdmin(orgId)
  const supabase = await createClient()

  // Get all projects in this organization
  const { data: orgProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('organization_id', orgId)

  const validProjectIds = new Set(orgProjects?.map((p) => p.id) ?? [])
  const targetProjectIds = projectIds.filter((id) => validProjectIds.has(id))

  // Delete existing project memberships for this org's projects
  for (const orgProj of orgProjects ?? []) {
    await supabase
      .from('project_members')
      .delete()
      .eq('user_id', memberUserId)
      .eq('project_id', orgProj.id)
  }

  // Insert selected project memberships
  if (targetProjectIds.length > 0) {
    const rows = targetProjectIds.map((pid) => ({
      project_id: pid,
      user_id: memberUserId,
    }))
    const { error } = await supabase.from('project_members').insert(rows)
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function assignMembersToProject(
  projectId: string,
  userIds: string[]
) {
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .single()

  if (!project?.organization_id) return { error: 'Project not found' }
  await requireOrgAdmin(project.organization_id)

  // Clear existing project members
  await supabase.from('project_members').delete().eq('project_id', projectId)

  // Insert new project members
  if (userIds.length > 0) {
    const rows = userIds.map((uid) => ({
      project_id: projectId,
      user_id: uid,
    }))
    const { error } = await supabase.from('project_members').insert(rows)
    if (error) return { error: error.message }
  }

  revalidatePath('/projects/[slug]/members')
  revalidatePath('/projects/[slug]', 'layout')
  return { success: true }
}

