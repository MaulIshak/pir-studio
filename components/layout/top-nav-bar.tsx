'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GoogleDriveLogo, Plus, CheckCircle, CaretRight } from '@phosphor-icons/react'
import type { User } from '@supabase/supabase-js'
import { ThemeToggle } from '@/components/layout/theme-toggle'

export function TopNavBar() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [hasDriveToken, setHasDriveToken] = useState<boolean | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const { data: token } = await supabase
          .from('oauth_tokens')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('provider', 'google')
          .maybeSingle()
        setHasDriveToken(!!token)
      } else {
        setHasDriveToken(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setHasDriveToken(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
          pathname || '/'
        )}`,
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  if (pathname === '/login') {
    return null
  }

  // Format breadcrumb segments
  const segments = pathname.split('/').filter(Boolean)
  let breadcrumbTitle = 'Dashboard'
  let subSection = ''

  if (segments.length === 0) {
    breadcrumbTitle = 'Dashboard'
  } else if (segments[0] === 'projects') {
    if (segments.length === 1) {
      breadcrumbTitle = 'Projects'
    } else if (segments[1] === 'new') {
      breadcrumbTitle = 'Projects'
      subSection = 'New Project'
    } else {
      breadcrumbTitle = segments[1]
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      if (segments[2]) {
        subSection = segments[2].charAt(0).toUpperCase() + segments[2].slice(1)
      } else {
        subSection = 'Overview'
      }
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-13 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-3 sm:px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 min-w-0 overflow-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs min-w-0 flex-1 mr-2">
        <SidebarTrigger className="-ml-1 size-7 shrink-0 text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="mr-0.5 sm:mr-1 h-4 shrink-0" />
        <div className="flex items-center gap-1 sm:gap-1.5 font-medium text-foreground min-w-0 overflow-hidden">
          {segments.length <= 1 ? (
            <span className="text-muted-foreground truncate">
              {segments.length === 0 ? 'Dashboard' : 'Projects'}
            </span>
          ) : (
            <>
              <span className="text-muted-foreground hidden md:inline shrink-0">Projects</span>
              <CaretRight className="size-3 text-muted-foreground hidden md:inline shrink-0" />
              <span className="max-w-[100px] xs:max-w-[140px] sm:max-w-xs truncate text-foreground font-semibold">
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
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {user && hasDriveToken !== null && (
          hasDriveToken ? (
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] text-emerald-400 py-0.5 px-1.5 sm:px-2 shrink-0"
              title="Google Drive connected for file provisioning and storage"
            >
              <GoogleDriveLogo className="size-3 text-emerald-400" />
              <CheckCircle className="size-2.5 text-emerald-400" />
            </Badge>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              onClick={handleSignIn}
              className="border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[11px] py-0.5 px-2 gap-1 sm:gap-1.5 shrink-0"
              title="Connect Google Drive to enable auto-provisioning and file uploads"
            >
              <GoogleDriveLogo className="size-3 text-amber-400" />
              <span className="hidden sm:inline">Connect Drive</span>
              <span className="sm:hidden">Drive</span>
            </Button>
          )
        )}

        {user && (
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

        <ThemeToggle />
      </div>
    </header>
  )
}
