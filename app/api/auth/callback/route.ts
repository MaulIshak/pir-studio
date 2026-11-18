import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { REMEMBER_ME_COOKIE_NAME, REMEMBER_ME_MAX_AGE } from '@/lib/supabase/constants'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'
  const rememberParam = requestUrl.searchParams.get('remember')

  // Resolve origin properly in production (handles reverse proxies, Vercel, Cloudflare, etc.)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.session) {
      const response = NextResponse.redirect(`${origin}${next}`)
      const cookieStore = await cookies()
      const isRemembered = rememberParam
        ? rememberParam !== 'false'
        : cookieStore.get(REMEMBER_ME_COOKIE_NAME)?.value !== 'false'

      response.cookies.set(REMEMBER_ME_COOKIE_NAME, isRemembered ? 'true' : 'false', {
        maxAge: isRemembered ? REMEMBER_ME_MAX_AGE : undefined,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })

      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
