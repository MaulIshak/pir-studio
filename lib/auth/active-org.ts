import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { OrgRole } from './permissions'

export const ACTIVE_ORG_COOKIE = 'gamedev_active_org_id'

export interface ActiveOrg {
  id: string
  name: string
  slug: string
  description?: string | null
  role: OrgRole
}

/**
 * Get the currently active organization for the logged-in user.
 * If no cookie is set or the user no longer has access to the cached org,
 * automatically falls back to their first joined organization.
 */
export async function getActiveOrganization(): Promise<ActiveOrg | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  // Fetch all organizations the user is a member of
  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select(`
      role,
      organizations (
        id,
        name,
        slug,
        description
      )
    `)
    .eq('user_id', user.id)

  if (error || !memberships || memberships.length === 0) {
    return null
  }

  // Flatten memberships
  const orgList = memberships
    .filter((m) => m.organizations !== null)
    .map((m) => {
      const org = m.organizations as unknown as {
        id: string
        name: string
        slug: string
        description: string | null
      }
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        role: m.role as OrgRole,
      }
    })

  if (orgList.length === 0) return null

  // 1. Try to find the org from cookie
  if (savedOrgId) {
    const match = orgList.find((o) => o.id === savedOrgId)
    if (match) return match
  }

  // 2. Fallback to first org and set cookie
  const fallback = orgList[0]
  try {
    cookieStore.set(ACTIVE_ORG_COOKIE, fallback.id, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  } catch {
    // Ignore when called in contexts that cannot set cookies
  }

  return fallback
}

/**
 * Set active organization cookie
 */
export async function setActiveOrganizationId(orgId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  })
}
