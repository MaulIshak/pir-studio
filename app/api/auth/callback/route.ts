import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.session) {
      const session = data.session
      const providerToken = session.provider_token
      const providerRefreshToken = session.provider_refresh_token

      // Store Google OAuth tokens in the database for Drive API access (Vercel serverless compatible)
      if (providerToken && session.user?.id) {
        await supabase.from('oauth_tokens').upsert(
          {
            user_id: session.user.id,
            provider: 'google',
            access_token: providerToken,
            refresh_token: providerRefreshToken ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider' }
        )
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
