'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { TaskSummary } from './project-charts'

const ProjectCharts = dynamic(
  () => import('./project-charts').then((m) => m.ProjectCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    ),
  }
)

export function ProjectChartsLazy({ tasks }: { tasks: TaskSummary[] }) {
  return <ProjectCharts tasks={tasks} />
}
