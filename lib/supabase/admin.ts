import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedAdminClient: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role key.
 * Used exclusively for privileged operations that bypass RLS (e.g., server-only
 * `board_snapshots` persistence and Hocuspocus session verification).
 * NEVER import this module in client components.
 */
export function createAdminClient(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase admin configuration (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)'
    )
  }

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedAdminClient
}

