import { google } from 'googleapis'
import { getValidGoogleAuthClient } from './tokens'

export async function getGoogleDriveClient(userId: string) {
  const auth = await getValidGoogleAuthClient(userId)
  return google.drive({ version: 'v3', auth })
}
