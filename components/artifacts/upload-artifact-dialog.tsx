'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadSimple, CircleNotch } from '@phosphor-icons/react'
import { getArtifactUploadSession, recordArtifactAfterUpload } from '@/actions/artifacts'
import { uploadDirectToDrive } from '@/lib/gdrive/client-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UploadArtifactDialogProps {
  projectId: string
}

export function UploadArtifactDialog({ projectId }: UploadArtifactDialogProps) {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [uploadStage, setUploadStage] = useState<'idle' | 'initiating' | 'uploading' | 'recording'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<'build' | 'gdd'>('build')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const router = useRouter()

  function resetState() {
    setIsUploading(false)
    setProgress(null)
    setUploadStage('idle')
    setError(null)
    setLabel('')
    setFile(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError('Please select a file to upload')
      return
    }

    try {
      setIsUploading(true)
      setUploadStage('initiating')
      setProgress(0)

      // Step 1: Initialize Resumable Upload Session on server
      const sessionRes = await getArtifactUploadSession({
        projectId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        targetType: type,
      })

      if (!sessionRes.success || !sessionRes.uploadUrl) {
        setError(sessionRes.error || 'Failed to initialize Google Drive upload session')
        setIsUploading(false)
        return
      }

      // Step 2: Stream file directly from browser to Google Drive (0 MB Vercel payload)
      setUploadStage('uploading')
      const driveResult = await uploadDirectToDrive(sessionRes.uploadUrl, file, (percent) => {
        setProgress(percent)
      })

      if (!driveResult.id) {
        throw new Error('Google Drive upload did not return a valid file ID')
      }

      // Step 3: Record metadata in Supabase
      setUploadStage('recording')
      const recordRes = await recordArtifactAfterUpload({
        projectId,
        label: label.trim() || file.name,
        type,
        driveFileId: driveResult.id,
        fileName: file.name,
      })

      if (!recordRes.success) {
        setError(recordRes.error || 'Failed to record artifact details in database')
        setIsUploading(false)
        return
      }

      // Done
      resetState()
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      console.error('Direct-to-Drive upload error:', err)
      setError(err instanceof Error ? err.message : 'Direct upload failed. Please try again.')
      setIsUploading(false)
      setProgress(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isUploading) {
          setOpen(next)
          if (!next) resetState()
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UploadSimple className="size-4" />
        Upload File
      </DialogTrigger>

      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Upload Build or Document</DialogTitle>
          <DialogDescription>
            Streams large builds and design docs directly to Google Drive (no file size limits).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="file" className="text-sm font-medium">
              Select File
            </label>
            <Input
              id="file"
              name="file"
              type="file"
              disabled={isUploading}
              onChange={(e) => {
                const selected = e.target.files?.[0] || null
                setFile(selected)
              }}
              required
            />
            {file && (
              <span className="text-[11px] font-mono text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Destination Folder</label>
            <Select
              value={type}
              disabled={isUploading}
              onValueChange={(val) => val && setType(val as 'build' | 'gdd')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="build">Builds</SelectItem>
                <SelectItem value="gdd">Game Design Doc</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="label" className="text-sm font-medium">
              Display Label
            </label>
            <Input
              id="label"
              name="label"
              value={label}
              disabled={isUploading}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Leave blank to use filename"
            />
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-secondary/30 p-3 text-xs">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <CircleNotch className="size-3.5 animate-spin text-primary" />
                  {uploadStage === 'initiating' && 'Connecting to Google Drive...'}
                  {uploadStage === 'uploading' && `Uploading to Drive (${progress ?? 0}%)...`}
                  {uploadStage === 'recording' && 'Finalizing metadata in database...'}
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
              onClick={() => setOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadSimple className="size-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
