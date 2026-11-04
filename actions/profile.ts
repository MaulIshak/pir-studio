'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/permissions'
import { z } from 'zod'

export interface UserProfileData {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  createdAt: string
}

const UpdateNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(60, 'Name must be 60 characters or less'),
})

export async function getUserProfile(): Promise<UserProfileData | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, created_at')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    name: profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    email: profile?.email || user.email || '',
    avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || null,
    createdAt: profile?.created_at || user.created_at,
  }
}

export async function updateProfileName(name: string) {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const parsed = UpdateNameSchema.safeParse({ name })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid name' }
  }

  const cleanName = parsed.data.name
  const supabase = await createClient()

  // 1. Update public.profiles table
  const { error: dbError } = await supabase
    .from('profiles')
    .update({ name: cleanName })
    .eq('id', user.id)

  if (dbError) {
    return { error: dbError.message }
  }

  // 2. Sync to auth user metadata so session user_metadata is updated
  try {
    await supabase.auth.updateUser({
      data: {
        full_name: cleanName,
        name: cleanName,
      },
    })
  } catch (err) {
    console.warn('Failed to update auth metadata:', err)
  }

  revalidatePath('/', 'layout')
  revalidatePath('/profile')

  return { success: true, name: cleanName }
}
