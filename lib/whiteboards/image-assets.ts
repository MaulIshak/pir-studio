import type { BinaryFileData, DataURL } from '@excalidraw/excalidraw/types'
import type { FileId } from '@excalidraw/excalidraw/element/types'

const MAX_DIMENSION = 2048
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const downloadedCache = new Map<string, BinaryFileData>()
const inFlightUploads = new Map<string, Promise<boolean>>()
const inFlightDownloads = new Map<string, Promise<BinaryFileData | null>>()

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const [header, data] = dataUrl.split(',')
  const mimeMatch = header?.match(/data:([^;]+)(;base64)?/)
  const mimeType = mimeMatch?.[1] || 'image/png'
  const isBase64 = Boolean(mimeMatch?.[2])

  if (isBase64) {
    const binary = atob(data || '')
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return { blob: new Blob([bytes], { type: mimeType }), mimeType }
  }

  return {
    blob: new Blob([decodeURIComponent(data || '')], { type: mimeType }),
    mimeType,
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read image blob'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Downscale large raster images (PNG/JPEG/WebP) to max 2048px longest edge
 * before uploading to Garage so canvas loads stay snappy during game jams.
 */
async function optimizeImageBlob(
  blob: Blob,
  mimeType: string
): Promise<{ blob: Blob; mimeType: string; width?: number; height?: number }> {
  // Preserve GIF animation and SVG vectors untouched
  if (mimeType === 'image/gif' || mimeType === 'image/svg+xml') {
    return { blob, mimeType }
  }

  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') {
    return { blob, mimeType }
  }

  try {
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap

    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && blob.size <= 3 * 1024 * 1024) {
      bitmap.close()
      return { blob, mimeType, width, height }
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return { blob, mimeType, width, height }
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close()

    const outMime = mimeType === 'image/png' ? 'image/webp' : mimeType
    const resized = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, outMime, 0.88)
    )

    if (resized && resized.size < blob.size) {
      return { blob: resized, mimeType: outMime, width: targetW, height: targetH }
    }

    return { blob, mimeType, width, height }
  } catch {
    return { blob, mimeType }
  }
}

export async function uploadBoardImage(
  boardId: string,
  file: BinaryFileData
): Promise<{ ok: boolean; mimeType: string; width?: number; height?: number; error?: string }> {
  const cacheKey = `${boardId}:${file.id}`
  if (downloadedCache.has(cacheKey)) {
    return { ok: true, mimeType: file.mimeType }
  }

  const existingPromise = inFlightUploads.get(cacheKey)
  if (existingPromise) {
    const ok = await existingPromise
    return { ok, mimeType: file.mimeType }
  }

  let resolvedMime = file.mimeType as string
  let dims: { width?: number; height?: number } = {}
  let errorMsg: string | undefined

  const task = (async () => {
    try {
      const { blob: rawBlob, mimeType: rawMime } = dataUrlToBlob(file.dataURL)
      if (!ALLOWED_MIME_TYPES.has(rawMime)) {
        errorMsg = 'Unsupported image format'
        return false
      }

      const optimized = await optimizeImageBlob(rawBlob, rawMime)
      resolvedMime = optimized.mimeType
      dims = { width: optimized.width, height: optimized.height }

      if (optimized.blob.size > MAX_UPLOAD_BYTES) {
        errorMsg = 'Image exceeds 10 MB limit'
        return false
      }

      // 1. Request presigned PUT URL
      const presignRes = await fetch('/api/whiteboards/assets/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          fileId: file.id,
          mimeType: optimized.mimeType,
          sizeBytes: optimized.blob.size,
        }),
      })

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        errorMsg = err.error || 'Failed to prepare upload'
        return false
      }

      const presignData = (await presignRes.json()) as {
        alreadyUploaded?: boolean
        uploadUrl?: string
      }

      if (!presignData.alreadyUploaded && presignData.uploadUrl) {
        // 2. Direct browser PUT to Garage S3
        const putRes = await fetch(presignData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': optimized.mimeType,
          },
          body: optimized.blob,
        })

        if (!putRes.ok) {
          errorMsg = `Storage upload failed (${putRes.status})`
          return false
        }

        // 3. Confirm object exists in Garage & flip board_assets status -> ready
        const confirmRes = await fetch('/api/whiteboards/assets/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardId, fileId: file.id }),
        })

        if (!confirmRes.ok) {
          errorMsg = 'Failed to confirm upload'
          return false
        }
      }

      downloadedCache.set(cacheKey, file)
      return true
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Upload failed'
      return false
    } finally {
      inFlightUploads.delete(cacheKey)
    }
  })()

  inFlightUploads.set(cacheKey, task)
  const ok = await task
  return { ok, mimeType: resolvedMime, ...dims, error: errorMsg }
}

export async function fetchBoardImage(
  boardId: string,
  fileId: string,
  fallbackMimeType = 'image/png'
): Promise<BinaryFileData | null> {
  const cacheKey = `${boardId}:${fileId}`
  const cached = downloadedCache.get(cacheKey)
  if (cached) return cached

  const existing = inFlightDownloads.get(cacheKey)
  if (existing) return existing

  const task = (async (): Promise<BinaryFileData | null> => {
    try {
      const res = await fetch(
        `/api/whiteboards/assets/presign-read?boardId=${encodeURIComponent(boardId)}&fileId=${encodeURIComponent(fileId)}`
      )
      if (!res.ok) return null

      const data = (await res.json()) as { downloadUrl?: string; mimeType?: string }
      if (!data.downloadUrl) return null

      const imgRes = await fetch(data.downloadUrl)
      if (!imgRes.ok) return null

      const blob = await imgRes.blob()
      const dataURL = (await blobToDataUrl(blob)) as DataURL
      const mimeType = (data.mimeType || blob.type || fallbackMimeType) as BinaryFileData['mimeType']

      const binaryFile: BinaryFileData = {
        id: fileId as FileId,
        dataURL,
        mimeType,
        created: Date.now(),
        lastRetrieved: Date.now(),
      }
      downloadedCache.set(cacheKey, binaryFile)
      return binaryFile
    } catch {
      return null
    } finally {
      inFlightDownloads.delete(cacheKey)
    }
  })()

  inFlightDownloads.set(cacheKey, task)
  return task
}

