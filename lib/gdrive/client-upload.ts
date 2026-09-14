/**
 * Client-Side Direct Google Drive Upload Helper.
 * Streams files directly from the browser to Google Drive's edge servers,
 * completely bypassing the Vercel 4.5 MB serverless body size limitation.
 */

export interface DirectUploadResult {
  id: string
  name: string
  mimeType?: string
}

export function uploadDirectToDrive(
  uploadUrl: string,
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<DirectUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          onProgress(percent)
        }
      }
    }

    xhr.onload = () => {
      // Google Drive Resumable Upload returns 200 or 201 with file metadata on completion
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve({
            id: data.id,
            name: data.name || (file instanceof File ? file.name : 'uploaded_file'),
            mimeType: data.mimeType,
          })
        } catch {
          resolve({
            id: '',
            name: file instanceof File ? file.name : 'uploaded_file',
          })
        }
      } else {
        reject(
          new Error(
            `Google Drive direct upload failed (HTTP ${xhr.status}): ${xhr.responseText || xhr.statusText}`
          )
        )
      }
    }

    xhr.onerror = () => {
      reject(new Error('Network error occurred during direct upload to Google Drive'))
    }

    xhr.onabort = () => {
      reject(new Error('Direct upload was cancelled'))
    }

    xhr.send(file)
  })
}
