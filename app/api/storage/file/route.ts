import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/auth/permissions'
import { getFileFromStorage, parseStorageKey } from '@/lib/storage/s3'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')
    if (!key) {
      return new Response('Storage key required', { status: 400 })
    }

    const parsed = parseStorageKey(key)
    if (!parsed) {
      return new Response('Invalid storage key', { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const access = await hasProjectAccess(parsed.projectId, user.id)
    if (!access.hasAccess) {
      return new Response('Forbidden', { status: 403 })
    }

    const file = await getFileFromStorage(key)
    if (!file.body) {
      return new Response('File not found', { status: 404 })
    }

    const download = request.nextUrl.searchParams.get('download') === '1'
    const requestedName = request.nextUrl.searchParams.get('name')?.trim()
    const fallbackName = parsed.fileName.replace(/^[0-9a-f-]{36}-/i, '') || parsed.fileName
    const fileName = requestedName || fallbackName
    const disposition = download ? 'attachment' : 'inline'

    const webStream = file.body.transformToWebStream()
    const headers: Record<string, string> = {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(fileName)}"`,
    }

    if (typeof file.contentLength === 'number') {
      headers['Content-Length'] = String(file.contentLength)
    }

    return new Response(webStream, { headers })
  } catch (error: unknown) {
    const errName = (error as { name?: string })?.name
    if (errName === 'NoSuchKey' || errName === 'NotFound') {
      return new Response('File not found', { status: 404 })
    }
    console.error('Failed to stream file from S3 storage:', error)
    return new Response(
      error instanceof Error ? error.message : 'Failed to retrieve file from storage',
      { status: 500 }
    )
  }
}

