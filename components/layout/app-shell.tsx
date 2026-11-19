'use client'

import { usePathname } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSessionProvider } from '@/components/providers/session-context'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { TopNavBar } from '@/components/layout/top-nav-bar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { AiAssistantFab } from '@/components/ai/ai-assistant-fab'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/privacy' || pathname === '/terms') {
    return <main className="min-h-screen w-full">{children}</main>
  }

  if (/^\/projects\/[^/]+\/boards\/[^/]+$/.test(pathname)) {
    return (
      <MotionConfig reducedMotion="user">
        <AppSessionProvider>
          <TooltipProvider delay={200}>
            <main id="main-content" className="h-dvh w-screen overflow-hidden outline-none">
              {children}
            </main>
          </TooltipProvider>
        </AppSessionProvider>
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppSessionProvider>
        <TooltipProvider delay={200}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-primary focus:px-3 focus:py-1.5 focus:text-xs focus:font-medium focus:text-primary-foreground focus:outline-none"
          >
            Skip to content
          </a>
          <SidebarProvider defaultOpen={true}>
            <AppSidebar />
            <SidebarInset>
              <TopNavBar />
              <main
                id="main-content"
                tabIndex={-1}
                className="flex-1 min-w-0 overflow-x-clip pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 outline-none"
              >
                {children}
              </main>
            </SidebarInset>
            <BottomNav />
            <AiAssistantFab />
          </SidebarProvider>
        </TooltipProvider>
      </AppSessionProvider>
    </MotionConfig>
  )
}
