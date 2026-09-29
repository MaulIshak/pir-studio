'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/permissions'
import { setActiveOrganizationId } from '@/lib/auth/active-org'

export interface UserNotification {
  id: string
  userId: string
  type: 'org_invitation' | 'role_changed' | 'project_assigned' | 'general'
  title: string
  message: string | null
  data: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

export async function getUserNotifications(): Promise<UserNotification[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return []

  // Check pending status of any org_invitation notifications
  const inviteIds = data
    .filter((n) => n.type === 'org_invitation' && (n.data as Record<string, unknown>)?.invitation_id)
    .map((n) => (n.data as Record<string, unknown>).invitation_id as string)

  let pendingInviteIds = new Set<string>()
  if (inviteIds.length > 0) {
    const { data: pendingInvites } = await supabase
      .from('organization_invitations')
      .select('id')
      .in('id', inviteIds)
      .eq('status', 'pending')

    if (pendingInvites) {
      pendingInviteIds = new Set(pendingInvites.map((i) => i.id))
    }
  }

  const staleNotificationIds: string[] = []
  const filtered = data.filter((n) => {
    if (n.type === 'org_invitation') {
      const invId = (n.data as Record<string, unknown>)?.invitation_id as string | undefined
      if (!invId || !pendingInviteIds.has(invId)) {
        staleNotificationIds.push(n.id)
        return false
      }
    }
    return true
  })

  // Clean up stale invitation notifications in the background
  if (staleNotificationIds.length > 0) {
    void supabase.from('notifications').delete().in('id', staleNotificationIds)
  }

  return filtered.map((n) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    data: (n.data as Record<string, unknown>) || {},
    isRead: n.is_read,
    createdAt: n.created_at,
  }))
}

export async function markNotificationAsRead(notificationId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function acceptOrgInvitation(invitationId: string, notificationId?: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()

  // 1. Fetch invitation
  const { data: invite, error: inviteError } = await supabase
    .from('organization_invitations')
    .select('*, organizations(*)')
    .eq('id', invitationId)
    .single()

  if (inviteError || !invite) {
    return { error: 'Invitation not found' }
  }

  if (invite.status !== 'pending') {
    return { error: `Invitation is already ${invite.status}` }
  }

  // Check if expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { error: 'Invitation has expired' }
  }

  // 2. Add to organization_members
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: invite.organization_id,
      user_id: user.id,
      role: invite.role,
    })
    .select()

  if (memberError && !memberError.message.includes('unique')) {
    return { error: memberError.message }
  }

  // 3. Mark invitation accepted
  await supabase
    .from('organization_invitations')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', invitationId)

  // 4. Delete the invitation notification(s) completely so they disappear from UI
  if (notificationId) {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id)
  }

  // Also remove any notification referencing this invitation for this user
  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('type', 'org_invitation')
    .filter('data->>invitation_id', 'eq', invitationId)

  // Set active org to the newly joined organization
  await setActiveOrganizationId(invite.organization_id)

  revalidatePath('/', 'layout')
  revalidatePath('/projects')

  return {
    success: true,
    organizationId: invite.organization_id,
    organizationSlug: invite.organizations?.slug,
    organizationName: invite.organizations?.name,
  }
}

export async function declineOrgInvitation(invitationId: string, notificationId?: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()

  await supabase
    .from('organization_invitations')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', invitationId)

  // Delete notification completely so it disappears from UI
  if (notificationId) {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id)
  }

  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('type', 'org_invitation')
    .filter('data->>invitation_id', 'eq', invitationId)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getInvitationByToken(token: string) {
  const supabase = await createClient()

  const { data: invite, error } = await supabase
    .from('organization_invitations')
    .select(`
      id,
      token,
      role,
      status,
      expires_at,
      invitee_email,
      created_at,
      organizations (
        id,
        name,
        slug,
        description,
        created_by,
        profiles:created_by (
          id,
          name,
          email,
          avatar_url
        )
      ),
      profiles:inviter_id (
        id,
        name,
        email,
        avatar_url
      )
    `)
    .eq('token', token)
    .maybeSingle()

  if (error || !invite) return null
  return invite
}
