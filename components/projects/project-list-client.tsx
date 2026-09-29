'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectCard } from './project-card'
import { EmptyState } from './empty-state'
import { GameController, CheckCircle, Archive, FolderDashed } from '@phosphor-icons/react'

interface Project {
  id: string
  slug: string
  name: string
  type: 'jam' | 'competition' | 'internal'
  status: 'active' | 'completed' | 'archived'
  start_date: string | null
  deadline: string | null
  description: string | null
  drive_folder_id: string | null
  tasks?: Array<{ id: string; status: string }>
}

export function ProjectListClient({
  initialProjects,
  canCreateProject = true,
}: {
  initialProjects: Project[]
  canCreateProject?: boolean
}) {
  const [tab, setTab] = useState<string>('active')

  const filteredProjects = initialProjects.filter((p) => p.status === tab)

  const emptyTitle =
    tab === 'active'
      ? canCreateProject
        ? 'No active projects'
        : 'No assigned projects'
      : `No ${tab} projects`

  const emptyDescription =
    tab === 'active'
      ? canCreateProject
        ? 'Start a new game jam or competition project.'
        : 'You have not been assigned to any projects in this organization yet. Contact a leader or co-leader for access.'
      : `No projects currently marked as ${tab}.`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(val) => setTab(val as string)}>
          <TabsList className="w-full sm:w-fit justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="active" className="flex items-center gap-1.5">
              <GameController className="size-3.5" />
              Active
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-1.5">
              <CheckCircle className="size-3.5 text-emerald-500" />
              Completed
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex items-center gap-1.5">
              <Archive className="size-3.5 text-muted-foreground" />
              Archived
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <AnimatePresence mode="wait">
        {filteredProjects.length === 0 ? (
          <motion.div
            key={`empty-${tab}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              icon={<FolderDashed className="size-7" />}
              actionLabel={canCreateProject && tab === 'active' ? 'New Project' : undefined}
              actionHref={canCreateProject && tab === 'active' ? '/projects/new' : undefined}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`grid-${tab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
