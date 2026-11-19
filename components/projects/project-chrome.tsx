'use client'

import { usePathname } from 'next/navigation'

interface ProjectChromeProps {
  header: React.ReactNode
  nav: React.ReactNode
  children: React.ReactNode
}

const FULL_VIEWPORT_BOARD_RE = /^\/projects\/[^/]+\/boards\/[^/]+$/

/**
 * Renders standard project header & navigation tabs on all project sub-pages,
 * while giving individual whiteboard canvas pages full-viewport space.
 */
export function ProjectChrome({ header, nav, children }: ProjectChromeProps) {
  const pathname = usePathname()

  if (FULL_VIEWPORT_BOARD_RE.test(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 sm:gap-6 px-3.5 py-4 sm:p-6">
      {header}
      {nav}
      <div>{children}</div>
    </div>
  )
}

