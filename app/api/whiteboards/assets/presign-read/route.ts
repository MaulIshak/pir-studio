import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBoardAccess } from '@/lib/auth/permissions'
import { getPresignedDownloadUrl } from '@/lib/storage/s3'

export const runtime = 'nodejs'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    const boardId = request.nextUrl.searchParams.get('boardId')?.trim() || ''
    const fileId = request.nextUrl.searchParams.get('fileId')?.trim() || ''

    if (!UUID_REGEX.test(boardId) || !fileId || fileId.length > 120) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await getBoardAccess(boardId, user.id)
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: assetRow } = await supabase
      .from('board_assets')
      .select('storage_key, mime_type, status')
      .eq('board_id', boardId)
      .eq('file_id', fileId)
      .eq('status', 'ready')
      .maybeSingle()

    if (!assetRow) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const downloadUrl = await getPresignedDownloadUrl({
      storageKey: assetRow.storage_key,
      expiresInSeconds: 900,
    })

    return NextResponse.json({
      downloadUrl,
      mimeType: assetRow.mime_type,
      expiresInSeconds: 900,
    })
  } catch (error) {
    console.error('Presign read failed:', error)
    return NextResponse.json(
      { error: 'Failed to sign image download URL' },
      { status: 500 }
    )
  }
}

