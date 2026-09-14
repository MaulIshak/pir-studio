import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ProjectListClient } from '@/components/projects/project-list-client'
import { Plus } from '@phosphor-icons/react/dist/ssr'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*, tasks(id, status)')
    .order('deadline', { ascending: true, nullsFirst: false })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-xs text-muted-foreground">Manage active game jams, competitions, and internal projects.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/projects/new" />} size="sm">
          <Plus className="size-3.5" />
          New Project
        </Button>
      </div>

      <ProjectListClient initialProjects={projects ?? []} />
    </div>
  )
}
