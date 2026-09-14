'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectCard } from './project-card'
import { EmptyState } from './empty-state'
import { GameController, CheckCircle, Archive, FolderDashed } from '@phosphor-icons/react'

interface Project {
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

export function ProjectListClient({ initialProjects }: { initialProjects: Project[] }) {
  const [tab, setTab] = useState<string>('active')

  const filteredProjects = initialProjects.filter((p) => p.status === tab)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(val) => setTab(val as string)}>
          <TabsList>
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
              title={`No ${tab} projects`}
              description={
                tab === 'active'
                  ? 'Start a new game jam or competition project.'
                  : `No projects currently marked as ${tab}.`
              }
              icon={<FolderDashed className="size-7" />}
              actionLabel={tab === 'active' ? 'New Project' : undefined}
              actionHref={tab === 'active' ? '/projects/new' : undefined}
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
