import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { buildStorageFileUrl, extractStorageKeyFromUrl } from './urls'

export { buildStorageFileUrl, extractStorageKeyFromUrl }

export type StorageFolder = 'assets' | 'design' | 'builds' | 'gdd'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_FOLDERS = new Set<string>(['assets', 'design', 'builds', 'gdd'])

let cachedClient: S3Client | null = null

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

export function parseStorageKey(
  storageKey: string
): { projectId: string; folder: StorageFolder; fileName: string } | null {
  const parts = storageKey.split('/')
  if (parts.length !== 4 || parts[0] !== 'projects') {
    return null
  }

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
  const client = getS3Client()
  const bucket = getS3Bucket()
  const prefix = `projects/${projectId}/`

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
