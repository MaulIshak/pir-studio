'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  SquaresFour,
  GameController,
  Buildings,
  User as UserIcon,
  List,
} from '@phosphor-icons/react'
import { useSidebar } from '@/components/ui/sidebar'
import { useAppSession } from '@/components/providers/session-context'
import { cn } from 'cn'

export function BottomNav() {
  const pathname = usePathname()
  const { setOpenMobile, openMobile } = useSidebar()
  const { activeOrg } = useAppSession()

  if (pathname === '/login' || pathname === '/privacy' || pathname === '/terms') {
    return null
  }

  const orgHref = activeOrg ? `/orgs/${activeOrg.slug}` : '/orgs/new'

  const items = [
    {
      label: 'Home',
      href: '/',
      icon: SquaresFour,
      isActive: pathname === '/',
    },
    {
      label: 'Projects',
      href: '/projects',
      icon: GameController,
      isActive: pathname === '/projects' || pathname.startsWith('/projects/'),
    },
    {
      label: 'Org',
      href: orgHref,
      icon: Buildings,
      isActive: pathname.startsWith('/orgs/'),
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: UserIcon,
      isActive: pathname === '/profile',
    },
  ]

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid h-15 grid-cols-5 items-center px-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors active:scale-95',
                item.isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-10 items-center justify-center rounded-full transition-colors',
                  item.isActive && 'bg-primary/12'
                )}
              >
                <Icon
                  className="size-5"
                  weight={item.isActive ? 'fill' : 'regular'}
                />
              </span>
              <span className={cn('truncate leading-none', item.isActive && 'font-semibold')}>
                {item.label}
              </span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          aria-label="Open menu"
          aria-expanded={openMobile}
          className={cn(
            'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors active:scale-95',
            openMobile
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span
            className={cn(
              'flex h-6 w-10 items-center justify-center rounded-full transition-colors',
              openMobile && 'bg-primary/12'
            )}
          >
            <List className="size-5" weight={openMobile ? 'bold' : 'regular'} />
          </span>
          <span className="truncate leading-none">More</span>
        </button>
      </div>
    </nav>
  )
}
