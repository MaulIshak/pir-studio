import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { buildStorageFileUrl, extractStorageKeyFromUrl } from './urls'

export { buildStorageFileUrl, extractStorageKeyFromUrl }

export type StorageFolder = 'assets' | 'design' | 'builds' | 'gdd' | 'whiteboards'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_FOLDERS = new Set<string>(['assets', 'design', 'builds', 'gdd', 'whiteboards'])

let cachedClient: S3Client | null = null
let cachedPresignClient: S3Client | null = null

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Storage configuration error: missing ${name}`)
  }
  return value
}

export function getS3Bucket(): string {
  return requireEnv('S3_BUCKET')
}

export function getS3Client(): S3Client {
  if (cachedClient) {
    return cachedClient
  }

  const endpoint = requireEnv('S3_ENDPOINT')
  const region = process.env.S3_REGION?.trim() || 'garage'
  const accessKeyId = requireEnv('S3_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('S3_SECRET_ACCESS_KEY')
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false'

  cachedClient = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return cachedClient
}

/**
 * S3 client tuned for browser presigned URLs against Garage S3:
 * disables automatic CRC32 checksum query parameters that browsers cannot send
 * and that Garage rejects on presigned PUT requests.
 */
export function getS3PresignClient(): S3Client {
  if (cachedPresignClient) {
    return cachedPresignClient
  }

  const endpoint = (process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT)?.trim()
  if (!endpoint) {
    throw new Error('Storage configuration error: missing S3_ENDPOINT')
  }
  const region = process.env.S3_REGION?.trim() || 'garage'
  const accessKeyId = requireEnv('S3_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('S3_SECRET_ACCESS_KEY')
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false'

  cachedPresignClient = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return cachedPresignClient
}

function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() || 'file'
  const cleaned = baseName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned.slice(0, 180) || 'file'
}

export function buildStorageKey(
  projectId: string,
  folder: StorageFolder,
  fileName: string
): string {
  const safeName = sanitizeFileName(fileName)
  return `projects/${projectId}/${folder}/${crypto.randomUUID()}-${safeName}`
}

export function buildBoardAssetStorageKey(
  projectId: string,
  boardId: string,
  fileId: string,
  extension: string
): string {
  const safeFileId = fileId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || crypto.randomUUID()
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8) || 'bin'
  return `projects/${projectId}/whiteboards/${boardId}/${safeFileId}.${safeExt}`
}

export function parseStorageKey(
  storageKey: string
): { projectId: string; folder: StorageFolder; fileName: string; boardId?: string } | null {
  const parts = storageKey.split('/')
  if (parts[0] !== 'projects') {
    return null
  }

  if (parts.length === 4) {
    const [, projectId, folder, fileName] = parts
    if (!UUID_PATTERN.test(projectId) || !VALID_FOLDERS.has(folder) || !fileName) {
      return null
    }
    return {
      projectId,
      folder: folder as StorageFolder,
      fileName,
    }
  }

  if (parts.length === 5 && parts[2] === 'whiteboards') {
    const [, projectId, , boardId, fileName] = parts
    if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(boardId) || !fileName) {
      return null
    }
    return {
      projectId,
      folder: 'whiteboards',
      boardId,
      fileName,
    }
  }

  return null
}

export async function uploadFileToStorage(params: {
  projectId: string
  folder: StorageFolder
  fileName: string
  mimeType: string
  buffer: Buffer
}): Promise<{ storageKey: string; fileUrl: string }> {
  const client = getS3Client()
  const bucket = getS3Bucket()
  const storageKey = buildStorageKey(params.projectId, params.folder, params.fileName)

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: params.buffer,
      ContentType: params.mimeType || 'application/octet-stream',
      ContentLength: params.buffer.byteLength,
    })
  )

  return {
    storageKey,
    fileUrl: buildStorageFileUrl(storageKey, { fileName: params.fileName }),
  }
}

export async function getFileFromStorage(storageKey: string) {
  const client = getS3Client()
  const bucket = getS3Bucket()

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  )

  return {
    body: response.Body,
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength,
  }
}

export async function deleteFileFromStorage(storageKey: string): Promise<void> {
  if (!storageKey) return
  const client = getS3Client()
  const bucket = getS3Bucket()

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  )
}

export async function deleteProjectStoragePrefix(projectId: string): Promise<void> {
  if (!UUID_PATTERN.test(projectId)) return
  await deleteStoragePrefix(`projects/${projectId}/`)
}

export async function deleteBoardStoragePrefix(
  projectId: string,
  boardId: string
): Promise<void> {
  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(boardId)) return
  await deleteStoragePrefix(`projects/${projectId}/whiteboards/${boardId}/`)
}

async function deleteStoragePrefix(prefix: string): Promise<void> {
  const client = getS3Client()
  const bucket = getS3Bucket()

  let continuationToken: string | undefined
  do {
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    )

    const keys = (listRes.Contents ?? [])
      .map((obj) => obj.Key)
      .filter((key): key is string => Boolean(key))

    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      )
    }

    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined
  } while (continuationToken)
}

export async function getPresignedUploadUrl(params: {
  storageKey: string
  contentType: string
  contentLength: number
  expiresInSeconds?: number
}): Promise<string> {
  const client = getS3PresignClient()
  const bucket = getS3Bucket()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.storageKey,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  })

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds ?? 300,
    signableHeaders: new Set(['content-type', 'content-length']),
  })
}

export async function getPresignedDownloadUrl(params: {
  storageKey: string
  expiresInSeconds?: number
}): Promise<string> {
  const client = getS3PresignClient()
  const bucket = getS3Bucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.storageKey,
  })

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds ?? 900,
  })
}

export async function headFileInStorage(storageKey: string): Promise<{
  exists: boolean
  contentLength?: number
  contentType?: string
}> {
  const client = getS3Client()
  const bucket = getS3Bucket()

  try {
    const res = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    )
    return {
      exists: true,
      contentLength: res.ContentLength,
      contentType: res.ContentType,
    }
  } catch (error: unknown) {
    const errName = (error as { name?: string })?.name
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode
    if (errName === 'NotFound' || errName === 'NoSuchKey' || statusCode === 404) {
      return { exists: false }
    }
    throw error
  }
}
