import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getBoardAccess } from '@/lib/auth/permissions'
import { headFileInStorage } from '@/lib/storage/s3'

export const runtime = 'nodejs'

const ConfirmUploadSchema = z.object({
  boardId: z.string().uuid(),
  fileId: z.string().min(1).max(120),
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

    const body = await request.json().catch(() => null)
    const parsed = ConfirmUploadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { boardId, fileId } = parsed.data
    const access = await getBoardAccess(boardId, user.id)
    if (!access.hasAccess || !access.canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: assetRow, error: lookupError } = await supabase
      .from('board_assets')
      .select('id, storage_key, mime_type, size_bytes, status')
      .eq('board_id', boardId)
      .eq('file_id', fileId)
      .maybeSingle()

    if (lookupError || !assetRow) {
      return NextResponse.json({ error: 'Asset record not found' }, { status: 404 })
    }

    if (assetRow.status === 'ready') {
      return NextResponse.json({ confirmed: true, fileId })
    }

    // Verify the object genuinely exists in Garage S3 before marking ready
    const head = await headFileInStorage(assetRow.storage_key)
    if (!head.exists) {
      return NextResponse.json(
        { error: 'Uploaded object not found in storage' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('board_assets')
      .update({
        status: 'ready',
        size_bytes: typeof head.contentLength === 'number' ? head.contentLength : assetRow.size_bytes,
      })
      .eq('id', assetRow.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      confirmed: true,
      fileId,
      storageKey: assetRow.storage_key,
    })
  } catch (error) {
    console.error('Confirm upload failed:', error)
    return NextResponse.json(
      { error: 'Failed to confirm image upload' },
      { status: 500 }
    )
  }
}

