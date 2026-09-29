import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationBySlug, getOrganizationMembers } from '@/actions/organizations'
import { getUserOrgRole } from '@/lib/auth/permissions'
import { MemberManagement } from '@/components/organizations/member-management'
import { Button } from '@/components/ui/button'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr'

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

  const [members, { data: projects }] = await Promise.all([
    getOrganizationMembers(org.id),
    supabase
      .from('projects')
      .select('id, name, status')
      .eq('organization_id', org.id)
      .order('name', { ascending: true }),
  ])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3.5 py-4 sm:p-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href={`/orgs/${org.slug}`} />}
          className="gap-1 text-xs"
        >
          <CaretLeft className="size-3" />
          {org.name}
        </Button>
      </div>

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
