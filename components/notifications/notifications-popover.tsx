'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getUserNotifications,
  acceptOrgInvitation,
  declineOrgInvitation,
  markNotificationAsRead,
  type UserNotification,
} from '@/actions/notifications'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, Check, X, EnvelopeSimple, Buildings, BellSlash } from '@phosphor-icons/react'
import { notifyOrgChanged, notifyProjectsChanged } from '@/lib/events'

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const refreshNotifications = async () => {
    try {
      const data = await getUserNotifications()
      setNotifications(data)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }

  useEffect(() => {
    const load = () => {
      void refreshNotifications()
    }
    load()

    // Realtime listener for incoming notifications
    const channel = supabase
      .channel('user-notifications-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          void refreshNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleAccept = async (invitationId: string, notificationId: string) => {
    setProcessingId(notificationId)
    // 1. Optimistically remove notification immediately from UI
    setNotifications((prev) =>
      prev.filter(
        (n) => n.id !== notificationId && (n.data as Record<string, unknown>)?.invitation_id !== invitationId
      )
    )

    startTransition(async () => {
      const res = await acceptOrgInvitation(invitationId, notificationId)
      setProcessingId(null)
      if (res.success) {
        // 2. Instantly notify other components (Sidebar, OrgSwitcher, TopNavBar)
        notifyOrgChanged(res.organizationId)
        notifyProjectsChanged()
        await refreshNotifications()
        router.refresh()
      } else {
        // Re-fetch if error
        await refreshNotifications()
      }
    })
  }

  const handleDecline = async (invitationId: string, notificationId: string) => {
    setProcessingId(notificationId)
    // 1. Optimistically remove notification immediately from UI
    setNotifications((prev) =>
      prev.filter(
        (n) => n.id !== notificationId && (n.data as Record<string, unknown>)?.invitation_id !== invitationId
      )
    )

    startTransition(async () => {
      const res = await declineOrgInvitation(invitationId, notificationId)
      setProcessingId(null)
      if (res.success) {
        await refreshNotifications()
        router.refresh()
      } else {
        await refreshNotifications()
      }
    })
  }

  const handleMarkRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId)
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="relative size-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-in zoom-in-50">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 shadow-lg border border-border bg-card"
      >
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="text-[11px] text-muted-foreground hover:text-foreground h-6 px-2"
              onClick={() => {
                notifications.forEach((n) => {
                  if (!n.isRead) handleMarkRead(n.id)
                })
              }}
            >
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
              <BellSlash className="size-8 stroke-[1.5] text-muted-foreground/50" />
              <p className="text-xs">No notifications yet</p>
            </div>
          ) : (
            notifications.map((item) => {
              const invitationId = item.data?.invitation_id as string | undefined
              const isInvitation = item.type === 'org_invitation' && invitationId

              return (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2 p-3.5 transition-colors ${
                    item.isRead ? 'bg-background/50 hover:bg-muted/30' : 'bg-primary/5 hover:bg-primary/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        {isInvitation ? (
                          <Buildings className="size-3.5" />
                        ) : (
                          <EnvelopeSimple className="size-3.5" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-foreground truncate">
                        {item.title}
                      </span>
                    </div>
                    {!item.isRead && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>

                  {item.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2 pl-8">
                      {item.message}
                    </p>
                  )}

                  {isInvitation && (
                    <div className="flex items-center gap-2 pl-8 pt-1">
                      <Button
                        size="xs"
                        className="gap-1 h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={isPending && processingId === item.id}
                        onClick={() => handleAccept(invitationId, item.id)}
                      >
                        <Check className="size-3" />
                        Accept
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        disabled={isPending && processingId === item.id}
                        onClick={() => handleDecline(invitationId, item.id)}
                      >
                        <X className="size-3" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
