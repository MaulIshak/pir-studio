import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DEFAULT_COOKIE_OPTIONS, REMEMBER_ME_COOKIE_NAME, REMEMBER_ME_MAX_AGE } from './constants'

/**
 * If using Fluid compute: Don't put this client in a global variable. Always create a new client within each
 * function when using it.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const isRemembered = cookieStore.get(REMEMBER_ME_COOKIE_NAME)?.value !== 'false'

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: isRemembered ? DEFAULT_COOKIE_OPTIONS : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(isRemembered ? { maxAge: REMEMBER_ME_MAX_AGE } : {}),
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
              })
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
