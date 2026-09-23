import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_COOKIE_OPTIONS, REMEMBER_ME_COOKIE_NAME, REMEMBER_ME_MAX_AGE } from './constants'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const isRemembered = request.cookies.get(REMEMBER_ME_COOKIE_NAME)?.value !== 'false'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: isRemembered ? DEFAULT_COOKIE_OPTIONS : undefined,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(isRemembered ? { maxAge: REMEMBER_ME_MAX_AGE } : {}),
              sameSite: 'lax',
              path: '/',
              secure: process.env.NODE_ENV === 'production',
            })
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Always pass through requests for files with extensions (public/ assets, robots.txt, sitemap, etc.)
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return supabaseResponse
  }

  // Public routes that don't require authentication
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/ping') ||
    pathname.startsWith('/api/mcp')

  // If user is not authenticated and trying to access any protected page (like dashboard /), redirect to /login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is already authenticated and visits /login, redirect to dashboard /
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
