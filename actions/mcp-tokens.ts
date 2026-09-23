'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hashMcpToken } from '@/lib/mcp/tokens'
import { z } from 'zod'

export interface McpTokenItem {
  id: string
  name: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export async function listMyMcpTokens(): Promise<McpTokenItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_tokens')
    .select('id, name, last_used_at, revoked_at, created_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as McpTokenItem[]
}

const CreateTokenSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
})

export async function createMcpToken(input: { name: string }) {
  const validated = CreateTokenSchema.safeParse({ name: input.name.trim() })
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Authentication required' }
  }

  const token = `gdm_${randomBytes(32).toString('hex')}`
  const { data, error } = await supabase
    .from('mcp_tokens')
    .insert({
      user_id: user.id,
      token_hash: hashMcpToken(token),
      name: validated.data.name,
    })
    .select('id, name, created_at')
    .single()

  if (error || !data) {
    return { error: error?.message ?? 'Failed to create token' }
  }

  revalidatePath('/mcp')
  return { success: true, token, item: data }
}

export async function revokeMcpToken(tokenId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/mcp')
  return { success: true }
}
