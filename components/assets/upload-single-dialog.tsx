'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UploadSimple, File, CircleNotch } from '@phosphor-icons/react'
import {
  Asset,
  getAssetUploadSession,
  recordSingleAssetFileUpload,
} from '@/actions/assets'
import { uploadDirectToDrive } from '@/lib/gdrive/client-upload'

interface UploadSingleDialogProps {
  asset: Asset
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UploadSingleDialog({
  asset,
  projectId,
  open,
  onOpenChange,
}: UploadSingleDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const router = useRouter()

  function resetState() {
    setFile(null)
    setError(null)
    setIsUploading(false)
    setProgress(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError('Please select a file to upload.')
      return
    }

    try {
      setIsUploading(true)
      setProgress(0)

      // 1. Get Resumable Upload Session (0 MB Vercel payload)
      const sessionRes = await getAssetUploadSession({
        projectId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        subfolder: 'Assets',
      })

      if (!sessionRes.success || !sessionRes.uploadUrl) {
        throw new Error(sessionRes.error || 'Failed to initialize Google Drive upload session')
      }

      // 2. Direct upload from browser to Google Drive
      const driveRes = await uploadDirectToDrive(sessionRes.uploadUrl, file, (p) => {
        setProgress(p)
      })

      if (!driveRes.id) {
        throw new Error('Google Drive upload did not return a valid file ID')
      }

      // 3. Update asset record in database
      const recordRes = await recordSingleAssetFileUpload({
        assetId: asset.id,
        projectId,
        driveFileId: driveRes.id,
        fileName: file.name,
      })

      if (!recordRes.success) {
        throw new Error(recordRes.error || 'Failed to update asset file record')
      }

      resetState()
      onOpenChange(false)
      router.refresh()
    } catch (err: unknown) {
      console.error('Failed to upload single asset file:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
      setIsUploading(false)
      setProgress(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isUploading) {
          onOpenChange(next)
          if (!next) resetState()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <File className="size-4 text-primary" />
            <span>Upload File for {asset.name}</span>
          </DialogTitle>
          <DialogDescription>
            Streams file directly from your browser to Google Drive (no file size limits).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="singleAssetFile" className="text-xs font-semibold">
              Asset File
            </label>
            <Input
              id="singleAssetFile"
              type="file"
              disabled={isUploading}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            {file && (
              <span className="text-[11px] font-mono text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
            <p className="text-[11px] text-muted-foreground">
              Uploading a file will set this asset status to Done automatically.
            </p>
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-secondary/30 p-3 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <CircleNotch className="size-3.5 animate-spin text-primary" />
                  Uploading to Google Drive ({progress ?? 0}%)...
                </span>
                <span className="font-mono text-muted-foreground">{progress ?? 0}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${progress ?? 5}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadSimple className="size-4" />
                  Upload File
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
