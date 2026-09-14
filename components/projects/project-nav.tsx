'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Gauge,
  Kanban,
  Flag,
  Package,
  Certificate,
  Link as LinkIcon,
} from '@phosphor-icons/react'

interface ProjectNavProps {
  projectId: string
}

export function ProjectNav({ projectId }: ProjectNavProps) {
  const pathname = usePathname()

  const tabs = [
    { label: 'Overview', href: `/projects/${projectId}`, icon: Gauge },
    { label: 'Tasks', href: `/projects/${projectId}/tasks`, icon: Kanban },
    { label: 'Milestones', href: `/projects/${projectId}/milestones`, icon: Flag },
    { label: 'Assets', href: `/projects/${projectId}/assets`, icon: Package },
    { label: 'Credits', href: `/projects/${projectId}/credits`, icon: Certificate },
    { label: 'Artifacts', href: `/projects/${projectId}/artifacts`, icon: LinkIcon },
  ]

  return (
    <div className="flex items-center gap-1.5 border-b pb-2 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive =
          tab.href === `/projects/${projectId}`
            ? pathname === tab.href
            : pathname.startsWith(tab.href)

        return (
          <div key={tab.href} className="relative">
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              nativeButton={false}
              render={<Link href={tab.href} />}
              className={`gap-1.5 transition-colors ${
                isActive
                  ? 'font-semibold text-primary bg-primary/10 border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`size-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {tab.label}
            </Button>
            {isActive && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute -bottom-2 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
