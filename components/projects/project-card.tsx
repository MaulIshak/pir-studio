'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RetryDriveButton } from './retry-drive-button'
import {
  ArrowSquareOut,
  Folder,
  GameController,
  Trophy,
  Gear,
  ClockCountdown,
  CheckCircle,
} from '@phosphor-icons/react'

interface ProjectCardProps {
  project: {
    id: string
    name: string
    type: 'jam' | 'competition' | 'internal'
    status: 'active' | 'completed' | 'archived'
    start_date: string | null
    deadline: string | null
    description: string | null
    drive_folder_id: string | null
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: 'easeOut' } }}
      transition={{ duration: 0.25 }}
      className="h-full"
    >
      <Card
        className={`flex h-full flex-col justify-between transition-all duration-200 hover:shadow-md ${
          isUrgent
            ? 'border-destructive/40 bg-gradient-to-br from-card via-card to-destructive/5'
            : isCompleted
            ? 'border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/5'
            : 'hover:border-primary/40 bg-gradient-to-br from-card to-primary/[0.03]'
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="flex items-center gap-1">
                {getTypeIcon(project.type)}
                {typeLabel}
              </Badge>
              {isUrgent && (
                <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                  <ClockCountdown className="size-3" />
                  Due Soon
                </Badge>
              )}
              {project.status !== 'active' && (
                <Badge variant="outline" className="capitalize">
                  {project.status}
                </Badge>
              )}
            </div>

            {daysRemaining !== null && (
              <span
                className={`font-mono text-xs flex items-center gap-1 ${
                  daysRemaining < 0
                    ? 'text-destructive font-semibold'
                    : isUrgent
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

          <CardTitle className="font-heading text-base font-semibold pt-1">
            <Link
              href={`/projects/${project.id}`}
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
                <CheckCircle className="size-3 text-emerald-500" />
              ) : null}
              Progress
            </span>
            <span className="font-mono font-medium text-foreground">{progressPercent}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className={`h-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-primary to-violet-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            {doneTasks} of {totalTasks} tasks complete
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 border-t pt-3">
          {project.drive_folder_id ? (
            <Button
              variant="ghost"
              size="xs"
              nativeButton={false}
              render={
                <a
                  href={`https://drive.google.com/drive/folders/${project.drive_folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Folder className="size-3.5 text-primary" />
              Drive
            </Button>
          ) : (
            <RetryDriveButton projectId={project.id} />
          )}

          <Button
            variant="outline"
            size="xs"
            nativeButton={false}
            render={<Link href={`/projects/${project.id}`} />}
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
