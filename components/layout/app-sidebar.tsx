'use client'

import { useEffect, useState, useRef, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAllProjectsForNav, type NavProject } from '@/actions/projects'
import { PROJECTS_CHANGED_EVENT } from '@/lib/events'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  SquaresFour,
  Gauge,
  Kanban,
  Flag,
  Package,
  Certificate,
  Link as LinkIcon,
  Plus,
  CaretRight,
  GoogleDriveLogo,
  SignOut,
  DotsThreeVertical,
  GameController,
  Trophy,
  Folder,
  PlugsConnected,
  CheckCircle,
  Sun,
  Moon,
  Desktop,
  Check,
} from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import type { User } from '@supabase/supabase-js'

interface AppSidebarProps {
  initialProjects?: NavProject[]
}

export function AppSidebar({ initialProjects = [] }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { setOpenMobile, isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [hasDriveToken, setHasDriveToken] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<NavProject[]>(initialProjects)
  const [isLoadingProjects, setIsLoadingProjects] = useState(initialProjects.length === 0)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()
  const projectsRef = useRef(projects)
  const supabase = createClient()

  useEffect(() => {
    projectsRef.current = projects
  }, [projects])

  // Load user & Drive token
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
      setIsAuthLoading(false)
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

  // Fetch navigation projects & subscribe to realtime changes & local project events
  useEffect(() => {
    let isMounted = true

    async function fetchNavProjects() {
      try {
        const data = await getAllProjectsForNav()
        if (isMounted) {
          setProjects(data)
          setIsLoadingProjects(false)
        }
      } catch (err) {
        console.error('Failed to fetch navigation projects:', err)
        if (isMounted) setIsLoadingProjects(false)
      }
    }

    if (initialProjects.length === 0) {
      fetchNavProjects()
    }

    // 1. Instant local event synchronization (fired immediately on project create/edit/archive)
    const handleProjectsChanged = (e: Event) => {
      const customEvent = e as CustomEvent<NavProject | undefined>
      const newProject = customEvent.detail

      if (newProject) {
        // Optimistic instant addition to sidebar list
        setProjects((prev) => {
          if (prev.some((p) => p.id === newProject.id || p.slug === newProject.slug)) {
            return prev.map((p) => (p.id === newProject.id ? newProject : p))
          }
          return [newProject, ...prev]
        })
        setOpenProjects((prev) => ({ ...prev, [newProject.slug]: true }))
      }

      // Re-fetch in background to ensure database consistency
      startTransition(async () => {
        const fresh = await getAllProjectsForNav()
        if (isMounted) {
          setProjects(fresh)
          setIsLoadingProjects(false)
        }
      })
    }

    window.addEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged)

    // 2. Subscribe to realtime changes on projects table (cross-tab / multi-user sync)
    const channel = supabase
      .channel('sidebar-projects-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          startTransition(async () => {
            const fresh = await getAllProjectsForNav()
            if (isMounted) setProjects(fresh)
          })
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
      window.removeEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged)
    }
  }, [supabase, initialProjects.length])

  // Automatically expand project when route matches, and fetch if active project is missing
  useEffect(() => {
    const match = pathname.match(/^\/projects\/([^/]+)/)
    if (match && match[1] && match[1] !== 'new') {
      const activeSlug = match[1]
      queueMicrotask(() => {
        setOpenProjects((prev) => (prev[activeSlug] ? prev : {
          ...prev,
          [activeSlug]: true,
        }))
      })

      // If active project is not yet loaded into sidebar projects, fetch immediately
      const currentList = projectsRef.current
      if (currentList.length > 0 && !currentList.some((p) => p.slug === activeSlug || p.id === activeSlug)) {
        startTransition(async () => {
          const fresh = await getAllProjectsForNav()
          setProjects(fresh)
        })
      }
    }
  }, [pathname])

  const toggleProject = (slug: string) => {
    setOpenProjects((prev) => ({
      ...prev,
      [slug]: !prev[slug],
    }))
  }

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

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
    router.push('/login')
    router.refresh()
  }

  // Do not render sidebar on login page
  if (pathname === '/login') {
    return null
  }

  const userAvatar = user?.user_metadata?.avatar_url
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Member'
  const userEmail = user?.email || ''

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" onClick={handleLinkClick} />}
              className="hover:bg-sidebar-accent"
            >
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 border border-primary/20">
                <Image
                  src="/logo.png"
                  alt="Pir Studio"
                  width={24}
                  height={24}
                  className="size-6 object-contain"
                  priority
                />
              </div>
              <div className="grid flex-1 text-left text-xs leading-tight">
                <span className="font-heading font-bold tracking-tight text-sidebar-foreground">
                  Pir Studio
                </span>
                <span className="truncate text-[10px] text-muted-foreground font-mono">
                  GameDev Hub
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-2 py-2">
        {/* Dashboard Group */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/" onClick={handleLinkClick} />}
                isActive={pathname === '/'}
                tooltip="Dashboard"
              >
                <SquaresFour className="size-4" />
                <span className="font-medium">Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/mcp" onClick={handleLinkClick} />}
                isActive={pathname.startsWith('/mcp')}
                tooltip="MCP Setup"
              >
                <PlugsConnected className="size-4" />
                <span className="font-medium">MCP Setup</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Projects Tree Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
            <span>Projects</span>
          </SidebarGroupLabel>
          <SidebarGroupAction
            render={<Link href="/projects/new" onClick={handleLinkClick} />}
            title="New Project"
          >
            <Plus className="size-3.5" />
            <span className="sr-only">New Project</span>
          </SidebarGroupAction>

          <SidebarGroupContent>
            <SidebarMenu>
              {isLoadingProjects ? (
                <>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                </>
              ) : projects.length === 0 ? (
                <div className="px-2 py-3 text-center">
                  <p className="text-[11px] text-muted-foreground">No projects yet</p>
                  <Link
                    href="/projects/new"
                    onClick={handleLinkClick}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Plus className="size-3" />
                    Create project
                  </Link>
                </div>
              ) : (
                projects.map((project) => {
                  const isProjectRoute = pathname.startsWith(`/projects/${project.slug}`)
                  const isOpen = openProjects[project.slug] ?? isProjectRoute

                  const subNavItems = [
                    {
                      label: 'Overview',
                      href: `/projects/${project.slug}`,
                      icon: Gauge,
                      isActive: pathname === `/projects/${project.slug}`,
                    },
                    {
                      label: 'Tasks',
                      href: `/projects/${project.slug}/tasks`,
                      icon: Kanban,
                      isActive: pathname.startsWith(`/projects/${project.slug}/tasks`),
                    },
                    {
                      label: 'Milestones',
                      href: `/projects/${project.slug}/milestones`,
                      icon: Flag,
                      isActive: pathname.startsWith(`/projects/${project.slug}/milestones`),
                    },
                    {
                      label: 'Assets',
                      href: `/projects/${project.slug}/assets`,
                      icon: Package,
                      isActive: pathname.startsWith(`/projects/${project.slug}/assets`),
                    },
                    {
                      label: 'Credits',
                      href: `/projects/${project.slug}/credits`,
                      icon: Certificate,
                      isActive: pathname.startsWith(`/projects/${project.slug}/credits`),
                    },
                    {
                      label: 'Artifacts',
                      href: `/projects/${project.slug}/artifacts`,
                      icon: LinkIcon,
                      isActive: pathname.startsWith(`/projects/${project.slug}/artifacts`),
                    },
                  ]

                  return (
                    <Collapsible
                      key={project.id}
                      open={isOpen}
                      onOpenChange={() => toggleProject(project.slug)}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          render={
                            <Link
                              href={`/projects/${project.slug}`}
                              onClick={() => {
                                handleLinkClick()
                                setOpenProjects((prev) => ({
                                  ...prev,
                                  [project.slug]: true,
                                }))
                              }}
                            />
                          }
                          isActive={pathname === `/projects/${project.slug}`}
                          tooltip={project.name}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {project.type === 'jam' ? (
                              <GameController className="size-3.5 shrink-0 text-purple-400" />
                            ) : project.type === 'competition' ? (
                              <Trophy className="size-3.5 shrink-0 text-amber-400" />
                            ) : (
                              <Folder className="size-3.5 shrink-0 text-sky-400" />
                            )}
                            <span className="truncate text-xs font-medium">
                              {project.name}
                            </span>
                          </div>
                          <span
                            className={`size-1.5 rounded-full shrink-0 ${
                              project.status === 'active'
                                ? 'bg-emerald-500'
                                : project.status === 'completed'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-400'
                            }`}
                            title={`Status: ${project.status}`}
                          />
                        </SidebarMenuButton>

                        <CollapsibleTrigger
                          render={
                            <SidebarMenuAction
                              className={`transition-transform duration-200 ${
                                isOpen ? 'rotate-90' : ''
                              }`}
                              showOnHover={false}
                            />
                          }
                        >
                          <CaretRight className="size-3 text-muted-foreground" />
                          <span className="sr-only">Toggle {project.name} menu</span>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {subNavItems.map((item) => (
                              <SidebarMenuSubItem key={item.href}>
                                <SidebarMenuSubButton
                                  render={<Link href={item.href} onClick={handleLinkClick} />}
                                  isActive={item.isActive}
                                  size="sm"
                                  className={
                                    item.isActive
                                      ? 'font-medium text-primary bg-primary/10 border-l-2 border-primary'
                                      : 'text-muted-foreground hover:text-foreground'
                                  }
                                >
                                  <item.icon className="size-3.5" />
                                  <span>{item.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Profile Footer */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {isAuthLoading ? (
              <div className="flex items-center gap-2 p-2">
                <div className="size-8 animate-pulse rounded-lg bg-sidebar-accent" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-20 animate-pulse rounded bg-sidebar-accent" />
                  <div className="h-2 w-28 animate-pulse rounded bg-sidebar-accent" />
                </div>
              </div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent cursor-pointer"
                    />
                  }
                >
                  <Avatar size="sm" className="size-7 rounded-lg">
                    {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                    <AvatarFallback className="rounded-lg bg-primary/20 text-xs font-semibold text-primary">
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium text-sidebar-foreground">
                      {userName}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                  <DotsThreeVertical className="ml-auto size-4 text-muted-foreground" />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-56"
                  side="top"
                  align="end"
                  sideOffset={8}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium leading-none text-foreground">
                        {userName}
                      </span>
                      {userEmail && (
                        <span className="truncate text-[10px] text-muted-foreground font-normal">
                          {userEmail}
                        </span>
                      )}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignIn}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <GoogleDriveLogo className="size-3.5 text-muted-foreground" />
                    <span>{hasDriveToken ? 'Re-sync Google Drive' : 'Connect Google Drive'}</span>
                    {hasDriveToken && (
                      <CheckCircle className="ml-auto size-3 text-emerald-500" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-xs cursor-pointer">
                      {theme === 'dark' ? (
                        <Moon className="size-3.5 text-muted-foreground" />
                      ) : theme === 'light' ? (
                        <Sun className="size-3.5 text-muted-foreground" />
                      ) : (
                        <Desktop className="size-3.5 text-muted-foreground" />
                      )}
                      <span>Theme</span>
                      <span className="text-[10px] capitalize text-muted-foreground font-mono mr-1">
                        {theme || 'system'}
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-36">
                      <DropdownMenuItem
                        onClick={() => setTheme('light')}
                        className="flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Sun className="size-3.5" />
                          <span>Light</span>
                        </div>
                        {theme === 'light' && <Check className="size-3 text-primary font-bold" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTheme('dark')}
                        className="flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Moon className="size-3.5" />
                          <span>Dark</span>
                        </div>
                        {theme === 'dark' && <Check className="size-3 text-primary font-bold" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTheme('system')}
                        className="flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Desktop className="size-3.5" />
                          <span>System</span>
                        </div>
                        {theme === 'system' && <Check className="size-3 text-primary font-bold" />}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <SignOut className="size-3.5" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton
                onClick={handleSignIn}
                className="justify-center border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium"
              >
                <span>Sign In</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
