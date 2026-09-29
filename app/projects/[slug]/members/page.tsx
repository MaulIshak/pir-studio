import { notFound, redirect } from 'next/navigation'
import { getProjectBySlug, getProjectMembers } from '@/actions/projects'
import { getOrganizationMembers } from '@/actions/organizations'
import { hasProjectAccess } from '@/lib/auth/permissions'
import { ProjectNav } from '@/components/projects/project-nav'
import { ProjectMembersView } from '@/components/projects/project-members-view'
import { createClient } from '@/lib/supabase/server'

interface ProjectMembersPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectMembersPage({ params }: ProjectMembersPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const project = await getProjectBySlug(slug)
  if (!project) {
    notFound()
  }

  const access = await hasProjectAccess(project.id, user.id)
  if (!access.hasAccess) {
    redirect('/')
  }

  const members = await getProjectMembers(project.id)

  let allOrgMembers: Array<{
    userId: string
    name: string
    email: string
    avatarUrl: string | null
    role: 'leader' | 'co_leader' | 'member'
  }> = []

  if (project.organization_id && (access.role === 'leader' || access.role === 'co_leader')) {
    const orgMembers = await getOrganizationMembers(project.organization_id)
    allOrgMembers = orgMembers.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl,
      role: m.role,
    }))
  }

  return (
    <div className="flex flex-col gap-6">
      <ProjectNav projectSlug={project.slug} />

      <ProjectMembersView
        projectId={project.id}
        projectName={project.name}
        currentUserRole={access.role || 'member'}
        members={members}
        allOrgMembers={allOrgMembers}
      />
    </div>
  )
}
