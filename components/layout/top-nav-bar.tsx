'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, CaretRight } from '@phosphor-icons/react'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { NotificationsPopover } from '@/components/notifications/notifications-popover'
import { useAppSession } from '@/components/providers/session-context'

export function TopNavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, activeOrg } = useAppSession()

  if (pathname === '/login') {
    return null
  }

  // Format breadcrumb segments
  const segments = pathname.split('/').filter(Boolean)
  let sectionPrefix = ''
  let breadcrumbTitle = 'Dashboard'
  let subSection = ''
  let backHref: string | null = null

  if (segments.length === 0) {
    breadcrumbTitle = 'Dashboard'
  } else if (segments[0] === 'projects') {
    sectionPrefix = 'Projects'
    if (segments.length === 1) {
      breadcrumbTitle = 'Projects'
    } else if (segments[1] === 'new') {
      breadcrumbTitle = 'New Project'
      backHref = '/projects'
    } else {
      breadcrumbTitle = segments[1]
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      if (segments[2]) {
        subSection = segments[2].charAt(0).toUpperCase() + segments[2].slice(1)
        backHref = `/projects/${segments[1]}`
      } else {
        subSection = 'Overview'
        backHref = '/projects'
      }
    }
  } else if (segments[0] === 'orgs') {
    sectionPrefix = 'Organization'
    if (segments.length === 1) {
      breadcrumbTitle = 'Organizations'
    } else if (segments[1] === 'new') {
      breadcrumbTitle = 'New Organization'
      backHref = '/'
    } else {
      breadcrumbTitle =
        activeOrg?.name ||
        segments[1]
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      if (segments[2]) {
        subSection = segments[2].charAt(0).toUpperCase() + segments[2].slice(1)
        backHref = `/orgs/${segments[1]}`
      } else {
        subSection = 'Overview'
      }
    }
  } else if (segments[0] === 'mcp') {
    breadcrumbTitle = 'MCP Setup'
    backHref = '/'
  } else if (segments[0] === 'profile') {
    breadcrumbTitle = 'Profile'
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 md:h-13 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-3 sm:px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 min-w-0 overflow-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs min-w-0 flex-1 mr-2">
        <SidebarTrigger className="hidden md:inline-flex -ml-1 size-7 shrink-0 text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="hidden md:block mr-0.5 sm:mr-1 h-4 shrink-0" />

        {backHref && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push(backHref)}
            aria-label="Go back"
            className="md:hidden -ml-1 size-9 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}

        <nav aria-label="Breadcrumb" className="flex items-center gap-1 sm:gap-1.5 font-medium text-foreground min-w-0 overflow-hidden">
          {segments.length <= 1 ? (
            <span className="text-sm md:text-xs font-semibold md:font-medium text-foreground md:text-muted-foreground truncate">
              {breadcrumbTitle}
            </span>
          ) : (
            <>
              {sectionPrefix && (
                <>
                  <span className="text-muted-foreground hidden md:inline shrink-0">{sectionPrefix}</span>
                  <CaretRight className="size-3 text-muted-foreground hidden md:inline shrink-0" />
                </>
              )}
              <span className="max-w-[130px] xs:max-w-[160px] sm:max-w-xs truncate text-foreground font-semibold">
                {breadcrumbTitle}
              </span>
            </>
          )}
          {subSection && (
            <>
              <CaretRight className="size-3 text-muted-foreground shrink-0" />
              <span className="text-primary font-semibold truncate">{subSection}</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {user && (activeOrg?.role === 'leader' || activeOrg?.role === 'co_leader') && (
          <Button
            nativeButton={false}
            render={<Link href="/projects/new" />}
            size="xs"
            variant="outline"
            className="hidden sm:inline-flex gap-1 shrink-0"
          >
            <Plus className="size-3" />
            <span>New Project</span>
          </Button>
        )}

        <Separator orientation="vertical" className="hidden sm:block h-4 mx-0.5 shrink-0" />

        <NotificationsPopover />

        <ThemeToggle />
      </div>
    </header>
  )
}
