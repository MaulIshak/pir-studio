import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationBySlug, getOrganizationMembers } from '@/actions/organizations'
import { getUserOrgRole } from '@/lib/auth/permissions'
import { MemberManagement } from '@/components/organizations/member-management'

interface OrgMembersPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function OrgMembersPage({ params }: OrgMembersPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const org = await getOrganizationBySlug(slug)
  if (!org) {
    notFound()
  }

  const userRole = await getUserOrgRole(org.id, user.id)
  if (!userRole) {
    redirect('/')
  }

  // Only Leader and Co-Leader can manage organization members
  if (userRole !== 'leader' && userRole !== 'co_leader') {
    redirect(`/orgs/${org.slug}`)
  }

  const [members, { data: projects }] = await Promise.all([
    getOrganizationMembers(org.id),
    supabase
      .from('projects')
      .select('id, name, status')
      .eq('organization_id', org.id)
      .order('name', { ascending: true }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <MemberManagement
        organizationId={org.id}
        organizationName={org.name}
        currentUserRole={userRole}
        currentUserId={user.id}
        members={members}
        allProjects={projects ?? []}
      />
    </div>
  )
}
