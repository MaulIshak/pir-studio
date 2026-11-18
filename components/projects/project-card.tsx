'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowSquareOut,
  GameController,
  Trophy,
  Gear,
  ClockCountdown,
  CheckCircle,
} from '@phosphor-icons/react'

interface ProjectCardProps {
  project: {
    id: string
    slug: string
    name: string
    type: 'jam' | 'competition' | 'internal'
    status: 'active' | 'completed' | 'archived'
    start_date: string | null
    deadline: string | null
    description: string | null
    tasks?: Array<{ id: string; status: string }>
  }
}

function getTypeIcon(type: ProjectCardProps['project']['type']) {
  switch (type) {
    case 'jam':
      return <GameController className="size-3.5 text-purple-400" />
    case 'competition':
      return <Trophy className="size-3.5 text-amber-400" />
    case 'internal':
      return <Gear className="size-3.5 text-sky-400" />
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const totalTasks = project.tasks?.length || 0
  const doneTasks = project.tasks?.filter((t) => t.status === 'done').length || 0
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  let daysRemaining: number | null = null
  let isUrgent = false

  if (project.deadline) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(project.deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    daysRemaining = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysRemaining >= 0 && daysRemaining < 3 && project.status === 'active') {
      isUrgent = true
    }
  }

  const typeLabel = project.type.charAt(0).toUpperCase() + project.type.slice(1)
  const isCompleted = project.status === 'completed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="h-full"
    >
      <Card
        className={`flex h-full flex-col justify-between transition-colors duration-150 ${
          isUrgent
            ? 'border-destructive/40 hover:border-destructive/70'
            : isCompleted
            ? 'border-emerald-500/30 hover:border-emerald-500/50'
            : 'hover:border-primary/45'
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="flex items-center gap-1 font-medium">
                {getTypeIcon(project.type)}
                {typeLabel}
              </Badge>
              {project.status === 'active' ? (
                <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium text-[11px]">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Active
                </Badge>
              ) : project.status === 'completed' ? (
                <Badge variant="outline" className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium text-[11px]">
                  <span className="size-1.5 rounded-full bg-blue-500" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                  <span className="size-1.5 rounded-full bg-slate-400" />
                  Archived
                </Badge>
              )}
            </div>

            {daysRemaining !== null && (
              <span
                className={`font-mono text-[11px] flex items-center gap-1 shrink-0 ${
                  daysRemaining < 0 || isUrgent
                    ? 'text-destructive font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                <ClockCountdown className="size-3" />
                {daysRemaining < 0
                  ? 'Overdue'
                  : daysRemaining === 0
                  ? 'Today'
                  : `${daysRemaining}d left`}
              </span>
            )}
          </div>

          <CardTitle className="font-heading text-base font-semibold pt-1.5">
            <Link
              href={`/projects/${project.slug}`}
              className="hover:text-primary transition-colors hover:underline"
            >
              {project.name}
            </Link>
          </CardTitle>

          {project.description && (
            <CardDescription className="line-clamp-2 text-xs">
              {project.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-2 pt-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {isCompleted ? (
                <CheckCircle className="size-3 text-emerald-600 dark:text-emerald-400" />
              ) : null}
              Progress
            </span>
            <span className="font-mono font-medium text-foreground">{progressPercent}%</span>
          </div>

          <div className="h-1.5 w-full overflow-hidden bg-secondary">
            <motion.div
              className={`h-full transition-colors ${
                isCompleted ? 'bg-emerald-500' : 'bg-primary'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>

          <div className="text-[11px] font-mono text-muted-foreground">
            {doneTasks} / {totalTasks} tasks
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-end gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="xs"
            nativeButton={false}
            render={<Link href={`/projects/${project.slug}`} />}
            className="text-xs"
          >
            Overview
            <ArrowSquareOut className="size-3.5" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
