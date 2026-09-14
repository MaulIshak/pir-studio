import { NextRequest } from 'next/server'
import { Readable } from 'stream'
import { createClient } from '@/lib/supabase/server'
import { getGoogleDriveClient } from '@/lib/gdrive/client'

interface RouteParams {
  params: Promise<{ fileId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params
    if (!fileId) {
      return new Response('File ID required', { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const drive = await getGoogleDriveClient(user.id)

    // 1. Fetch file metadata
    const metaRes = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size',
    })

    const mimeType = metaRes.data.mimeType || 'application/octet-stream'

    // 2. Stream file content
    const fileRes = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      {
        responseType: 'stream',
      }
    )

    const webStream = Readable.toWeb(fileRes.data as unknown as Readable)

    return new Response(webStream as BodyInit, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Disposition': `inline; filename="${encodeURIComponent(metaRes.data.name || 'file')}"`,
      },
    })
  } catch (error: unknown) {
    console.error('Failed to stream file from Google Drive:', error)
    return new Response(
      error instanceof Error ? error.message : 'Failed to retrieve file from Drive',
      { status: 500 }
    )
  }
}
