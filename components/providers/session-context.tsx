'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveOrg } from '@/actions/organizations'
import { ORG_CHANGED_EVENT, PROFILE_CHANGED_EVENT } from '@/lib/events'
import type { ActiveOrg } from '@/lib/auth/active-org'
import type { User } from '@supabase/supabase-js'

interface AppSessionContextValue {
  user: User | null
  customUserName: string | null
  activeOrg: ActiveOrg | null
  hasDriveToken: boolean | null
  isLoading: boolean
  signInWithGoogle: (nextPath?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null)

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [customUserName, setCustomUserName] = useState<string | null>(null)
  const [activeOrg, setActiveOrg] = useState<ActiveOrg | null>(null)
  const [hasDriveToken, setHasDriveToken] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return

      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const [tokenRes, org, profRes] = await Promise.all([
          supabase
            .from('oauth_tokens')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('provider', 'google')
            .maybeSingle(),
          getActiveOrg(),
          supabase
            .from('profiles')
            .select('name')
            .eq('id', currentUser.id)
            .maybeSingle(),
        ])
        if (!mounted) return
        setHasDriveToken(!!tokenRes.data)
        setActiveOrg(org)
        if (profRes.data?.name) {
          setCustomUserName(profRes.data.name)
        }
      } else {
        setHasDriveToken(false)
        setActiveOrg(null)
        setCustomUserName(null)
      }
      setIsLoading(false)
    }

    loadUser()

    const handleProfileChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ name: string }>
      if (customEvent.detail?.name) {
        setCustomUserName(customEvent.detail.name)
      }
    }

    const handleOrgChanged = async () => {
      const org = await getActiveOrg()
      if (mounted) setActiveOrg(org)
    }

    window.addEventListener(PROFILE_CHANGED_EVENT, handleProfileChanged)
    window.addEventListener(ORG_CHANGED_EVENT, handleOrgChanged)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      const nextUser = session?.user ?? null
      setUser(nextUser)
      if (!nextUser) {
        setHasDriveToken(false)
        setActiveOrg(null)
        setCustomUserName(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
      window.removeEventListener(PROFILE_CHANGED_EVENT, handleProfileChanged)
      window.removeEventListener(ORG_CHANGED_EVENT, handleOrgChanged)
    }
  }, [supabase])

  async function signInWithGoogle(nextPath = '/') {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setHasDriveToken(false)
    setActiveOrg(null)
    setCustomUserName(null)
    window.location.reload()
  }

  const value = useMemo<AppSessionContextValue>(
    () => ({
      user,
      customUserName,
      activeOrg,
      hasDriveToken,
      isLoading,
      signInWithGoogle,
      signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, customUserName, activeOrg, hasDriveToken, isLoading]
  )

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>
}

export function useAppSession() {
  const ctx = useContext(AppSessionContext)
  if (!ctx) {
    throw new Error('useAppSession must be used within AppSessionProvider')
  }
  return ctx
}
