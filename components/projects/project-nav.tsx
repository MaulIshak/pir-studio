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
  Users,
} from '@phosphor-icons/react'

interface ProjectNavProps {
  projectSlug: string
  canManageMembers?: boolean
}

export function ProjectNav({ projectSlug, canManageMembers = false }: ProjectNavProps) {
  const pathname = usePathname()

  const tabs = [
    { label: 'Overview', href: `/projects/${projectSlug}`, icon: Gauge },
    { label: 'Tasks', href: `/projects/${projectSlug}/tasks`, icon: Kanban },
    { label: 'Milestones', href: `/projects/${projectSlug}/milestones`, icon: Flag },
    { label: 'Assets', href: `/projects/${projectSlug}/assets`, icon: Package },
    { label: 'Credits', href: `/projects/${projectSlug}/credits`, icon: Certificate },
    { label: 'Artifacts', href: `/projects/${projectSlug}/artifacts`, icon: LinkIcon },
    ...(canManageMembers
      ? [{ label: 'Members', href: `/projects/${projectSlug}/members`, icon: Users }]
      : []),
  ]

  return (
    <nav
      aria-label="Project sections"
      className="sticky top-12 z-20 -mx-4 px-4 py-1.5 bg-background/95 backdrop-blur-sm md:static md:mx-0 md:px-0 md:py-0 md:pb-2 md:bg-transparent flex items-center gap-1 border-b border-border/80 overflow-x-auto no-scrollbar flex-nowrap scroll-smooth snap-x"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive =
          tab.href === `/projects/${projectSlug}`
            ? pathname === tab.href
            : pathname.startsWith(tab.href)

        return (
          <div key={tab.href} className="relative shrink-0 snap-start">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={tab.href} aria-current={isActive ? 'page' : undefined} />}
              className={`gap-1.5 border transition-colors whitespace-nowrap h-9 md:h-8 px-3 text-xs ${
                isActive
                  ? 'font-semibold text-primary bg-primary/10 border-primary/20'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Icon className={`size-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {tab.label}
            </Button>
            {isActive && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute -bottom-2 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
