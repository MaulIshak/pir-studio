'use client'

import { usePathname } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { TopNavBar } from '@/components/layout/top-nav-bar'
import { AiAssistantFab } from '@/components/ai/ai-assistant-fab'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/privacy' || pathname === '/terms') {
    return <main className="min-h-screen w-full">{children}</main>
  }

  return (
    <TooltipProvider delay={200}>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <SidebarInset>
          <TopNavBar />
          <div className="flex-1 min-w-0 overflow-x-hidden">{children}</div>
        </SidebarInset>
        <AiAssistantFab />
      </SidebarProvider>
    </TooltipProvider>
  )
}
