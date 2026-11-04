'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getUserOrganizations,
  switchActiveOrg,
  getActiveOrg,
} from '@/actions/organizations'
import { createClient } from '@/lib/supabase/client'
import { notifyOrgChanged, notifyProjectsChanged, ORG_CHANGED_EVENT } from '@/lib/events'
import type { ActiveOrg } from '@/lib/auth/active-org'
import type { OrgRole } from '@/lib/auth/permissions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  CaretUpDown,
  Check,
  Plus,
  Buildings,
  Users,
  Gauge,
  Flag,
} from '@phosphor-icons/react'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'

interface OrgSwitcherProps {
  initialActiveOrg?: ActiveOrg | null
}

export function OrgSwitcher({ initialActiveOrg = null }: OrgSwitcherProps) {
  const [activeOrg, setActiveOrg] = useState<ActiveOrg | null>(initialActiveOrg)
  const [organizations, setOrganizations] = useState<
    Array<{
      id: string
      name: string
      slug: string
      role: OrgRole
    }>
  >([])
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const [orgs, active] = await Promise.all([
          getUserOrganizations(),
          getActiveOrg(),
        ])
        if (isMounted) {
          setOrganizations(orgs)
          if (active) {
            setActiveOrg(active)
          } else if (orgs.length > 0) {
            setActiveOrg(orgs[0])
          }
        }
      } catch (err) {
        console.error('Failed to load user organizations:', err)
      }
    }

    void load()

    // 1. Listen for local client-side org change events
    const handleOrgChanged = () => {
      void load()
    }
    window.addEventListener(ORG_CHANGED_EVENT, handleOrgChanged)

    // 2. Realtime listener for organization_members changes
    const channel = supabase
      .channel('org-switcher-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organization_members' },
        () => {
          void load()
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      window.removeEventListener(ORG_CHANGED_EVENT, handleOrgChanged)
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleSwitch = (orgId: string) => {
    startTransition(async () => {
      const res = await switchActiveOrg(orgId)
      if (res.success) {
        const selected = organizations.find((o) => o.id === orgId)
        if (selected) setActiveOrg(selected)
        notifyOrgChanged(orgId)
        notifyProjectsChanged()
        router.refresh()
      }
    })
  }

  const renderRoleBadge = (role: OrgRole) => {
    switch (role) {
      case 'leader':
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0 capitalize"
          >
            Leader
          </Badge>
        )
      case 'co_leader':
        return (
          <Badge
            variant="outline"
            className="border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px] px-1.5 py-0 capitalize"
          >
            Co-Leader
          </Badge>
        )
      default:
        return (
          <Badge
            variant="outline"
            className="border-muted-foreground/30 bg-muted/40 text-muted-foreground text-[10px] px-1.5 py-0 capitalize"
          >
            Member
          </Badge>
        )
    }
  }

  if (!activeOrg) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="New Organization"
            render={<Link href="/orgs/new" />}
            className="border border-dashed border-sidebar-border hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center text-muted-foreground hover:text-foreground"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
              <span className="font-medium text-foreground">New Organization</span>
              <span className="truncate text-[10px] text-muted-foreground">Create workspace</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={activeOrg.name}
                className="hover:bg-sidebar-accent cursor-pointer group-data-[collapsible=icon]:justify-center data-[state=open]:bg-sidebar-accent"
                disabled={isPending}
              />
            }
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Buildings className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate font-semibold text-sidebar-foreground">
                  {activeOrg.name}
                </span>
                {renderRoleBadge(activeOrg.role)}
              </div>
              <span className="truncate text-[10px] text-muted-foreground">
                Organization
              </span>
            </div>
            <CaretUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={6}
            className="w-64 p-1 shadow-lg border border-border bg-card"
          >
            <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold px-2 py-1.5">
              Organizations
            </DropdownMenuLabel>

            <DropdownMenuGroup>
              {organizations.map((org) => {
                const isSelected = org.id === activeOrg.id
                return (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleSwitch(org.id)}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Buildings className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-xs font-medium">{org.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderRoleBadge(org.role)}
                      {isSelected && <Check className="size-3 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link href={`/orgs/${activeOrg.slug}`} />}
                className="flex items-center gap-2 text-xs px-2 py-1.5 cursor-pointer"
              >
                <Gauge className="size-3.5 text-muted-foreground" />
                <span>Org Dashboard</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href={`/orgs/${activeOrg.slug}/milestones`} />}
                className="flex items-center gap-2 text-xs px-2 py-1.5 cursor-pointer"
              >
                <Flag className="size-3.5 text-muted-foreground" />
                <span>Org Milestones</span>
              </DropdownMenuItem>

              {(activeOrg.role === 'leader' || activeOrg.role === 'co_leader') && (
                <DropdownMenuItem
                  render={<Link href={`/orgs/${activeOrg.slug}/members`} />}
                  className="flex items-center gap-2 text-xs px-2 py-1.5 cursor-pointer"
                >
                  <Users className="size-3.5 text-muted-foreground" />
                  <span>Manage Members</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              render={<Link href="/orgs/new" />}
              className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 cursor-pointer text-primary focus:text-primary"
            >
              <Plus className="size-3.5" />
              <span>New Organization</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
