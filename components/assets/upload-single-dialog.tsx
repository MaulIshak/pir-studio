'use client'

import { useState, useTransition } from 'react'
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
import { Asset, uploadSingleAssetFile } from '@/actions/assets'

const MAX_FILE_SIZE = 4.5 * 1024 * 1024 // 4.5 MB Vercel Serverless limit

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
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function resetState() {
    setFile(null)
    setError(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const selected = e.target.files?.[0] || null
    if (selected && selected.size > MAX_FILE_SIZE) {
      setError(`File size (${(selected.size / (1024 * 1024)).toFixed(1)} MB) exceeds Vercel limit of 4.5 MB.`)
      setFile(null)
      e.target.value = ''
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError('Please select a file to upload.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds Vercel limit of 4.5 MB.`)
      return
    }

    const formData = new FormData()
    formData.set('file', file)

    startTransition(async () => {
      const res = await uploadSingleAssetFile(asset.id, projectId, formData)
      if (res.success) {
        resetState()
        onOpenChange(false)
        router.refresh()
      } else {
        setError(res.error || 'Failed to upload asset file')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) {
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
            Upload asset deliverable to Google Drive (Max 4.5 MB).
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
              disabled={isPending}
              onChange={handleFileChange}
              required
            />
            {file && (
              <span className="text-[11px] font-mono text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                resetState()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !file}>
              {isPending ? (
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
