import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

export async function getValidGoogleAuthClient(userId: string) {
  const supabase = await createClient()

  // Retrieve token from Supabase DB (Vercel read-only filesystem compatible)
  const { data: tokenRecord, error } = await supabase
    .from('oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single()

  if (error || !tokenRecord) {
    throw new Error('Google OAuth credentials not found in database. Please sign in with Google.')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    access_token: tokenRecord.access_token,
    refresh_token: tokenRecord.refresh_token,
    expiry_date: tokenRecord.expires_at ? new Date(tokenRecord.expires_at).getTime() : undefined,
  })

  // Listen to token refresh events and persist back to database
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await supabase
        .from('oauth_tokens')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? tokenRecord.refresh_token,
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('provider', 'google')
    }
  })

  return oauth2Client
}
