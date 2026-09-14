import { Readable } from 'stream'
import { drive_v3 } from 'googleapis'
import { getGoogleDriveClient } from './client'
import { getValidGoogleAuthClient } from './tokens'

export type ProjectSubfolder = 'Assets' | 'Builds' | 'GDD' | 'Design' | 'Credits'

/**
 * Finds or creates a specific subfolder inside the project's Drive folder.
 */
export async function getOrCreateSubfolder(
  drive: drive_v3.Drive,
  parentFolderId: string,
  subfolderName: ProjectSubfolder
): Promise<string> {
  const query = `name = '${subfolderName}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const searchRes = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  })

  const existingFolderId = searchRes.data.files?.[0]?.id
  if (existingFolderId) {
    return existingFolderId
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: subfolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  })

  if (!createRes.data.id) {
    throw new Error(`Failed to create subfolder ${subfolderName}`)
  }

  return createRes.data.id
}

/**
 * Uploads a file directly into a project subfolder on Google Drive.
 */
export async function uploadFileToSubfolder(
  userId: string,
  parentFolderId: string,
  subfolderName: ProjectSubfolder,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{ fileId: string; viewUrl: string }> {
  const drive = await getGoogleDriveClient(userId)

  const subfolderId = await getOrCreateSubfolder(drive, parentFolderId, subfolderName)

  const stream = new Readable()
  stream.push(fileBuffer)
  stream.push(null)

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [subfolderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: stream,
    },
    fields: 'id, name, webViewLink',
  })

  if (!res.data.id) {
    throw new Error('Google Drive upload did not return a file ID')
  }

  const viewUrl = `https://drive.google.com/file/d/${res.data.id}/view`

  return {
    fileId: res.data.id,
    viewUrl,
  }
}

/**
 * Initiates a Google Drive resumable upload session.
 * Returns the unique upload session URL for direct browser-to-Drive uploading (0 MB Vercel payload).
 */
export async function createResumableUploadSession(
  userId: string,
  parentFolderId: string,
  subfolderName: ProjectSubfolder,
  fileName: string,
  mimeType: string,
  fileSize?: number
): Promise<{ uploadUrl: string; subfolderId: string }> {
  const drive = await getGoogleDriveClient(userId)
  const subfolderId = await getOrCreateSubfolder(drive, parentFolderId, subfolderName)

  const auth = await getValidGoogleAuthClient(userId)
  const tokenResponse = await auth.getAccessToken()
  const accessToken = tokenResponse.token
  if (!accessToken) {
    throw new Error('Failed to obtain Google OAuth access token')
  }

  const metadata = {
    name: fileName,
    parents: [subfolderId],
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': mimeType || 'application/octet-stream',
  }

  if (fileSize && fileSize > 0) {
    headers['X-Upload-Content-Length'] = fileSize.toString()
  }

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(metadata),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Drive resumable upload initialization failed: ${response.status} ${errorText}`)
  }

  const uploadUrl = response.headers.get('location')
  if (!uploadUrl) {
    throw new Error('Google Drive API did not return a resumable upload location header')
  }

  return { uploadUrl, subfolderId }
}

