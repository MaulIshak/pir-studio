import { Readable } from 'stream'
import { drive_v3 } from 'googleapis'
import { getGoogleDriveClient } from './client'

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


