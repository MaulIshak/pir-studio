import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getBoardAccess } from '@/lib/auth/permissions'
import {
  buildBoardAssetStorageKey,
  getPresignedUploadUrl,
} from '@/lib/storage/s3'

export const runtime = 'nodejs'

const ALLOWED_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

// Simple per-user sliding window rate limiter (max 30 presign uploads / minute)
const rateWindows = new Map<string, number[]>()
function checkPresignRateLimit(userId: string): boolean {
  const now = Date.now()
  const windowMs = 60_000
  const maxRequests = 30
  const timestamps = (rateWindows.get(userId) ?? []).filter((t) => now - t < windowMs)
  if (timestamps.length >= maxRequests) {
    rateWindows.set(userId, timestamps)
    return false
  }
  timestamps.push(now)
  rateWindows.set(userId, timestamps)
  return true
}

const PresignUploadSchema = z.object({
  boardId: z.string().uuid(),
  fileId: z.string().min(1).max(120),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPresignRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Too many upload requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = PresignUploadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const { boardId, fileId, mimeType, sizeBytes } = parsed.data
    const ext = ALLOWED_MIME_EXTENSIONS[mimeType]
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported image format' },
        { status: 400 }
      )
    }

    const access = await getBoardAccess(boardId, user.id)
    if (!access.hasAccess || !access.projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!access.canWrite) {
      return NextResponse.json(
        { error: 'Board is read-only' },
        { status: 403 }
      )
    }

    // Check if this fileId is already uploaded & ready for this board
    const { data: existing } = await supabase
      .from('board_assets')
      .select('id, storage_key, status')
      .eq('board_id', boardId)
      .eq('file_id', fileId)
      .maybeSingle()

    if (existing?.status === 'ready') {
      return NextResponse.json({
        alreadyUploaded: true,
        fileId,
        storageKey: existing.storage_key,
      })
    }

    const storageKey =
      existing?.storage_key ||
      buildBoardAssetStorageKey(access.projectId, boardId, fileId, ext)

    const { error: upsertError } = await supabase.from('board_assets').upsert(
      {
        board_id: boardId,
        file_id: fileId,
        storage_key: storageKey,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        status: 'pending',
        uploaded_by: user.id,
      },
      { onConflict: 'board_id,file_id' }
    )

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      )
    }

    const uploadUrl = await getPresignedUploadUrl({
      storageKey,
      contentType: mimeType,
      contentLength: sizeBytes,
      expiresInSeconds: 300,
    })

    return NextResponse.json({
      alreadyUploaded: false,
      uploadUrl,
      storageKey,
      fileId,
      expiresInSeconds: 300,
    })
  } catch (error) {
    console.error('Presign upload failed:', error)
    return NextResponse.json(
      { error: 'Failed to prepare image upload' },
      { status: 500 }
    )
  }
}

