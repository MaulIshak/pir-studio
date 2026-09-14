import { drive_v3 } from 'googleapis'
import { getGoogleDriveClient } from './client'

const ROOT_FOLDER_NAME = 'GameDev Team'
const SUBFOLDERS = ['Assets', 'Builds', 'GDD', 'Design', 'Credits'] as const

/**
 * Finds or creates the root 'GameDev Team' folder in Google Drive.
 */
async function getOrCreateRootFolder(drive: drive_v3.Drive): Promise<string> {
  const query = `name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents`
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
      name: ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })

  if (!createRes.data.id) {
    throw new Error('Failed to create root GameDev Team folder')
  }

  return createRes.data.id
}

/**
 * Provisions project folder and subfolders on Google Drive.
 * Returns the project folder ID.
 */
export async function provisionProjectFolders(userId: string, projectName: string): Promise<string> {
  const drive = await getGoogleDriveClient(userId)

  // 1. Get or create root folder
  const rootFolderId = await getOrCreateRootFolder(drive)

  // 2. Create project folder inside root
  const projectFolderRes = await drive.files.create({
    requestBody: {
      name: projectName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id',
  })

  const projectFolderId = projectFolderRes.data.id
  if (!projectFolderId) {
    throw new Error('Failed to create project folder on Google Drive')
  }

  // 3. Create standard subfolders
  for (const subfolder of SUBFOLDERS) {
    await drive.files.create({
      requestBody: {
        name: subfolder,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [projectFolderId],
      },
      fields: 'id',
    })
  }

  return projectFolderId
}
