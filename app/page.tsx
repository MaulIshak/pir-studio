import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProjectListClient } from '@/components/projects/project-list-client'
import { Plus, GameController, ClockCountdown, CheckCircle } from '@phosphor-icons/react/dist/ssr'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*, tasks(id, status)')
    .order('deadline', { ascending: true, nullsFirst: false })

  const allProjects = projects ?? []
  const activeProjects = allProjects.filter((p) => p.status === 'active')
  const completedProjects = allProjects.filter((p) => p.status === 'completed')

  // Count urgent projects (deadline < 3 days)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const urgentCount = activeProjects.filter((p) => {
    if (!p.deadline) return false
    const d = new Date(p.deadline)
    d.setHours(0, 0, 0, 0)
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff < 3
  }).length

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-8 items-center justify-center overflow-hidden rounded-md">
              <Image
                src="/logo.png"
                alt="Pir Studio"
                width={32}
                height={32}
                className="size-8 object-contain"
                priority
              />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Pir Studio
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Central hub for game jams, tasks, assets, and Google Drive storage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button nativeButton={false} render={<Link href="/projects/new" />} size="sm">
            <Plus className="size-3.5" />
            New Project
          </Button>
        </div>
      </div>

      {/* Metrics Row with Rich Accents & Informative Icons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-card transition-all duration-200 hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Active Projects</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <GameController className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-3xl font-bold text-foreground">{activeProjects.length}</div>
            <p className="text-xs text-muted-foreground pt-1">Projects in active development</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/25 bg-gradient-to-br from-destructive/10 via-destructive/5 to-card transition-all duration-200 hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Due Soon</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-md bg-destructive/15 text-destructive">
              <ClockCountdown className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-3xl font-bold text-destructive">
              {urgentCount}
            </div>
            <p className="text-xs text-muted-foreground pt-1">Deadlines within 3 days</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-card transition-all duration-200 hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Completed</CardTitle>
            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-500">
              <CheckCircle className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-3xl font-bold text-emerald-500">{completedProjects.length}</div>
            <p className="text-xs text-muted-foreground pt-1">Shipped games and entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Project List with Tabs */}
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold">Projects</h2>
        <ProjectListClient initialProjects={allProjects} />
      </div>
    </div>
  )
}
