'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  GoogleDriveLogo,
  SignOut,
  Plus,
  SquaresFour,
  Kanban,
  CheckCircle,
} from '@phosphor-icons/react'
import type { User } from '@supabase/supabase-js'

export function AppHeader() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [hasDriveToken, setHasDriveToken] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
      setIsLoading(false)
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

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setHasDriveToken(false)
    window.location.reload()
  }

  if (pathname === '/login') {
    return null
  }

  const isDashboard = pathname === '/'
  const isProjects = pathname === '/projects' || pathname.startsWith('/projects/')

  const userAvatar = user?.user_metadata?.avatar_url
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Member'
  const userEmail = user?.email

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* Left: Brand Identity & Nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-heading text-sm font-bold tracking-tight text-foreground transition-colors hover:text-primary"
          >
            <div className="relative flex size-7 items-center justify-center overflow-hidden rounded-md">
              <Image
                src="/logo.png"
                alt="Pir Studio"
                width={28}
                height={28}
                className="size-7 object-contain"
                priority
              />
            </div>
            <span>Pir Studio</span>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 sm:flex">
              <Link
                href="/"
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isDashboard
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <SquaresFour className="size-3.5" />
                Dashboard
              </Link>
              <Link
                href="/projects"
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isProjects
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Kanban className="size-3.5" />
                Projects
              </Link>
            </nav>
          )}
        </div>

        {/* Right: Actions, Auth & Drive Status */}
        <div className="flex items-center gap-2.5">
          {user && (
            <Button
              nativeButton={false}
              render={<Link href="/projects/new" />}
              size="xs"
              variant="outline"
              className="hidden sm:inline-flex"
            >
              <Plus className="size-3" />
              New Project
            </Button>
          )}

          {isLoading ? (
            <div className="h-7 w-20 animate-pulse rounded-md bg-secondary" />
          ) : user ? (
            <div className="flex items-center gap-2">
              {hasDriveToken ? (
                <Badge
                  variant="outline"
                  className="hidden items-center gap-1 border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] text-emerald-400 md:inline-flex"
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
                  className="hidden border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 md:inline-flex text-[11px]"
                  title="Connect Google Drive to enable auto-provisioning and file uploads"
                >
                  <GoogleDriveLogo className="size-3 text-amber-400" />
                  Connect Drive
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="flex items-center gap-2 rounded-full border border-border/80 p-0.5 transition-opacity hover:opacity-80 focus:outline-hidden">
                      {userAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={userAvatar}
                          alt={userName}
                          className="size-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium leading-none text-foreground">
                        {userName}
                      </span>
                      {userEmail && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {userEmail}
                        </span>
                      )}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignIn}
                    className="flex items-center gap-2 text-xs"
                  >
                    <GoogleDriveLogo className="size-3.5 text-muted-foreground" />
                    {hasDriveToken ? 'Re-sync Google Drive' : 'Connect Google Drive'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-xs"
                  >
                    <SignOut className="size-3.5" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
