'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Gauge, Flag, Users } from '@phosphor-icons/react'

interface OrgNavProps {
  orgSlug: string
  canManage?: boolean
}

export function OrgNav({ orgSlug, canManage = false }: OrgNavProps) {
  const pathname = usePathname()

  const tabs = [
    { label: 'Overview', href: `/orgs/${orgSlug}`, icon: Gauge },
    { label: 'Milestones', href: `/orgs/${orgSlug}/milestones`, icon: Flag },
    ...(canManage ? [{ label: 'Members', href: `/orgs/${orgSlug}/members`, icon: Users }] : []),
  ]

  return (
    <nav
      aria-label="Organization sections"
      className="sticky top-12 z-20 -mx-4 px-4 py-1.5 bg-background/95 backdrop-blur-sm md:static md:mx-0 md:px-0 md:py-0 md:pb-2 md:bg-transparent flex items-center gap-1 border-b border-border/80 overflow-x-auto no-scrollbar flex-nowrap scroll-smooth snap-x"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive =
          tab.href === `/orgs/${orgSlug}`
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
                layoutId="activeOrgTabUnderline"
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
